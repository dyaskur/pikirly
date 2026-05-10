import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyJwt } from '../auth/middleware.js';
import { findByMeetingId, setGame, generatePin } from '../services/game/store.js';
import { createGameState } from '../services/game/engine.js';
import { quizRepo } from '../db/repositories/quizRepo.js';

export async function gameRoutes(app: FastifyInstance) {
  // New REST endpoint POST /games/by-meeting:
  // Create a new game tied to a Google Meet meeting
  app.post('/games/by-meeting', { preHandler: [verifyJwt] }, async (req, reply) => {
    console.log('[GAME-V6] POST /games/by-meeting hit');
    const schema = z.object({
      meetingCode: z.string().min(1),
      hostQuizId: z.string().uuid(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      console.log('[GAME-V6] Validation failed');
      return reply.send({ ok: false, error: 'invalid_request', message: body.error.message });
    }

    const { meetingCode, hostQuizId } = body.data;
    const user = req.user;

    // 1. Check for existing game
    const existing = findByMeetingId(meetingCode);
    if (existing) {
      return reply.send({ 
        ok: true,
        gameId: existing.gameId, 
        hostToken: existing.hostToken,
        alreadyExists: true 
      });
    }

    // 2. Fetch quiz from DB
    console.log('[GAME-V6] Fetching quiz from DB...');
    let quiz;
    try {
      quiz = await quizRepo.getById(hostQuizId, user.id);
    } catch (err) {
      console.error('[GAME-V6] DB Fetch failed:', err);
      return reply.send({ ok: false, error: 'db_error' });
    }

    if (!quiz) {
      console.log(`[GAME-V6] Quiz not found or not owned. User: ${user.id}, Quiz: ${hostQuizId}`);
      return reply.send({ 
        ok: false, 
        error: 'quiz_not_found', 
        message: `Quiz not found or not owned by your current account (${user.email})` 
      });
    }

    // 3. Create new game
    const gameId = generatePin();
    const gameState = createGameState(quiz, gameId, quiz.id, user.id, meetingCode);
    setGame(gameState);
    console.log('[GAME-V6] Created game:', gameId);

    return reply.send({ ok: true, gameId, hostToken: gameState.hostToken });
  });

  // New REST endpoint GET /games/by-meeting/:meetingCode
  app.get('/games/by-meeting/:meetingCode', async (req, reply) => {
    console.log('[GAME-V6] GET /games/by-meeting hit for:', (req.params as any).meetingCode);
    const paramsSchema = z.object({
      meetingCode: z.string().min(1),
    });

    const params = paramsSchema.safeParse(req.params);
    if (!params.success) {
      return reply.send({ ok: false, error: 'invalid_params' });
    }

    const game = findByMeetingId(params.data.meetingCode);
    if (!game) {
      return reply.send({ ok: false, error: 'game_not_found' });
    }

    return reply.send({ 
      ok: true,
      gameId: game.gameId, 
      status: game.status, 
      playerCount: game.players.size 
    });
  });
}
