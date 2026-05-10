import type { Template } from '@kahoot/shared';

export const templates: Template[] = [
  {
    id: 'general-knowledge-1',
    name: 'General Knowledge',
    description: 'A mix of history, science, and pop culture.',
    category: 'Entertainment',
    subcategory: 'Trivia',
    questions: [
      {
        id: 'gk-1',
        text: 'What is the capital of France?',
        choices: ['London', 'Berlin', 'Paris', 'Madrid'],
        correct: 2,
        limitMs: 20000,
      },
      {
        id: 'gk-2',
        text: 'Which planet is known as the Red Planet?',
        choices: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
        correct: 1,
        limitMs: 20000,
      },
      {
        id: 'gk-3',
        text: 'Who wrote "Romeo and Juliet"?',
        choices: ['Charles Dickens', 'William Shakespeare', 'Mark Twain', 'Jane Austen'],
        correct: 1,
        limitMs: 20000,
      },
    ],
  },
  {
    id: 'tech-trivia-1',
    name: 'Tech History',
    description: 'Test your knowledge of the digital age.',
    category: 'Technology',
    subcategory: 'History',
    questions: [
      {
        id: 'tech-1',
        text: 'In what year was the first iPhone released?',
        choices: ['2005', '2007', '2008', '2010'],
        correct: 1,
        limitMs: 20000,
      },
      {
        id: 'tech-2',
        text: 'Who co-founded Microsoft alongside Bill Gates?',
        choices: ['Steve Jobs', 'Paul Allen', 'Steve Wozniak', 'Elon Musk'],
        correct: 1,
        limitMs: 20000,
      },
    ],
  },
  {
    id: 'ice-breaker-1',
    name: 'Office Ice Breakers',
    description: 'Get to know your teammates better!',
    category: 'Corporate',
    subcategory: 'Team Building',
    questions: [
      {
        id: 'ib-1',
        text: 'Which of these is a popular coffee brand?',
        choices: ['Starbucks', 'Tesla', 'Nike', 'Adobe'],
        correct: 0,
        limitMs: 15000,
      },
      {
        id: 'ib-2',
        text: 'What is the most common office snack?',
        choices: ['Apples', 'Pizza', 'Cookies', 'Coffee'],
        correct: 3,
        limitMs: 15000,
      },
    ],
  },
  {
    id: 'math-basics-1',
    name: 'Math Foundations',
    description: 'Simple arithmetic and geometry.',
    category: 'Education',
    subcategory: 'Mathematics',
    questions: [
      {
        id: 'math-1',
        text: 'What is 12 x 12?',
        choices: ['124', '144', '164', '112'],
        correct: 1,
        limitMs: 30000,
      },
      {
        id: 'math-2',
        text: 'How many sides does a hexagon have?',
        choices: ['5', '6', '7', '8'],
        correct: 1,
        limitMs: 20000,
      },
    ],
  },
];
