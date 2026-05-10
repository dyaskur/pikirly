import { db } from '../client.js';
import { templates, templateCategories } from '../schema.js';
import { eq, aliasedTable } from 'drizzle-orm';
import type { Template, TemplateStub, Question } from '@kahoot/shared';

export const templateRepo = {
  async list(): Promise<TemplateStub[]> {
    const sub = aliasedTable(templateCategories, 'sub');
    const parent = aliasedTable(templateCategories, 'parent');

    const results = await db
      .select({
        id: templates.id,
        name: templates.name,
        description: templates.description,
        subcategory: sub.name,
        category: parent.name,
      })
      .from(templates)
      .innerJoin(sub, eq(templates.categoryId, sub.id))
      .leftJoin(parent, eq(sub.parentId, parent.id));

    // Get full questions just to count them
    const fullTemplates = await db.select({ id: templates.id, questions: templates.questions }).from(templates);
    
    return results.map(r => {
      const full = fullTemplates.find(f => f.id === r.id);
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category || r.subcategory, // If no parent, the subcategory is the main category
        subcategory: r.category ? r.subcategory : '', 
        questionCount: full?.questions?.length ?? 0
      };
    });
  },

  async getById(id: string): Promise<Template | null> {
    const sub = aliasedTable(templateCategories, 'sub');
    const parent = aliasedTable(templateCategories, 'parent');

    const [result] = await db
      .select({
        id: templates.id,
        name: templates.name,
        description: templates.description,
        questions: templates.questions,
        subcategory: sub.name,
        category: parent.name,
      })
      .from(templates)
      .innerJoin(sub, eq(templates.categoryId, sub.id))
      .leftJoin(parent, eq(sub.parentId, parent.id))
      .where(eq(templates.id, id))
      .limit(1);
    
    if (!result) return null;

    return {
      id: result.id,
      name: result.name,
      description: result.description,
      questions: result.questions,
      category: result.category || result.subcategory,
      subcategory: result.category ? result.subcategory : '',
    };
  },

  async create(data: { 
    name: string; 
    description: string; 
    categoryId: string; 
    questions: Question[]; 
  }) {
    const [result] = await db
      .insert(templates)
      .values({
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        questions: data.questions,
      })
      .returning();
    return result;
  }
};
