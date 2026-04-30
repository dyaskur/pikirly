import { db } from '../client.js';
import { games, gameResults } from '../schema.js';

export const gameRepo = {
  async recordGame(data: { quizId: string, hostUserId: string, startedAt: number, endedAt: number, playerCount: number }) {
    const inserted = await db.insert(games).values({
      quizId: data.quizId,
      hostUserId: data.hostUserId,
      startedAt: new Date(data.startedAt),
      endedAt: new Date(data.endedAt),
      playerCount: data.playerCount,
    }).returning();
    return inserted[0];
  },

  async recordResults(gameId: string, results: { playerNickname: string, finalScore: number, finalRank: number }[]) {
    if (results.length === 0) return [];
    const inserted = await db.insert(gameResults).values(
      results.map(r => ({
        gameId,
        playerNickname: r.playerNickname,
        finalScore: r.finalScore,
        finalRank: r.finalRank,
      }))
    ).returning();
    return inserted;
  }
};
