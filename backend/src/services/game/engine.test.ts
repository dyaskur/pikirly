import { describe, it, expect } from 'vitest';
import { createGameState, topLeaderboard, answerDistribution, type GameState, type PlayerState } from './engine.js';
import { scoreAnswer } from '@kahoot/shared';
import { QUIZZES } from '../../data/quizzes.js';

describe('engine', () => {
  const quiz = QUIZZES['general-1'];

  describe('scoreAnswer', () => {
    it('returns 0 if not correct', () => {
      expect(scoreAnswer(false, 1000, 15000)).toBe(0);
    });

    it('returns 1000 if answered immediately', () => {
      expect(scoreAnswer(true, 0, 15000)).toBe(1000);
    });

    it('decays score based on time used', () => {
      const scoreHalfTime = scoreAnswer(true, 7500, 15000);
      expect(scoreHalfTime).toBe(750); // 1000 * (1 - 7500 / 30000) = 750

      const scoreFullTime = scoreAnswer(true, 15000, 15000);
      expect(scoreFullTime).toBe(500); // 1000 * (1 - 15000 / 30000) = 500
    });

    it('does not decay below limit time', () => {
      const scoreLate = scoreAnswer(true, 20000, 15000);
      expect(scoreLate).toBe(500); // ratio is capped at 15000/30000
    });
  });

  describe('createGameState', () => {
    it('initializes a valid game state', () => {
      const state = createGameState(quiz, 'game-123', 'db-quiz-id', 'host-user');
      expect(state.gameId).toBe('game-123');
      expect(state.quiz).toBe(quiz);
      expect(state.status).toBe('lobby');
      expect(state.players.size).toBe(0);
      expect(state.hostToken).toBeDefined();
      expect(state.dbQuizId).toBe('db-quiz-id');
      expect(state.hostUserId).toBe('host-user');
    });
  });

  describe('topLeaderboard', () => {
    it('returns empty array when no players', () => {
      const state = createGameState(quiz, 'game-1');
      expect(topLeaderboard(state)).toEqual([]);
    });

    it('returns players sorted by score then join time', () => {
      const state = createGameState(quiz, 'game-1');
      state.players.set('p1', { playerId: 'p1', nickname: 'Alice', score: 100, connected: true, joinedAt: 100, socketId: 's1' });
      state.players.set('p2', { playerId: 'p2', nickname: 'Bob', score: 200, connected: true, joinedAt: 200, socketId: 's2' });
      state.players.set('p3', { playerId: 'p3', nickname: 'Charlie', score: 100, connected: true, joinedAt: 50, socketId: 's3' });

      const leaderboard = topLeaderboard(state);
      expect(leaderboard).toEqual([
        { playerId: 'p2', nickname: 'Bob', score: 200, rank: 1 },
        { playerId: 'p3', nickname: 'Charlie', score: 100, rank: 2 }, // Joined earlier
        { playerId: 'p1', nickname: 'Alice', score: 100, rank: 3 },
      ]);
    });

    it('respects the limit', () => {
      const state = createGameState(quiz, 'game-1');
      state.players.set('p1', { playerId: 'p1', nickname: 'Alice', score: 100, connected: true, joinedAt: 100, socketId: 's1' });
      state.players.set('p2', { playerId: 'p2', nickname: 'Bob', score: 200, connected: true, joinedAt: 200, socketId: 's2' });
      state.players.set('p3', { playerId: 'p3', nickname: 'Charlie', score: 300, connected: true, joinedAt: 50, socketId: 's3' });

      const leaderboard = topLeaderboard(state, 2);
      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].playerId).toBe('p3');
      expect(leaderboard[1].playerId).toBe('p2');
    });
  });

  describe('answerDistribution', () => {
    it('returns empty array if question index is invalid', () => {
      const state = createGameState(quiz, 'game-1');
      expect(answerDistribution(state, -1)).toEqual([]);
      expect(answerDistribution(state, 100)).toEqual([]);
    });

    it('returns zeros when no answers yet', () => {
      const state = createGameState(quiz, 'game-1');
      state.answersByQuestion.set(0, new Map());
      expect(answerDistribution(state, 0)).toEqual([0, 0, 0, 0]); // Assuming 4 choices
    });

    it('calculates the distribution of choices', () => {
      const state = createGameState(quiz, 'game-1');
      const answers = new Map();
      answers.set('p1', { choice: 1, submittedAt: 100, scoreEarned: 100 });
      answers.set('p2', { choice: 1, submittedAt: 100, scoreEarned: 100 });
      answers.set('p3', { choice: 2, submittedAt: 100, scoreEarned: 0 });
      answers.set('p4', { choice: 3, submittedAt: 100, scoreEarned: 0 });
      state.answersByQuestion.set(0, answers);

      const dist = answerDistribution(state, 0);
      expect(dist).toEqual([0, 2, 1, 1]); // Choice 1 has 2, Choice 2 has 1, Choice 3 has 1
    });

    it('ignores invalid choices', () => {
      const state = createGameState(quiz, 'game-1');
      const answers = new Map();
      answers.set('p1', { choice: -1, submittedAt: 100, scoreEarned: 0 });
      answers.set('p2', { choice: 4, submittedAt: 100, scoreEarned: 0 }); // out of bounds
      answers.set('p3', { choice: 0, submittedAt: 100, scoreEarned: 100 });
      state.answersByQuestion.set(0, answers);

      const dist = answerDistribution(state, 0);
      expect(dist).toEqual([1, 0, 0, 0]);
    });
  });
});
