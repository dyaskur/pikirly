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

    // Check if game already exists for this meeting
    const existing = findByMeetingId(meetingCode);
    if (existing) {
      return reply.send({ 
        gameId: existing.gameId, 
        hostToken: existing.hostToken,
        alreadyExists: true 
      });
    }

    // Get quiz
    const quiz = await quizRepo.getById(hostQuizId);
    if (!quiz || quiz.ownerUserId !== user.id) {
      return reply.code(404).send({ error: 'quiz_not_found' });
    }

    // Create new game
    const gameId = generatePin();
    const gameState = createGameState(quiz, gameId, quiz.id, user.id, meetingCode);
    setGame(gameState);

    return reply.send({ gameId, hostToken: gameState.hostToken });
  });

  // New REST endpoint GET /games/by-meeting/:meetingCode
  app.get('/games/by-meeting/:meetingCode', async (req, reply) => {
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
