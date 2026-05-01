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

interface IdParams {
  id: string;
}

export async function quizRoutes(app: FastifyInstance) {
  app.addHook('preValidation', verifyJwt);

  app.get('/quizzes', async (req, reply) => {
    const quizzes = await quizRepo.list(req.user.id);
    reply.send(quizzes);
  });

  app.get<{ Params: IdParams }>('/quizzes/:id', async (req, reply) => {
    const quiz = await quizRepo.getById(req.params.id, req.user.id);
    if (!quiz) {
      reply.status(404).send({ error: 'not_found', message: 'Quiz not found' });
      return;
    }
    reply.send(quiz);
  });

  app.post('/quizzes', async (req, reply) => {
    const parseResult = quizBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      reply.status(400).send({ error: 'invalid_body', message: parseResult.error.message });
      return;
    }
    const quiz = await quizRepo.create(req.user.id, parseResult.data);
    reply.status(201).send(quiz);
  });

  app.put<{ Params: IdParams }>('/quizzes/:id', async (req, reply) => {
    const parseResult = quizBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      reply.status(400).send({ error: 'invalid_body', message: parseResult.error.message });
      return;
    }
    const quiz = await quizRepo.update(req.params.id, req.user.id, parseResult.data);
    if (!quiz) {
      reply.status(404).send({ error: 'not_found', message: 'Quiz not found' });
      return;
    }
    reply.send(quiz);
  });

  app.delete<{ Params: IdParams }>('/quizzes/:id', async (req, reply) => {
    const quiz = await quizRepo.remove(req.params.id, req.user.id);
    if (!quiz) {
      reply.status(404).send({ error: 'not_found', message: 'Quiz not found' });
      return;
    }
    reply.status(204).send();
  });
}
