import type { Question } from '@kahoot/shared';
import type { AIProvider, GenerateQuestionsOptions } from '../types.js';

export interface OpenAICompatibleConfig {
  id: string;
  apiKey: string;
  endpoint: string;
  defaultModel: string;
  headers?: Record<string, string>;
}

export class OpenAICompatibleProvider implements AIProvider {
  id: string;

  constructor(private config: OpenAICompatibleConfig) {
    this.id = config.id;
  }

  async generateQuestions(options: GenerateQuestionsOptions): Promise<Question[]> {
    if (!this.config.apiKey) {
      throw new Error(`API Key for ${this.id} not configured`);
    }

    const model = options.model || this.config.defaultModel;
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      ...(this.config.headers || {}),
    };

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers,
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
      throw new Error(`${this.id} API error: ${error}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`${this.id} returned empty or unexpected content shape: ${JSON.stringify(data)}`);
    }

    const jsonStr = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed.questions)) {
      throw new Error(`${this.id} returned a malformed JSON payload: "questions" is not an array`);
    }

    return parsed.questions;
  }
}
