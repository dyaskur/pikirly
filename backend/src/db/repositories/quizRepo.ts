import { eq, and } from 'drizzle-orm';
import { db } from '../client.js';
import { quizzes } from '../schema.js';
import type { Question } from '@kahoot/shared';

export const quizRepo = {
  async list(ownerId: string) {
    const results = await db.select().from(quizzes).where(eq(quizzes.ownerUserId, ownerId));
    return results.map(q => ({
      id: q.id,
      title: q.title,
      questionCount: q.questions.length,
      updatedAt: q.updatedAt,
    }));
  },

  async getById(id: string, ownerId: string) {
    const res = await db.select().from(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.ownerUserId, ownerId)));
    return res[0] || null;
  },

  async create(ownerId: string, dto: { title: string, questions: Question[] }) {
    const inserted = await db.insert(quizzes).values({
      ownerUserId: ownerId,
      title: dto.title,
      questions: dto.questions,
    }).returning();
    return inserted[0];
  },

  async update(id: string, ownerId: string, dto: { title: string, questions: Question[] }) {
    const updated = await db.update(quizzes).set({
      title: dto.title,
      questions: dto.questions,
      updatedAt: new Date(),
    }).where(and(eq(quizzes.id, id), eq(quizzes.ownerUserId, ownerId))).returning();
    return updated[0] || null;
  },

  async remove(id: string, ownerId: string) {
    const deleted = await db.delete(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.ownerUserId, ownerId))).returning();
    return deleted[0] || null;
  }
};
