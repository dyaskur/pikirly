import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { quizRepo } from '../db/repositories/quizRepo.js';
import { verifyJwt } from '../auth/middleware.js';

const questionSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(500),
  choices: z.array(z.string().min(1).max(200)).length(4),
  correct: z.number().int().min(0).max(3),
  limitMs: z.number().int().positive(),
});

const quizBodySchema = z.object({
  title: z.string().min(1).max(80),
  questions: z.array(questionSchema).min(1).max(50),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export async function quizRoutes(app: FastifyInstance) {
  app.addHook('preValidation', verifyJwt);

  app.get('/quizzes', async (req, reply) => {
    console.log('[QUIZ-V5] GET /quizzes hit. User:', req.user.id);
    try {
      const quizzes = await quizRepo.list(req.user.id);
      console.log('[QUIZ-V5] Found quizzes:', quizzes.length);
      reply.send(quizzes);
    } catch (err: any) {
      console.error('[QUIZ-V5] Failed to fetch quizzes:', err);
      reply.status(500).send({ 
        error: 'internal_error', 
        message: 'Failed to fetch quizzes: ' + err.message 
      });
    }
  });

  app.get('/quizzes/:id', async (req, reply) => {
    console.log('[QUIZ-V5] GET /quizzes/:id hit. ID:', (req.params as any).id);
    const parseParams = idParamSchema.safeParse(req.params);
    if (!parseParams.success) {
      reply.status(400).send({ error: 'invalid_id', message: 'ID must be a valid UUID' });
      return;
    }

    try {
      const quiz = await quizRepo.getById(parseParams.data.id, req.user.id);
      if (!quiz) {
        reply.status(404).send({ error: 'not_found', message: 'Quiz not found' });
        return;
      }
      reply.send(quiz);
    } catch (err) {
      req.log.error(err);
      reply.status(500).send({ error: 'internal_error', message: 'Failed to fetch quiz' });
    }
  });

  app.post('/quizzes', async (req, reply) => {
    const parseResult = quizBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      reply.status(400).send({ error: 'invalid_body', message: parseResult.error.message });
      return;
    }
    
    try {
      const quiz = await quizRepo.create(req.user.id, parseResult.data);
      reply.status(201).send(quiz);
    } catch (err) {
      req.log.error(err);
      reply.status(500).send({ error: 'internal_error', message: 'Failed to create quiz' });
    }
  });

  app.put('/quizzes/:id', async (req, reply) => {
    const parseParams = idParamSchema.safeParse(req.params);
    if (!parseParams.success) {
      reply.status(400).send({ error: 'invalid_id', message: 'ID must be a valid UUID' });
      return;
    }

    const parseResult = quizBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      reply.status(400).send({ error: 'invalid_body', message: parseResult.error.message });
      return;
    }

    try {
      const quiz = await quizRepo.update(parseParams.data.id, req.user.id, parseResult.data);
      if (!quiz) {
        reply.status(404).send({ error: 'not_found', message: 'Quiz not found' });
        return;
      }
      reply.send(quiz);
    } catch (err) {
      req.log.error(err);
      reply.status(500).send({ error: 'internal_error', message: 'Failed to update quiz' });
    }
  });

  app.delete('/quizzes/:id', async (req, reply) => {
    const parseParams = idParamSchema.safeParse(req.params);
    if (!parseParams.success) {
      reply.status(400).send({ error: 'invalid_id', message: 'ID must be a valid UUID' });
      return;
    }

    try {
      const quiz = await quizRepo.remove(parseParams.data.id, req.user.id);
      if (!quiz) {
        reply.status(404).send({ error: 'not_found', message: 'Quiz not found' });
        return;
      }
      reply.status(204).send();
    } catch (err) {
      req.log.error(err);
      reply.status(500).send({ error: 'internal_error', message: 'Failed to delete quiz' });
    }
  });
}
