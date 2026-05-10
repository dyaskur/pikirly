import type { FastifyInstance } from 'fastify';
import type { TemplateStub } from '@kahoot/shared';
import { templates } from '../data/templates.js';

export async function templateRoutes(app: FastifyInstance) {
  // GET /templates - returns list of template stubs
  app.get('/templates', async () => {
    const stubs: TemplateStub[] = templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      subcategory: t.subcategory,
      questionCount: t.questions.length,
    }));
    return stubs;
  });

  // GET /templates/:id - returns full template with questions
  app.get('/templates/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = templates.find((t) => t.id === id);
    
    if (!template) {
      reply.status(404).send({ error: 'not_found', message: 'Template not found' });
      return;
    }
    
    return template;
  });
}
