import 'dotenv/config';

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { users, quizzes, templates as templatesSchema } from '../src/db/schema.js';
import { QUIZZES, DEFAULT_QUIZ_ID } from '../src/data/quizzes.js';
import { templates as starterTemplates } from '../src/data/templates.js';

async function seed() {
  console.log('Seeding database...');

  // 1. Seed Templates (Idempotent by name)
  for (const template of starterTemplates) {
    const existing = await db
      .select({ id: templatesSchema.id })
      .from(templatesSchema)
      .where(eq(templatesSchema.name, template.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(templatesSchema).values({
        name: template.name,
        description: template.description,
        category: template.category,
        subcategory: template.subcategory,
        questions: template.questions,
      });
      console.log(`Seeded template: ${template.name}`);
    } else {
      console.log(`Template already exists: ${template.name}`);
    }
  }

  // 2. Seed Test User
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
