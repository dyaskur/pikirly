import type { FastifyInstance } from 'fastify';
import { templateRepo } from '../db/repositories/templateRepo.js';

export async function templateRoutes(app: FastifyInstance) {
  // GET /templates - returns list of template stubs from DB
  app.get('/templates', async () => {
    return await templateRepo.list();
  });

  // GET /templates/:id - returns full template with questions from DB
  app.get('/templates/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await templateRepo.getById(id);
    
    if (!template) {
      reply.status(404).send({ error: 'not_found', message: 'Template not found' });
      return;
    }
    
    return template;
  });
}
