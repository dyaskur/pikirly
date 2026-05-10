import { db } from '../client.js';
import { templates, templateCategories } from '../schema.js';
import { eq, aliasedTable, sql } from 'drizzle-orm';
import type { Template, TemplateStub, Question } from '@kahoot/shared';

// Define the exact shape returned by the complex joined queries
interface TemplateListResult {
  id: string;
  name: string;
  description: string;
  subcategory: string;
  category: string | null;
  questionCount: number | null;
}

interface TemplateGetResult {
  id: string;
  name: string;
  description: string;
  questions: Question[];
  subcategory: string;
  category: string | null;
}

export const templateRepo = {
  async list(): Promise<TemplateStub[]> {
    const sub = aliasedTable(templateCategories, 'sub');
    const parent = aliasedTable(templateCategories, 'parent');

    // Use sql fragment to count elements in JSONB array
    const questionCountSql = sql<number>`jsonb_array_length(${templates.questions})`;

    const results = await db
      .select({
        id: templates.id,
        name: templates.name,
        description: templates.description,
        subcategory: sub.name,
        category: parent.name,
        questionCount: questionCountSql,
      })
      .from(templates)
      .innerJoin(sub, eq(templates.categoryId, sub.id))
      .leftJoin(parent, eq(sub.parentId, parent.id));

    // Type casting here is necessary because Drizzle inference can collapse to 'never' 
    // on complex joins + aliased tables + sql fragments in strict mode.
    const rows = results as TemplateListResult[];

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category || r.subcategory,
      subcategory: r.category ? r.subcategory : '', 
      questionCount: r.questionCount || 0,
    }));
  },

  async getById(id: string): Promise<Template | null> {
    const sub = aliasedTable(templateCategories, 'sub');
    const parent = aliasedTable(templateCategories, 'parent');

    const results = await db
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
    
    if (results.length === 0) return null;
    
    const r = results[0] as TemplateGetResult;

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
