import { pgTable, uuid, text, integer, timestamp, varchar, jsonb, primaryKey, index } from 'drizzle-orm/pg-core';
import type { Question } from '@kahoot/shared';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleSub: text('google_sub').unique().notNull(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const quizzes = pgTable('quizzes', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  questions: jsonb('questions').$type<Question[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  ownerIdx: index('quizzes_owner_idx').on(table.ownerUserId),
}));

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  quizId: uuid('quiz_id')
    .notNull()
    .references(() => quizzes.id),
  hostUserId: uuid('host_user_id')
    .notNull()
    .references(() => users.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  playerCount: integer('player_count').notNull().default(0),
  meetingId: varchar('meeting_id', { length: 64 }),
});

export const gameResults = pgTable('game_results', {
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  playerNickname: text('player_nickname').notNull(),
  finalScore: integer('final_score').notNull(),
  finalRank: integer('final_rank').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.gameId, table.playerNickname] }),
}));
