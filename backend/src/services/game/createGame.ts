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
  let quiz: Quiz | null = null;

  if (!quizId) {
    // If no quizId provided (e.g. smoke tests), try to find ANY quiz or a specific "General Knowledge" one
    // This removes the direct dependency on the seed file.
    const allQuizzes = user ? await quizRepo.list(user.id) : [];
    if (allQuizzes.length > 0) {
      const first = await quizRepo.getById(allQuizzes[0].id, user!.id);
      if (first) quiz = { id: first.id, title: first.title, questions: first.questions };
    }
  } else {
    if (!user) return { ok: false, error: 'unauthorized' };
    const row = await quizRepo.getById(quizId, user.id);
    if (row) quiz = { id: row.id, title: row.title, questions: row.questions };
  }

  if (!quiz) return { ok: false, error: 'unknown_quiz' };

  const gameId = generatePin();
  const game = createGameState(quiz, gameId, quiz.id, user?.id);
  setGame(game);

  return { ok: true, game };
}
