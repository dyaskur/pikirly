import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from './openai.js';

vi.mock('../../../config.js', () => ({
  config: {
    OPENAI_API_KEY: 'test-key',
  },
}));

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should generate questions correctly on success', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            questions: [
              { id: '1', text: 'Q1', choices: ['A', 'B', 'C', 'D'], correct: 0, limitMs: 10000 }
            ]
          })
        }
      }]
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const questions = await provider.generateQuestions({ topic: 'Math', count: 1 });

    expect(questions).toHaveLength(1);
    expect(questions[0].text).toBe('Q1');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );
  });

  it('should throw error on API failure', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      text: async () => 'Rate limit exceeded',
    });

    await expect(provider.generateQuestions({ topic: 'Math', count: 1 }))
      .rejects.toThrow('OpenAI API error: Rate limit exceeded');
  });
});
