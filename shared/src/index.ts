// Shared event contract between backend and frontend.
// Single source of truth for the WebSocket protocol.

export type GameStatus = 'lobby' | 'in_question' | 'between' | 'ended';

export type QuestionType = 'multiple_choice' | 'true_false';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  choices: string[];           // 2–6 items; empty for open_ended/word_cloud
  correct?: number;            // index; undefined for non-scored types
  limitMs: number;
  randomizeChoices?: boolean;  // shuffle per-participant if true
}

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  questions: Question[];
}

export interface TemplateStub {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  questionCount: number;
}

export interface PlayerPublic {
  playerId: string;
  nickname: string;
  score: number;
}

export interface QuestionPublic {
  index: number;
  total: number;
  type: QuestionType;
  text: string;
  choices: string[];
  deadlineMs: number;
  limitMs: number;
  randomizeChoices?: boolean;
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
    payload: { 
      gameId: string; 
      nickname: string; 
      playerId?: string; 
      playerToken?: string;
      meetParticipantId?: string;
      meetDisplayName?: string;
    },
    cb: (
      res:
        | { ok: true; playerId: string; playerToken: string; players: PlayerPublic[]; status: GameStatus }
        | { ok: false; error: string },
    ) => void,
  ) => void;

  start_game: (
    payload: { gameId: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void,
  ) => void;

  host_resume: (
    payload: { gameId: string; hostToken: string },
    cb: (res: { ok: true } | { ok: false; error: string }) => void,
  ) => void;

  submit_answer: (payload: {
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
    correctChoice: number | null;
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

// Deterministic shuffle: DJB2 string hash → Mulberry32 PRNG → Fisher-Yates.
// Stable across client and server so per-player choice ordering reproduces on reconnect.
export function seededShuffle<T>(array: T[], seed: string): T[] {
  const result = [...array];
  if (result.length <= 1) return result;

  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }

  let s = hash >>> 0;
  const nextRandom = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
