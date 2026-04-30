import { describe, it, expect, beforeEach } from 'vitest';
import { gameRepo } from './gameRepo.js';
import { userRepo } from './userRepo.js';
import { quizRepo } from './quizRepo.js';

describe('gameRepo', () => {
  let userId: string;
  let quizId: string;

  beforeEach(async () => {
    const user = await userRepo.findOrCreateByGoogleSub(`game-sub-${Date.now()}`, 'game@test.com', 'Game User');
    userId = user.id;

    const quiz = await quizRepo.create(userId, { title: 'Game Quiz', questions: [] });
    quizId = quiz.id;
  });

  it('should record game and results', async () => {
    const game = await gameRepo.recordGame({
      quizId,
      hostUserId: userId,
      startedAt: Date.now() - 10000,
      endedAt: Date.now(),
      playerCount: 2
    });

    expect(game).toBeDefined();
    expect(game.quizId).toBe(quizId);
    expect(game.playerCount).toBe(2);

    const results = await gameRepo.recordResults(game.id, [
      { playerNickname: 'Player 1', finalScore: 1000, finalRank: 1 },
      { playerNickname: 'Player 2', finalScore: 500, finalRank: 2 }
    ]);

    expect(results).toBeDefined();
    expect(results.length).toBe(2);
    expect(results[0].finalScore).toBe(1000);
  });
});
