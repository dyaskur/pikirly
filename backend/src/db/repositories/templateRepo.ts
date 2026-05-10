import { db } from '../client.js';
import { templates, templateCategories } from '../schema.js';
import { eq, aliasedTable } from 'drizzle-orm';
import type { Template, TemplateStub, Question } from '@kahoot/shared';

// Explicit type for the joined query result to help TS inference
interface TemplateJoinResult {
  id: string;
  name: string;
  description: string;
  questions?: Question[];
  category: string | null;
  subcategory: string;
}

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
    const questionsRows = await db.select({ id: templates.id, questions: templates.questions }).from(templates);
    
    // Explicitly cast or handle types to avoid 'never'
    return (results as TemplateJoinResult[]).map(r => {
      const qRow = questionsRows.find(f => f.id === r.id);
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category || r.subcategory, 
        subcategory: r.category ? r.subcategory : '', 
        questionCount: qRow?.questions?.length ?? 0
      };
    });
  },

  async getById(id: string): Promise<Template | null> {
    const sub = aliasedTable(templateCategories, 'sub');
    const parent = aliasedTable(templateCategories, 'parent');

    const queryResults = await db
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
    
    if (queryResults.length === 0) return null;
    
    const r = queryResults[0] as TemplateJoinResult;

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      questions: r.questions || [],
      category: r.category || r.subcategory,
      subcategory: r.category ? r.subcategory : '',
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
