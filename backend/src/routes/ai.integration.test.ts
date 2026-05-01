import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwtPlugin from '@fastify/jwt';
import { aiRoutes } from './ai.routes.js';
import { aiService } from '../services/ai/service.js';

vi.mock('../config.js', () => ({
  config: {
    AI_PROVIDER: 'straico',
    OPENAI_API_KEY: 'test-key',
    STRAICO_API_KEY: 'test-key',
  },
}));

// Mock the AI service to avoid real network calls
vi.mock('../services/ai/service.js', () => ({
  aiService: {
    generateQuestions: vi.fn(),
  },
}));

describe('AI Routes Integration', () => {
  const app = Fastify();

  beforeEach(async () => {
    // Register required plugins and routes
    if (!app.hasPlugin('@fastify/jwt')) {
      await app.register(jwtPlugin, { secret: 'test-secret' });
    }
    // Note: In a real app, we might need a more complex setup,
    // but for this test we focus on the AI routes.
    await app.register(aiRoutes);
  });

  it('should return 401 if not authenticated', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/ai/generate-questions',
      payload: { topic: 'Science', count: 5 },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should return 400 if body is invalid', async () => {
    const token = await app.jwt.sign({ id: 'user-1', email: 'test@example.com' });

    const response = await app.inject({
      method: 'POST',
      url: '/ai/generate-questions',
      headers: { authorization: `Bearer ${token}` },
      payload: { topic: '', count: -1 }, // Invalid
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return questions on successful generation', async () => {
    const token = await app.jwt.sign({ id: 'user-1', email: 'test@example.com' });
    const mockQuestions = [
      { id: '1', text: 'Test?', choices: ['A', 'B', 'C', 'D'], correct: 0, limitMs: 10000 }
    ];

    (aiService.generateQuestions as any).mockResolvedValue(mockQuestions);

    const response = await app.inject({
      method: 'POST',
      url: '/ai/generate-questions',
      headers: { authorization: `Bearer ${token}` },
      payload: { topic: 'Science', count: 1 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(mockQuestions);
    expect(aiService.generateQuestions).toHaveBeenCalledWith(expect.objectContaining({
      topic: 'Science',
      count: 1
    }));
  });

  it('should return 500 if generation fails', async () => {
    const token = await app.jwt.sign({ id: 'user-1', email: 'test@example.com' });

    (aiService.generateQuestions as any).mockRejectedValue(new Error('Generation failed'));

    const response = await app.inject({
      method: 'POST',
      url: '/ai/generate-questions',
      headers: { authorization: `Bearer ${token}` },
      payload: { topic: 'Science', count: 1 },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error).toBe('generation_failed');
  });
});
