export interface Question {
  text: string;
  choices: string[];
  correct: number;
  limitMs: number;
}

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
}
