import { DEFAULT_QUIZ_ID, QUIZZES } from '../../data/quizzes.js';
import { quizRepo } from '../../db/repositories/quizRepo.js';
import type { Quiz } from '../../types/quiz.js';
import { createGameState, type GameState } from './engine.js';
import { generatePin, setGame } from './store.js';

export interface CreateGameUser {
  id: string;
}

export type CreateGameResult =
  | { ok: true; game: GameState }
  | { ok: false; error: 'unauthorized' | 'unknown_quiz' };

export async function createGame(
  quizId: string | undefined,
  user: CreateGameUser | undefined,
): Promise<CreateGameResult> {
  const id = quizId ?? DEFAULT_QUIZ_ID;
  let quiz: Quiz | null = null;

  if (id === DEFAULT_QUIZ_ID) {
    quiz = QUIZZES[DEFAULT_QUIZ_ID];
  } else {
    if (!user) return { ok: false, error: 'unauthorized' };
    const row = await quizRepo.getById(id, user.id);
    if (row) quiz = { id: row.id, title: row.title, questions: row.questions };
  }

  if (!quiz) return { ok: false, error: 'unknown_quiz' };

  const gameId = generatePin();
  const dbQuizId = id === DEFAULT_QUIZ_ID ? undefined : quiz.id;
  const game = createGameState(quiz, gameId, dbQuizId, user?.id);
  setGame(game);

  return { ok: true, game };
}
