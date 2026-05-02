import type { Question } from '@kahoot/shared';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface GenerateQuestionsOptions {
  topic: string;
  count: number;
  difficulty?: AIDifficulty;
  model?: string;
}

export interface AIProvider {
  id: string;
  generateQuestions(options: GenerateQuestionsOptions): Promise<Question[]>;
}
