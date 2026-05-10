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
    console.log('[GAME-V4] POST /games/by-meeting hit');
    const schema = z.object({
      meetingCode: z.string().min(1),
      hostQuizId: z.string().uuid(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_request', message: body.error.message });
    }

    const { meetingCode, hostQuizId } = body.data;
    const user = req.user;
    console.log('[GAME-V4] Context:', { meetingCode, hostQuizId, userId: user.id });

    // 1. Optimized Check for existing game
    const existing = findByMeetingId(meetingCode);
    if (existing) {
      console.log('[GAME-V4] Found existing game:', existing.gameId);
      return reply.send({ 
        gameId: existing.gameId, 
        hostToken: existing.hostToken,
        alreadyExists: true 
      });
    }

    // 2. Fetch quiz from DB (potential bottleneck)
    console.log('[GAME-V4] Fetching quiz from DB...');
    let quiz;
    try {
      quiz = await quizRepo.getById(hostQuizId, user.id);
    } catch (err) {
      console.error('[GAME-V4] DB Fetch failed:', err);
      return reply.status(500).send({ error: 'db_error' });
    }
    console.log('[GAME-V4] Quiz fetch result:', quiz ? 'found' : 'not_found');

    if (!quiz) {
      return reply.code(404).send({ error: 'quiz_not_found' });
    }

    // 3. Create new game
    const gameId = generatePin();
    const gameState = createGameState(quiz, gameId, quiz.id, user.id, meetingCode);
    setGame(gameState);
    console.log('[GAME-V4] Game created successfully:', gameId);

    return reply.send({ gameId, hostToken: gameState.hostToken });
  });

  // New REST endpoint GET /games/by-meeting/:meetingCode
  app.get('/games/by-meeting/:meetingCode', async (req, reply) => {
    console.log('[GAME-V3] GET /games/by-meeting/:code hit', (req.params as any).meetingCode);
    const paramsSchema = z.object({
      meetingCode: z.string().min(1),
    });

    const params = paramsSchema.safeParse(req.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_params' });
    }

    const game = findByMeetingId(params.data.meetingCode);
    if (!game) {
      return reply.code(404).send({ error: 'game_not_found' });
    }

    return reply.send({ 
      gameId: game.gameId, 
      status: game.status, 
      playerCount: game.players.size 
    });
  });
}
