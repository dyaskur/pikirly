import { db } from '../client.js';
import { templates } from '../schema.js';
import { eq } from 'drizzle-orm';
import type { Template, TemplateStub } from '@kahoot/shared';

export const templateRepo = {
  async list(): Promise<TemplateStub[]> {
    const results = await db
      .select({
        id: templates.id,
        name: templates.name,
        description: templates.description,
        category: templates.category,
        subcategory: templates.subcategory,
      })
      .from(templates);

    // Get full questions just to count them (or we could use a raw count if needed)
    // For now, we fetch all and count for simplicity as template count is low
    const fullTemplates = await db.select({ id: templates.id, questions: templates.questions }).from(templates);
    
    return results.map(r => {
      const full = fullTemplates.find(f => f.id === r.id);
      return {
        ...r,
        questionCount: full?.questions?.length ?? 0
      };
    });
  },

  async getById(id: string): Promise<Template | null> {
    const [result] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);
    
    return (result as Template) || null;
  },

  async create(data: Omit<Template, 'id'>) {
    const [result] = await db
      .insert(templates)
      .values(data)
      .returning();
    return result;
  }
};
