import 'dotenv/config';
import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { users, quizzes } from '../src/db/schema.js';
import { QUIZZES, DEFAULT_QUIZ_ID } from '../src/data/quizzes.js';

async function seed() {
  console.log('Seeding database...');

  const userRows = await db.insert(users).values({
    googleSub: 'test-user-sub-123',
    email: 'test@example.com',
    name: 'Test Host',
  }).onConflictDoUpdate({
    target: users.googleSub,
    set: { name: 'Test Host' },
  }).returning();

  const hostUser = userRows[0];
  console.log(`Test user: ${hostUser.id}`);

  const defaultQuiz = QUIZZES[DEFAULT_QUIZ_ID];

  // Idempotent: only insert if a quiz with this title doesn't exist for this owner.
  const existing = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(eq(quizzes.ownerUserId, hostUser.id), eq(quizzes.title, defaultQuiz.title)));

  if (existing.length === 0) {
    await db.insert(quizzes).values({
      ownerUserId: hostUser.id,
      title: defaultQuiz.title,
      questions: defaultQuiz.questions,
    });
    console.log(`Seeded quiz: ${defaultQuiz.title}`);
  } else {
    console.log(`Quiz already exists: ${defaultQuiz.title}`);
  }

  console.log('Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
