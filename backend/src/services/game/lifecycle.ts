import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kahoot/shared';
import { scoreAnswer } from '@kahoot/shared';
import {
  type GameState,
  answerDistribution,
  publicPlayers,
  topLeaderboard,
} from './engine.js';
import { setGame } from './store.js';
import { gameRepo } from '../db/repositories/gameRepo.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

const BETWEEN_QUESTION_MS = 5_000;
const REVEAL_DELAY_MS = 3_000;

const timers = new Map<string, NodeJS.Timeout>();

function clearGameTimer(gameId: string) {
  const t = timers.get(gameId);
  if (t) {
    clearTimeout(t);
    timers.delete(gameId);
  }
}

function scheduleNext(gameId: string, ms: number, fn: () => void) {
  clearGameTimer(gameId);
  timers.set(
    gameId,
    setTimeout(() => {
      timers.delete(gameId);
      fn();
    }, ms),
  );
}

export function roomOf(gameId: string) {
  return `game:${gameId}`;
}

export function hostRoomOf(gameId: string) {
  return `host:${gameId}`;
}

export function startGame(io: IO, g: GameState): void {
  if (g.status !== 'lobby') return;
  io.to(roomOf(g.gameId)).emit('game_started');
  beginQuestion(io, g, 0);
}

export function beginQuestion(io: IO, g: GameState, index: number): void {
  const q = g.quiz.questions[index];
  if (!q) {
    return endGame(io, g);
  }
  g.status = 'in_question';
  g.currentQuestionIndex = index;
  g.questionStartedAt = Date.now();
  g.questionDeadlineAt = g.questionStartedAt + q.limitMs;
  g.answersByQuestion.set(index, new Map());
  setGame(g);

  io.to(roomOf(g.gameId)).emit('question', {
    index,
    total: g.quiz.questions.length,
    text: q.text,
    choices: q.choices,
    deadlineMs: g.questionDeadlineAt,
    limitMs: q.limitMs,
  });

  scheduleNext(g.gameId, q.limitMs, () => endQuestion(io, g, index));
}

export function maybeEndEarly(io: IO, g: GameState, qIndex: number) {
  if (g.status !== 'in_question' || g.currentQuestionIndex !== qIndex) return;
  const answers = g.answersByQuestion.get(qIndex);
  if (!answers) return;
  if (answers.size >= g.players.size && g.players.size > 0) {
    endQuestion(io, g, qIndex);
  }
}

function endQuestion(io: IO, g: GameState, qIndex: number) {
  if (g.status !== 'in_question' || g.currentQuestionIndex !== qIndex) return;
  clearGameTimer(g.gameId);
  g.status = 'between';
  setGame(g);

  const q = g.quiz.questions[qIndex];
  const distribution = answerDistribution(g, qIndex);
  const answers = g.answersByQuestion.get(qIndex) ?? new Map();

  // Per-player reveal includes their score breakdown.
  for (const [playerId, ans] of answers) {
    const p = g.players.get(playerId);
    if (!p || !p.socketId) continue;
    io.to(p.socketId).emit('question_end', {
      questionIndex: qIndex,
      correctChoice: q.correct,
      distribution,
      yourScore: ans.scoreEarned,
      yourCorrect: ans.choice === q.correct,
      totalScore: p.score,
    });
  }

  // Players who didn't answer also need the reveal.
  for (const p of g.players.values()) {
    if (answers.has(p.playerId)) continue;
    if (!p.socketId) continue;
    io.to(p.socketId).emit('question_end', {
      questionIndex: qIndex,
      correctChoice: q.correct,
      distribution,
      yourScore: 0,
      yourCorrect: false,
      totalScore: p.score,
    });
  }

  // Host gets the aggregate reveal too.
  if (g.hostSocketId) {
    io.to(g.hostSocketId).emit('question_end', {
      questionIndex: qIndex,
      correctChoice: q.correct,
      distribution,
    });
  }

  io.to(roomOf(g.gameId)).emit('leaderboard_update', {
    top: topLeaderboard(g),
    totalPlayers: g.players.size,
  });

  // Pause for reveal, then advance.
  scheduleNext(g.gameId, BETWEEN_QUESTION_MS + REVEAL_DELAY_MS, () => {
    if (qIndex + 1 >= g.quiz.questions.length) {
      endGame(io, g);
    } else {
      beginQuestion(io, g, qIndex + 1);
    }
  });
}

export function recordAnswer(
  g: GameState,
  playerId: string,
  qIndex: number,
  choice: number,
  clientTs: number,
): { accepted: boolean; reason?: 'late' | 'duplicate' | 'wrong_question' } {
  if (g.status !== 'in_question' || g.currentQuestionIndex !== qIndex) {
    return { accepted: false, reason: 'wrong_question' };
  }
  const now = Date.now();
  if (g.questionDeadlineAt && now > g.questionDeadlineAt + 500) {
    return { accepted: false, reason: 'late' };
  }
  const answers = g.answersByQuestion.get(qIndex);
  if (!answers) return { accepted: false, reason: 'wrong_question' };
  if (answers.has(playerId)) return { accepted: false, reason: 'duplicate' };

  const player = g.players.get(playerId);
  if (!player) return { accepted: false, reason: 'wrong_question' };

  const q = g.quiz.questions[qIndex];
  const correct = choice === q.correct;
  const timeUsed = Math.max(0, now - (g.questionStartedAt ?? now));
  const earned = scoreAnswer(correct, timeUsed, q.limitMs);

  answers.set(playerId, { choice, submittedAt: now, scoreEarned: earned });
  player.score += earned;

  return { accepted: true };
}

function endGame(io: IO, g: GameState) {
  clearGameTimer(g.gameId);
  g.status = 'ended';
  setGame(g);
  io.to(roomOf(g.gameId)).emit('game_end', {
    finalLeaderboard: topLeaderboard(g, 50),
    gameId: g.gameId,
  });

  if (g.dbQuizId && g.hostUserId) {
    const startedAt = g.createdAt;
    const endedAt = Date.now();
    const playerCount = g.players.size;
    gameRepo.recordGame({
      quizId: g.dbQuizId,
      hostUserId: g.hostUserId,
      startedAt,
      endedAt,
      playerCount,
    }).then(async (gameRow) => {
      const leaderboard = topLeaderboard(g, g.players.size);
      const results = leaderboard.map(entry => ({
        playerNickname: entry.nickname,
        finalScore: entry.score,
        finalRank: entry.rank,
      }));
      await gameRepo.recordResults(gameRow.id, results);
    }).catch(err => {
      console.error('Failed to record game to DB', err);
    });
  }
}

export function emitPlayerList(io: IO, g: GameState) {
  // (helper; currently we emit player_joined incrementally — kept for future use)
  void publicPlayers(g);
}

export function cleanupGame(gameId: string) {
  clearGameTimer(gameId);
}
