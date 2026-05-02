import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from './service.js';
import type { AIProvider } from './types.js';

vi.mock('../../config.js', () => ({
  config: {
    AI_PROVIDER: 'straico',
    OPENAI_API_KEY: 'test-key',
    STRAICO_API_KEY: 'test-key',
  },
}));

describe('AIService', () => {
  let service: AIService;
  let mockStraico: AIProvider;
  let mockOpenAI: AIProvider;

  beforeEach(() => {
    service = new AIService();
    mockStraico = {
      id: 'straico',
      generateQuestions: vi.fn(),
    };
    mockOpenAI = {
      id: 'openai',
      generateQuestions: vi.fn(),
    };
    service.registerProvider(mockStraico);
    service.registerProvider(mockOpenAI);
  });

  it('should use straico by default and return questions', async () => {
    const questions = [
      { id: '1', text: 'Q1', choices: ['A', 'B', 'C', 'D'], correct: 0, limitMs: 10000 }
    ];
    (mockStraico.generateQuestions as any).mockResolvedValue(questions);

    const result = await service.generateQuestions({ topic: 'Test', count: 1 });
    
    expect(result).toEqual(questions);
    expect(mockStraico.generateQuestions).toHaveBeenCalled();
    expect(mockOpenAI.generateQuestions).not.toHaveBeenCalled();
  });

  it('should fallback to openai if straico fails', async () => {
    const questions = [
      { id: '1', text: 'Q1', choices: ['A', 'B', 'C', 'D'], correct: 0, limitMs: 10000 }
    ];
    (mockStraico.generateQuestions as any).mockRejectedValue(new Error('Straico down'));
    (mockOpenAI.generateQuestions as any).mockResolvedValue(questions);

    const result = await service.generateQuestions({ topic: 'Test', count: 1 });
    
    expect(result).toEqual(questions);
    expect(mockStraico.generateQuestions).toHaveBeenCalled();
    expect(mockOpenAI.generateQuestions).toHaveBeenCalled();
  });

  it('should throw error if both providers fail', async () => {
    (mockStraico.generateQuestions as any).mockRejectedValue(new Error('Straico down'));
    (mockOpenAI.generateQuestions as any).mockRejectedValue(new Error('OpenAI down'));

    await expect(service.generateQuestions({ topic: 'Test', count: 1 }))
      .rejects.toThrow('OpenAI down');
  });

  it('should validate AI response with Zod and throw on failure', async () => {
    const invalidQuestions = [{ id: '1', text: 'Q1' }]; // missing fields
    (mockStraico.generateQuestions as any).mockResolvedValue(invalidQuestions);

    // Specify provider to avoid fallback chain for this specific validation test
    await expect(service.generateQuestions({ topic: 'Test', count: 1, provider: 'straico' }))
      .rejects.toThrow('AI generated invalid question format via straico');
  });

  it('should use specified provider if provided in options', async () => {
    const questions = [{ id: '1', text: 'Q1', choices: ['A', 'B', 'C', 'D'], correct: 0, limitMs: 10000 }];
    (mockOpenAI.generateQuestions as any).mockResolvedValue(questions);

    const result = await service.generateQuestions({ topic: 'Test', count: 1, provider: 'openai' });
    
    expect(result).toEqual(questions);
    expect(mockOpenAI.generateQuestions).toHaveBeenCalled();
    expect(mockStraico.generateQuestions).not.toHaveBeenCalled();
  });
});
