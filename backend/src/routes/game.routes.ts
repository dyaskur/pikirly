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
    console.log('[GAME-V3] POST /games/by-meeting hit');
    const schema = z.object({
      meetingCode: z.string().min(1),
      hostQuizId: z.string().uuid(),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) {
      console.log('[GAME-V3] Invalid request body', body.error);
      return reply.code(400).send({ error: 'invalid_request', message: body.error.message });
    }

    const { meetingCode, hostQuizId } = body.data;
    const user = req.user;
    console.log('[GAME-V3] Creating game for meeting:', meetingCode, 'User:', user.id);

    // Check if game already exists for this meeting
    const existing = findByMeetingId(meetingCode);
    if (existing) {
      console.log('[GAME-V3] Found existing game for meeting:', existing.gameId);
      return reply.send({ 
        gameId: existing.gameId, 
        hostToken: existing.hostToken,
        alreadyExists: true 
      });
    }

    // Get quiz
    const quiz = await quizRepo.getById(hostQuizId);
    if (!quiz || quiz.ownerUserId !== user.id) {
      console.log('[GAME-V3] Quiz not found or not owner:', hostQuizId);
      return reply.code(404).send({ error: 'quiz_not_found' });
    }

    // Create new game
    const gameId = generatePin();
    const gameState = createGameState(quiz, gameId, quiz.id, user.id, meetingCode);
    setGame(gameState);
    console.log('[GAME-V3] Created game:', gameId);

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
