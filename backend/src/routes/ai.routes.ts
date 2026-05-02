import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyJwt } from '../auth/middleware.js';
import { aiService } from '../services/ai/service.js';

const generateBodySchema = z.object({
  topic: z.string().min(1).max(200),
  count: z.number().int().min(1).max(20),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  provider: z.enum(['straico', 'openai', 'openrouter']).optional(),
  model: z.string().optional(),
});

export async function aiRoutes(app: FastifyInstance) {
  app.addHook('preValidation', verifyJwt);

  app.post('/ai/generate-questions', async (req, reply) => {
    const parseResult = generateBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      reply.status(400).send({ error: 'invalid_body', message: parseResult.error.message });
      return;
    }

    try {
      const questions = await aiService.generateQuestions(parseResult.data);
      reply.send(questions);
    } catch (err: any) {
      req.log.error(err);
      reply.status(500).send({ 
        error: 'generation_failed', 
        message: err.message || 'Failed to generate questions' 
      });
    }
  });
}
