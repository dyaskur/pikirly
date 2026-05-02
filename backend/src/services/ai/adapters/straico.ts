import type { Question } from '@kahoot/shared';
import type { AIProvider, GenerateQuestionsOptions } from '../types.js';
import { config } from '../../../config.js';

export class StraicoProvider implements AIProvider {
  id = 'straico';

  async generateQuestions(options: GenerateQuestionsOptions): Promise<Question[]> {
    if (!config.STRAICO_API_KEY) {
      throw new Error('STRAICO_API_KEY not configured');
    }

    const model = options.model || 'openai/gpt-4o-mini';
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

    const response = await fetch('https://api.straico.com/v1/prompt/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.STRAICO_API_KEY}`,
      },
      body: JSON.stringify({
        models: [model],
        message: systemPrompt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Straico API error: ${error}`);
    }

    const payload = await response.json();
    if (!payload.success) {
      throw new Error(`Straico API success=false: ${payload.error || JSON.stringify(payload)}`);
    }

    if (!payload.data || !payload.data.completions || !payload.data.completions[model]) {
      throw new Error(`Straico API returned unexpected format. Missing completions for model: ${JSON.stringify(payload)}`);
    }

    const completion = payload.data.completions[model]?.completion;
    const content = completion?.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Straico returned empty content');
    }

    // Clean up content if it's wrapped in markdown code blocks
    const jsonStr = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    return parsed.questions || [];
  }
}
