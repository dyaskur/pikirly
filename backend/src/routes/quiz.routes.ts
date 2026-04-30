import type { FastifyInstance } from 'fastify';
import { quizRepo } from '../db/repositories/quizRepo.js';
import { verifyJwt } from '../auth/middleware.js';
import { z } from 'zod';

const questionSchema = z.object({
  id: z.string(),
  text: z.string(),
  choices: z.array(z.string()),
  correct: z.number().int().min(0).max(3),
  limitMs: z.number().int().positive(),
});

const quizBodySchema = z.object({
  title: z.string(),
  questions: z.array(questionSchema),
});

export async function quizRoutes(app: FastifyInstance) {
  app.addHook('preValidation', verifyJwt);

  app.get('/quizzes', async (req, reply) => {
    const quizzes = await quizRepo.list(req.user!.id);
    reply.send(quizzes);
  });

  app.get('/quizzes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const quiz = await quizRepo.getById(id, req.user!.id);
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
    const quiz = await quizRepo.create(req.user!.id, parseResult.data);
    reply.status(201).send(quiz);
  });

  app.put('/quizzes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseResult = quizBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      reply.status(400).send({ error: 'invalid_body', message: parseResult.error.message });
      return;
    }
    const quiz = await quizRepo.update(id, req.user!.id, parseResult.data);
    if (!quiz) {
      reply.status(404).send({ error: 'not_found', message: 'Quiz not found' });
      return;
    }
    reply.send(quiz);
  });

  app.delete('/quizzes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const quiz = await quizRepo.remove(id, req.user!.id);
    if (!quiz) {
      reply.status(404).send({ error: 'not_found', message: 'Quiz not found' });
      return;
    }
    reply.status(204).send();
  });
}
