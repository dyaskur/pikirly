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
    console.log('[GAME-V7] POST /games/by-meeting hit');
    console.log('[GAME-V7] Request body:', JSON.stringify(req.body));
    
    const schema = z.object({
      meetingCode: z.string().min(1),
      hostQuizId: z.string().uuid(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      console.log('[GAME-V7] Zod Validation failed:', body.error.message);
      return reply.send({ 
        ok: false, 
        error: 'invalid_request', 
        message: 'Invalid request data: ' + body.error.message 
      });
    }

    const { meetingCode, hostQuizId } = body.data;
    const user = req.user;
    console.log('[GAME-V7] Context:', { meetingCode, hostQuizId, userId: user.id, email: user.email });

    // 1. Check for existing game
    console.log('[GAME-V7] Checking for existing game...');
    const existing = findByMeetingId(meetingCode);
    if (existing) {
      console.log('[GAME-V7] Existing game found:', existing.gameId);
      return reply.send({ 
        ok: true,
        gameId: existing.gameId, 
        hostToken: existing.hostToken,
        alreadyExists: true 
      });
    }

    // 2. Fetch quiz from DB
    console.log('[GAME-V7] Querying DB for quiz...');
    let quiz;
    try {
      quiz = await quizRepo.getById(hostQuizId, user.id);
      console.log('[GAME-V7] DB Query successful, quiz found:', !!quiz);
    } catch (err) {
      console.error('[GAME-V7] DB Query CRASHED:', err);
      return reply.send({ 
        ok: false, 
        error: 'db_error', 
        message: 'Database query failed. This usually means a connection issue.' 
      });
    }

    if (!quiz) {
      console.log(`[GAME-V7] Ownership check failed. User ${user.id} does not own Quiz ${hostQuizId}`);
      return reply.send({ 
        ok: false, 
        error: 'quiz_not_found', 
        message: `You don't have permission to host this quiz, or it doesn't exist.` 
      });
    }

    // 3. Create new game
    console.log('[GAME-V7] Creating new game state...');
    const gameId = generatePin();
    const gameState = createGameState(quiz, gameId, quiz.id, user.id, meetingCode);
    setGame(gameState);
    console.log('[GAME-V7] Game created and stored:', gameId);

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
