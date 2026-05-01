// Shared event contract between backend and frontend.
// Single source of truth for the WebSocket protocol.

export type GameStatus = 'lobby' | 'in_question' | 'between' | 'ended';

export interface Question {
  id: string;
  text: string;
  choices: string[];
  correct: number; // index 0..choices.length-1
  limitMs: number;
}

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
}

export interface PlayerPublic {
  playerId: string;
  nickname: string;
  score: number;
}

export interface QuestionPublic {
  index: number;
  total: number;
  text: string;
  choices: string[];
  deadlineMs: number;
  limitMs: number;
}

export interface LeaderboardEntry {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
}

// Client -> Server
export interface ClientToServerEvents {
  create_game: (
    payload: { quizId?: string },
    cb: (res: { ok: true; gameId: string; hostToken: string } | { ok: false; error: string }) => void,
  ) => void;

  join_game: (
    payload: { gameId: string; nickname: string; playerId?: string },
    cb: (
      res:
        | { ok: true; playerId: string; players: PlayerPublic[]; status: GameStatus }
        | { ok: false; error: string },
    ) => void,
  ) => void;

  start_game: (
    payload: { gameId: string; hostToken: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void,
  ) => void;

  submit_answer: (payload: {
    gameId: string;
    playerId: string;
    questionIndex: number;
    choice: number;
    clientTs: number;
  }) => void;
}

// Server -> Client
export interface ServerToClientEvents {
  player_joined: (p: PlayerPublic) => void;
  player_left: (p: { playerId: string }) => void;
  game_started: () => void;
  question: (q: QuestionPublic) => void;
  answer_ack: (ack: {
    accepted: boolean;
    reason?: 'late' | 'duplicate' | 'wrong_question';
    questionIndex: number;
  }) => void;
  question_end: (payload: {
    questionIndex: number;
    correctChoice: number;
    distribution: number[];
    yourScore?: number;
    yourCorrect?: boolean;
    totalScore?: number;
  }) => void;
  leaderboard_update: (payload: { top: LeaderboardEntry[]; totalPlayers: number }) => void;
  game_end: (payload: { finalLeaderboard: LeaderboardEntry[]; gameId: string }) => void;
  error_msg: (e: { code: string; message: string }) => void;
}

// Time-decay scoring used by both server (authoritative) and reference docs.
// 1000 * (1 - timeUsed / (limit * 2)) for correct, else 0. Bounded [0, 1000].
export function scoreAnswer(correct: boolean, timeUsedMs: number, limitMs: number): number {
  if (!correct) return 0;
  const ratio = Math.min(timeUsedMs, limitMs) / (limitMs * 2);
  return Math.max(0, Math.round(1000 * (1 - ratio)));
}
