import { z } from 'zod';
import type { Question } from '@kahoot/shared';
import { config } from '../../config.js';
import type { AIProvider, GenerateQuestionsOptions } from './types.js';
import { StraicoProvider } from './adapters/straico.js';
import { OpenAICompatibleProvider } from './adapters/openai-compatible.js';

const aiQuestionSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(500),
  choices: z.array(z.string().min(1).max(200)).length(4),
  correct: z.number().int().min(0).max(3),
  limitMs: z.number().int().positive(),
});

const aiResponseSchema = z.array(aiQuestionSchema);

export class AIService {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    this.registerProvider(new OpenAICompatibleProvider({
      id: 'openai',
      apiKey: config.OPENAI_API_KEY || '',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      defaultModel: 'gpt-4o-mini',
    }));
    this.registerProvider(new OpenAICompatibleProvider({
      id: 'openrouter',
      apiKey: config.OPENROUTER_API_KEY || '',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      defaultModel: 'openai/gpt-4o-mini',
      headers: {
        'HTTP-Referer': 'https://pikirly.app',
        'X-Title': 'Pikirly',
      },
    }));
    this.registerProvider(new StraicoProvider());
  }

  registerProvider(provider: AIProvider) {
    this.providers.set(provider.id, provider);
  }

  async generateQuestions(
    options: GenerateQuestionsOptions & { provider?: string }
  ): Promise<Question[]> {
    // If a specific provider is requested, use only that one.
    if (options.provider) {
      return this.executeWithProvider(options.provider, options);
    }

    const primaryProvider = config.AI_PROVIDER;
    const fallbackProvider = config.AI_FALLBACK_PROVIDER;

    try {
      return await this.executeWithProvider(primaryProvider, options);
    } catch (err) {
      console.warn(`[AIService] ${primaryProvider} generation failed, falling back to ${fallbackProvider}:`, err);
      
      // If the primary provider is the same as the fallback, don't try it again.
      if (primaryProvider === fallbackProvider) {
        throw err;
      }
      
      return await this.executeWithProvider(fallbackProvider, options);
    }
  }

  private async executeWithProvider(
    providerId: string,
    options: GenerateQuestionsOptions
  ): Promise<Question[]> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`AI Provider "${providerId}" not found`);
    }

    const rawQuestions = await provider.generateQuestions(options);
    
    // Validate with Zod
    const result = aiResponseSchema.safeParse(rawQuestions);
    if (!result.success) {
      console.error(`AI Response Validation Failed (${providerId}):`, result.error.message);
      throw new Error(`AI generated invalid question format via ${providerId}`);
    }

    return result.data;
  }
}

export const aiService = new AIService();
