import type { Question } from '@kahoot/shared';
import type { AIProvider, GenerateQuestionsOptions } from '../types.js';
import { config } from '../../../config.js';

export class OpenAIProvider implements AIProvider {
  id = 'openai';

  async generateQuestions(options: GenerateQuestionsOptions): Promise<Question[]> {
    if (!config.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const model = options.model || 'gpt-4o-mini';
    const systemPrompt = `You are a quiz generator. Return a JSON object with a "questions" array.
Each question must match this interface:
{
  "id": "uuid",
  "text": "question text",
  "choices": ["choice 1", "choice 2", "choice 3", "choice 4"],
  "correct": 0, // index of correct choice
  "limitMs": 20000
}
Topic: ${options.topic}
Count: ${options.count}
Difficulty: ${options.difficulty || 'medium'}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that outputs JSON.' },
          { role: 'user', content: systemPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned empty content');
    }

    const parsed = JSON.parse(content);
    return parsed.questions || [];
  }
}
