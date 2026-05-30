// Test-only routes. Mounted only when E2E_TEST_MODE=1, so this file never
// reaches production binaries via the env-gate in server.ts.
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createGameState } from '../services/game/engine.js';
import { setGame, getGame, generatePin } from '../services/game/store.js';
import {
  maybeEndEarly,
  recordAnswer,
  roomOf,
  tryStartGame,
} from '../services/game/lifecycle.js';
import { QUIZZES } from '../db/seeds/quizzes.js';
import { getIO } from '../ws/ioRef.js';

const gameParamsSchema = z.object({ gameId: z.string().length(6) });

export async function testRoutes(app: FastifyInstance) {
  app.get('/test/health', async () => ({ ok: true, mode: 'e2e' }));

  app.post('/test/games', async (req, reply) => {
    const body = z
      .object({
        quizKey: z.string().default('general-1'),
        players: z.array(z.string().min(1).max(40)).default([]),
      })
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ ok: false, error: 'invalid_request' });

    const quiz = QUIZZES[body.data.quizKey];
    if (!quiz) return reply.code(404).send({ ok: false, error: 'quiz_not_found' });

    const gameId = generatePin();
    const game = createGameState(quiz, gameId);
    setGame(game);

    const players = body.data.players.map((nickname) => {
      const playerId = randomUUID();
      const playerToken = randomUUID();
      game.players.set(playerId, {
        playerId,
        playerToken,
        nickname,
        score: 0,
        connected: true,
        joinedAt: Date.now(),
        socketId: null,
      });
      return { playerId, playerToken, nickname };
    });

    return reply.send({
      ok: true,
      gameId,
      hostToken: game.hostToken,
      players,
    });
  });

  app.post('/test/games/:gameId/players/broadcast', async (req, reply) => {
    const params = gameParamsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ ok: false });
    const game = getGame(params.data.gameId);
    if (!game) return reply.code(404).send({ ok: false });
    const io = getIO();
    for (const p of game.players.values()) {
      io.to(roomOf(game.gameId)).emit('player_joined', {
        playerId: p.playerId,
        nickname: p.nickname,
        score: p.score,
      });
    }
    return reply.send({ ok: true, count: game.players.size });
  });

  app.post('/test/games/:gameId/start', async (req, reply) => {
    const params = gameParamsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ ok: false });
    const game = getGame(params.data.gameId);
    if (!game) return reply.code(404).send({ ok: false });
    return reply.send(tryStartGame(getIO(), game));
  });

  app.post('/test/games/:gameId/answer', async (req, reply) => {
    const params = gameParamsSchema.safeParse(req.params);
    const body = z
      .object({ playerId: z.string(), choice: z.number().int().min(0) })
      .safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ ok: false });
    const game = getGame(params.data.gameId);
    if (!game) return reply.code(404).send({ ok: false });
    const ack = recordAnswer(
      game,
      body.data.playerId,
      game.currentQuestionIndex,
      body.data.choice,
      Date.now(),
    );
    return reply.send({ ok: true, ack });
  });

  // Force-end the current question without waiting for the timer.
  // Pads any missing answers with a sentinel so maybeEndEarly fires immediately.
  app.post('/test/games/:gameId/advance', async (req, reply) => {
    const params = gameParamsSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ ok: false });
    const game = getGame(params.data.gameId);
    if (!game) return reply.code(404).send({ ok: false });
    if (game.status !== 'in_question') {
      return reply.code(400).send({ ok: false, error: 'not_in_question' });
    }
    const qIndex = game.currentQuestionIndex;
    const answers = game.answersByQuestion.get(qIndex) ?? new Map();
    for (const playerId of game.players.keys()) {
      if (!answers.has(playerId)) {
        answers.set(playerId, { choice: -1, submittedAt: Date.now(), scoreEarned: 0 });
      }
    }
    game.answersByQuestion.set(qIndex, answers);
    maybeEndEarly(getIO(), game, qIndex);
    return reply.send({ ok: true });
  });

  app.log.warn('[E2E_TEST_MODE] /test/* routes mounted — DO NOT enable in production');
}
