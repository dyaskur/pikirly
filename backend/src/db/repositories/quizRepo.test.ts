import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { quizRepo } from './quizRepo.js';
import { userRepo } from './userRepo.js';
import { db } from '../client.js';
import { quizzes, users } from '../schema.js';
import { eq } from 'drizzle-orm';

describe('quizRepo', () => {
  let userId: string;

  beforeEach(async () => {
    const user = await userRepo.findOrCreateByGoogleSub(`quiz-sub-${Date.now()}`, 'quiz@test.com', 'Quiz User');
    userId = user.id;
  });

  it('should create and list quizzes', async () => {
    const quizData = {
      title: 'Test Quiz',
      questions: [
        { id: '1', text: 'Q1', choices: ['A', 'B', 'C', 'D'], correct: 0, limitMs: 20_000 },
      ],
    };

    const created = await quizRepo.create(userId, quizData);
    expect(created).toBeDefined();
    expect(created.title).toBe(quizData.title);
    expect(created.ownerUserId).toBe(userId);

    const list = await quizRepo.list(userId);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(created.id);
    expect(list[0].questionCount).toBe(1);
  });

  it('should update and remove quiz', async () => {
    const created = await quizRepo.create(userId, { title: 'To Update', questions: [] });
    
    const updated = await quizRepo.update(created.id, userId, { title: 'Updated Title', questions: [] });
    expect(updated).toBeDefined();
    expect(updated?.title).toBe('Updated Title');

    const removed = await quizRepo.remove(created.id, userId);
    expect(removed).toBeDefined();
    expect(removed?.id).toBe(created.id);

    const check = await quizRepo.getById(created.id, userId);
    expect(check).toBeNull();
  });
});
