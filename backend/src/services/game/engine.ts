import { randomUUID } from 'node:crypto';
import type { Quiz } from '../../types/quiz.js';
import type { GameStatus, LeaderboardEntry, PlayerPublic } from '@kahoot/shared';

export interface PlayerState {
  playerId: string;
  nickname: string;
  score: number;
  connected: boolean;
  joinedAt: number;
  socketId: string | null;
}

export interface AnswerRecord {
  choice: number;
  submittedAt: number;
  scoreEarned: number;
}

export interface GameState {
  gameId: string;
  hostToken: string;
  hostSocketId: string | null;
  quiz: Quiz;
  status: GameStatus;
  currentQuestionIndex: number;
  questionStartedAt: number | null;
  questionDeadlineAt: number | null;
  players: Map<string, PlayerState>;
  answersByQuestion: Map<number, Map<string, AnswerRecord>>;
  createdAt: number;
}

export function createGameState(quiz: Quiz, gameId: string): GameState {
  return {
    gameId,
    hostToken: randomUUID(),
    hostSocketId: null,
    quiz,
    status: 'lobby',
    currentQuestionIndex: -1,
    questionStartedAt: null,
    questionDeadlineAt: null,
    players: new Map(),
    answersByQuestion: new Map(),
    createdAt: Date.now(),
  };
}

export function publicPlayers(g: GameState): PlayerPublic[] {
  return Array.from(g.players.values()).map((p) => ({
    playerId: p.playerId,
    nickname: p.nickname,
    score: p.score,
  }));
}

export function topLeaderboard(g: GameState, n = 10): LeaderboardEntry[] {
  return Array.from(g.players.values())
    .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
    .slice(0, n)
    .map((p, i) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      score: p.score,
      rank: i + 1,
    }));
}

export function answerDistribution(g: GameState, qIndex: number): number[] {
  const q = g.quiz.questions[qIndex];
  if (!q) return [];
  const dist = new Array(q.choices.length).fill(0);
  const answers = g.answersByQuestion.get(qIndex);
  if (!answers) return dist;
  for (const a of answers.values()) {
    if (a.choice >= 0 && a.choice < dist.length) dist[a.choice]++;
  }
  return dist;
}
