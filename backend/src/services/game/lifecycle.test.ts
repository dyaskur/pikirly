import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startGame, beginQuestion, maybeEndEarly, recordAnswer, cleanupGame, roomOf } from './lifecycle.js';
import { createGameState, type GameState } from './engine.js';
import { QUIZZES } from '../../data/quizzes.js';
import { Server } from 'socket.io';
import { gameRepo } from '../../db/repositories/gameRepo.js';

vi.mock('../../db/repositories/gameRepo.js', () => ({
  gameRepo: {
    recordGame: vi.fn().mockResolvedValue({ id: 'game-db-id' }),
    recordResults: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('lifecycle', () => {
  let io: any;
  let emitMock: any;
  let toMock: any;
  let state: GameState;
  const quiz = QUIZZES['general-1'];

  beforeEach(() => {
    vi.useFakeTimers();
    emitMock = vi.fn();
    toMock = vi.fn().mockReturnValue({ emit: emitMock });
    io = {
      to: toMock,
    } as unknown as Server;

    state = createGameState(quiz, 'game-1', 'db-quiz-id', 'host-user');
    // Add some players
    state.players.set('p1', { playerId: 'p1', nickname: 'Alice', score: 0, connected: true, joinedAt: 100, socketId: 's1' });
    state.players.set('p2', { playerId: 'p2', nickname: 'Bob', score: 0, connected: true, joinedAt: 100, socketId: 's2' });
  });

  afterEach(() => {
    cleanupGame(state.gameId);
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('startGame', () => {
    it('starts the game and begins the first question', () => {
      startGame(io, state);
      expect(toMock).toHaveBeenCalledWith(roomOf('game-1'));
      expect(emitMock).toHaveBeenCalledWith('game_started');
      expect(state.status).toBe('in_question');
      expect(state.currentQuestionIndex).toBe(0);
      expect(emitMock).toHaveBeenCalledWith('question', expect.objectContaining({
        index: 0,
        total: quiz.questions.length,
        text: quiz.questions[0].text,
      }));
    });

    it('does nothing if status is not lobby', () => {
      state.status = 'in_question';
      startGame(io, state);
      expect(toMock).not.toHaveBeenCalled();
    });
  });

  describe('beginQuestion', () => {
    it('emits question details and sets deadline', () => {
      beginQuestion(io, state, 1);
      expect(state.status).toBe('in_question');
      expect(state.currentQuestionIndex).toBe(1);
      expect(state.questionStartedAt).toBeDefined();
      expect(state.questionDeadlineAt).toBe(state.questionStartedAt! + quiz.questions[1].limitMs);
      
      expect(toMock).toHaveBeenCalledWith(roomOf('game-1'));
      expect(emitMock).toHaveBeenCalledWith('question', expect.objectContaining({
        index: 1,
        text: quiz.questions[1].text,
        limitMs: quiz.questions[1].limitMs,
      }));
    });

    it('ends question automatically after limitMs', () => {
      beginQuestion(io, state, 0);
      expect(state.status).toBe('in_question');
      
      // Fast forward limitMs
      vi.advanceTimersByTime(quiz.questions[0].limitMs);
      
      expect(state.status).toBe('between');
      expect(emitMock).toHaveBeenCalledWith('question_end', expect.any(Object));
      
      // Fast forward BETWEEN_QUESTION_MS + REVEAL_DELAY_MS to next question
      vi.advanceTimersByTime(5000 + 3000);
      expect(state.status).toBe('in_question');
      expect(state.currentQuestionIndex).toBe(1);
    });

    it('ends game if no more questions', () => {
      beginQuestion(io, state, quiz.questions.length); // out of bounds
      expect(state.status).toBe('ended');
      expect(emitMock).toHaveBeenCalledWith('game_end', expect.any(Object));
      expect(gameRepo.recordGame).toHaveBeenCalled();
    });
  });

  describe('maybeEndEarly', () => {
    it('ends question early if all players answered', () => {
      beginQuestion(io, state, 0);
      const answers = state.answersByQuestion.get(0)!;
      answers.set('p1', { choice: 1, submittedAt: Date.now(), scoreEarned: 100 });
      answers.set('p2', { choice: 2, submittedAt: Date.now(), scoreEarned: 0 });
      
      maybeEndEarly(io, state, 0);
      
      expect(state.status).toBe('between');
      expect(emitMock).toHaveBeenCalledWith('question_end', expect.any(Object));
    });

    it('does not end early if not all players answered', () => {
      beginQuestion(io, state, 0);
      const answers = state.answersByQuestion.get(0)!;
      answers.set('p1', { choice: 1, submittedAt: Date.now(), scoreEarned: 100 });
      
      maybeEndEarly(io, state, 0);
      
      expect(state.status).toBe('in_question'); // Still waiting for p2
    });
    
    it('does not end early if wrong state', () => {
      state.status = 'between';
      maybeEndEarly(io, state, 0);
      expect(toMock).not.toHaveBeenCalled();
    });
  });

  describe('recordAnswer', () => {
    beforeEach(() => {
      // Start question at 0
      state.status = 'in_question';
      state.currentQuestionIndex = 0;
      state.questionStartedAt = Date.now();
      state.questionDeadlineAt = state.questionStartedAt + quiz.questions[0].limitMs;
      state.answersByQuestion.set(0, new Map());
    });

    it('accepts a valid answer and calculates score', () => {
      const res = recordAnswer(state, 'p1', 0, quiz.questions[0].correct, Date.now());
      expect(res.accepted).toBe(true);
      
      const answers = state.answersByQuestion.get(0)!;
      expect(answers.has('p1')).toBe(true);
      expect(answers.get('p1')!.scoreEarned).toBeGreaterThan(0);
      
      expect(state.players.get('p1')!.score).toBe(answers.get('p1')!.scoreEarned);
    });

    it('rejects if wrong status', () => {
      state.status = 'between';
      const res = recordAnswer(state, 'p1', 0, 1, Date.now());
      expect(res.accepted).toBe(false);
      expect(res.reason).toBe('wrong_question');
    });

    it('rejects if wrong question index', () => {
      const res = recordAnswer(state, 'p1', 1, 1, Date.now());
      expect(res.accepted).toBe(false);
      expect(res.reason).toBe('wrong_question');
    });

    it('rejects duplicate answer', () => {
      recordAnswer(state, 'p1', 0, 1, Date.now());
      const res2 = recordAnswer(state, 'p1', 0, 2, Date.now());
      expect(res2.accepted).toBe(false);
      expect(res2.reason).toBe('duplicate');
    });

    it('rejects if past deadline', () => {
      // Move time past deadline + 500ms
      vi.advanceTimersByTime(quiz.questions[0].limitMs + 600);
      const res = recordAnswer(state, 'p1', 0, 1, Date.now());
      expect(res.accepted).toBe(false);
      expect(res.reason).toBe('late');
    });

    it('rejects if player not found', () => {
      const res = recordAnswer(state, 'unknown', 0, 1, Date.now());
      expect(res.accepted).toBe(false);
      expect(res.reason).toBe('wrong_question');
    });
  });
});
