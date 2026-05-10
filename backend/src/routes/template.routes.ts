import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { templateRepo } from '../db/repositories/templateRepo.js';

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export async function templateRoutes(app: FastifyInstance) {
  // GET /templates - returns list of template stubs from DB
  app.get('/templates', async (req, reply) => {
    try {
      return await templateRepo.list();
    } catch (err) {
      req.log.error(err);
      reply.status(500).send({ error: 'internal_error', message: 'Failed to fetch templates' });
    }
  });

  // GET /templates/:id - returns full template with questions from DB
  app.get('/templates/:id', async (req, reply) => {
    const parseResult = idParamSchema.safeParse(req.params);
    if (!parseResult.success) {
      reply.status(400).send({ error: 'invalid_id', message: 'ID must be a valid UUID' });
      return;
    }

    try {
      const template = await templateRepo.getById(parseResult.data.id);
      
      if (!template) {
        reply.status(404).send({ error: 'not_found', message: 'Template not found' });
        return;
      }
      
      return template;
    } catch (err) {
      req.log.error(err);
      reply.status(500).send({ error: 'internal_error', message: 'Failed to fetch template' });
    }
  });
}
