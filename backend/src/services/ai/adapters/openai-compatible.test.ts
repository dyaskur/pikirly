import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAICompatibleProvider } from './openai-compatible.js';

describe('OpenAICompatibleProvider', () => {
  let provider: OpenAICompatibleProvider;

  beforeEach(() => {
    provider = new OpenAICompatibleProvider({
      id: 'test-provider',
      apiKey: 'test-key',
      endpoint: 'https://api.test.com/v1/chat',
      defaultModel: 'test-model',
      headers: { 'X-Custom': 'value' }
    });
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
      'https://api.test.com/v1/chat',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'X-Custom': 'value'
        }),
        body: expect.stringContaining('"model":"test-model"')
      })
    );
  });

  it('should throw error on API failure', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      text: async () => 'Rate limit exceeded',
    });

    await expect(provider.generateQuestions({ topic: 'Math', count: 1 }))
      .rejects.toThrow('test-provider API error: Rate limit exceeded');
  });

  it('should throw error if apiKey is not configured', async () => {
    const unconfiguredProvider = new OpenAICompatibleProvider({
      id: 'no-key-provider',
      apiKey: '',
      endpoint: 'https://api.test.com/v1/chat',
      defaultModel: 'test-model'
    });

    await expect(unconfiguredProvider.generateQuestions({ topic: 'Math', count: 1 }))
      .rejects.toThrow('API Key for no-key-provider not configured');
  });
});
