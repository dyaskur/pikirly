import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StraicoProvider } from './straico.js';

vi.mock('../../../config.js', () => ({
  config: {
    STRAICO_API_KEY: 'straico-test-key',
  },
}));

describe('StraicoProvider', () => {
  let provider: StraicoProvider;

  beforeEach(() => {
    provider = new StraicoProvider();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should generate questions correctly on success', async () => {
    const model = 'openai/gpt-4o-mini';
    const mockResponse = {
      success: true,
      completions: {
        [model]: {
          completion: {
            choices: [{
              message: {
                content: JSON.stringify({
                  questions: [
                    { id: '2', text: 'Q2', choices: ['X', 'Y', 'Z', 'W'], correct: 1, limitMs: 15000 }
                  ]
                })
              }
            }]
          }
        }
      }
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const questions = await provider.generateQuestions({ topic: 'History', count: 1 });

    expect(questions).toHaveLength(1);
    expect(questions[0].text).toBe('Q2');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.straico.com/v1/prompt/completion',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer straico-test-key',
        }),
      })
    );
  });

  it('should clean up markdown backticks from content', async () => {
    const model = 'openai/gpt-4o-mini';
    const mockResponse = {
      success: true,
      completions: {
        [model]: {
          completion: {
            choices: [{
              message: {
                content: '```json\n{"questions": []}\n```'
              }
            }]
          }
        }
      }
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const questions = await provider.generateQuestions({ topic: 'History', count: 1 });
    expect(questions).toEqual([]);
  });

  it('should throw error when success is false', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: 'Out of credits' }),
    });

    await expect(provider.generateQuestions({ topic: 'History', count: 1 }))
      .rejects.toThrow('Straico API success=false: Out of credits');
  });
});
