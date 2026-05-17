import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyJwt } from '../auth/middleware.js';
import { findByMeetingId, setGame, generatePin, getGame } from '../services/game/store.js';
import { createGameState } from '../services/game/engine.js';
import { quizRepo } from '../db/repositories/quizRepo.js';

export async function gameRoutes(app: FastifyInstance) {
  // New REST endpoint POST /games/by-meeting:
  // Create a new game tied to a Google Meet meeting
  app.post('/games/by-meeting', { preHandler: [verifyJwt] }, async (req, reply) => {
    const schema = z.object({
      meetingCode: z.string().min(1),
      hostQuizId: z.string().uuid(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({
        ok: false,
        error: 'invalid_request',
        message: 'Invalid request data: ' + body.error.message
      });
    }

    const { meetingCode, hostQuizId } = body.data;
    const user = req.user;

    // 1. Check for existing game
    const existing = findByMeetingId(meetingCode);
    if (existing) {
      // SECURITY: Only return the hostToken if the current user is the actual host
      if (existing.hostUserId !== user.id) {
        return reply.code(403).send({
          ok: false,
          error: 'forbidden',
          message: 'A game already exists for this meeting, but you are not the host.'
        });
      }

      return reply.send({
        ok: true,
        gameId: existing.gameId,
        hostToken: existing.hostToken,
        alreadyExists: true
      });
    }

    // 2. Fetch quiz from DB
    let quiz;
    try {
      quiz = await quizRepo.getById(hostQuizId, user.id);
    } catch (err) {
      req.log.error({ err }, 'DB error fetching quiz for game creation');
      return reply.code(500).send({
        ok: false,
        error: 'db_error',
        message: 'Database query failed. This usually means a connection issue.'
      });
    }

    if (!quiz) {
      return reply.code(404).send({
        ok: false,
        error: 'quiz_not_found',
        message: `You don't have permission to host this quiz, or it doesn't exist.`
      });
    }

    // 3. Create new game
    const gameId = generatePin();
    const gameState = createGameState(quiz, gameId, quiz.id, user.id, meetingCode);
    setGame(gameState);

    return reply.send({ ok: true, gameId, hostToken: gameState.hostToken });
  });

  // New REST endpoint GET /games/by-meeting/:meetingCode
  app.get('/games/by-meeting/:meetingCode', async (req, reply) => {
    const paramsSchema = z.object({
      meetingCode: z.string().min(1),
    });

    const params = paramsSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ ok: false, error: 'invalid_params' });
    }

    const { meetingCode } = params.data;

    const game = findByMeetingId(meetingCode);
    if (!game) {
      return reply.code(404).send({ ok: false, error: 'game_not_found' });
    }

    return reply.send({
      ok: true,
      gameId: game.gameId,
      status: game.status,
      playerCount: game.players.size,
      hostUserId: game.hostUserId
    });
  });

  // Reclaim host session (for Main Stage recovery)
  app.post('/games/:gameId/reclaim', { preHandler: [verifyJwt] }, async (req, reply) => {
    const { gameId } = req.params as { gameId: string };
    const user = req.user;
    const game = getGame(gameId);

    if (!game) {
      return reply.code(404).send({ ok: false, error: 'game_not_found' });
    }

    if (game.hostUserId !== user.id) {
      return reply.code(403).send({ ok: false, error: 'forbidden' });
    }

    return reply.send({ ok: true, hostToken: game.hostToken });
  });
}
