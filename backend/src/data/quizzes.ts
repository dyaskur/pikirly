import type { Quiz } from '../types/quiz.js';

// Phase 1 hard-coded quiz. Used by the smoke test path and as a seed source.
export const QUIZZES: Record<string, Quiz> = {
  'general-1': {
    id: 'general-1',
    title: 'General Knowledge Warm-Up',
    questions: [
      {
        id: 'general-1-q1',
        text: 'What is 7 × 8?',
        choices: ['54', '56', '64', '48'],
        correct: 1,
        limitMs: 15_000,
      },
      {
        id: 'general-1-q2',
        text: 'Which planet is known as the Red Planet?',
        choices: ['Venus', 'Jupiter', 'Mars', 'Saturn'],
        correct: 2,
        limitMs: 15_000,
      },
      {
        id: 'general-1-q3',
        text: 'Who wrote "Romeo and Juliet"?',
        choices: ['Dickens', 'Shakespeare', 'Austen', 'Tolstoy'],
        correct: 1,
        limitMs: 15_000,
      },
      {
        id: 'general-1-q4',
        text: 'What is the chemical symbol for gold?',
        choices: ['Go', 'Gd', 'Au', 'Ag'],
        correct: 2,
        limitMs: 15_000,
      },
      {
        id: 'general-1-q5',
        text: 'Which language has the most native speakers?',
        choices: ['English', 'Spanish', 'Hindi', 'Mandarin Chinese'],
        correct: 3,
        limitMs: 20_000,
      },
    ],
  },
};

export const DEFAULT_QUIZ_ID = 'general-1';
