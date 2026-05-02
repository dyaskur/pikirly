// Manual verification script for AI Providers.
// Run with: cd backend && npx tsx scripts/verify-ai.ts
import { aiService } from '../src/services/ai/service.js';
import dotenv from 'dotenv';

// Load .env from the current working directory (backend/)
dotenv.config();

async function verify() {
  const topic = 'General Knowledge';
  const count = 2;

  console.log('--- Verifying AI Providers ---');

  // 1. Test Straico
  if (process.env.STRAICO_API_KEY) {
    try {
      console.log('\n[Straico] Testing...');
      const straicoResult = await aiService.generateQuestions({ topic, count, provider: 'straico' });
      console.log('✅ Straico Success!');
      console.log(JSON.stringify(straicoResult, null, 2));
    } catch (err: any) {
      console.error('❌ Straico Failed:', err.message);
    }
  } else {
    console.log('\n[Straico] Skipped (STRAICO_API_KEY not set)');
  }

  // 2. Test OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log('\n[OpenAI] Testing...');
      const openaiResult = await aiService.generateQuestions({ topic, count, provider: 'openai' });
      console.log('✅ OpenAI Success!');
      console.log(JSON.stringify(openaiResult, null, 2));
    } catch (err: any) {
      console.error('❌ OpenAI Failed:', err.message);
    }
  } else {
    console.log('\n[OpenAI] Skipped (OPENAI_API_KEY not set)');
  }

  // 3. Test OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    try {
      console.log('\n[OpenRouter] Testing...');
      const openrouterResult = await aiService.generateQuestions({ topic, count, provider: 'openrouter' });
      console.log('✅ OpenRouter Success!');
      console.log(JSON.stringify(openrouterResult, null, 2));
    } catch (err: any) {
      console.error('❌ OpenRouter Failed:', err.message);
    }
  } else {
    console.log('\n[OpenRouter] Skipped (OPENROUTER_API_KEY not set)');
  }

  // 4. Test Fallback Logic (Only if AI_PROVIDER is set and we have multiple keys)
  try {
    console.log('\n[Fallback] Testing default provider logic...');
    await aiService.generateQuestions({ topic, count: 1 });
    console.log('✅ Fallback Logic Success!');
  } catch (err: any) {
    console.error('❌ Fallback Logic Failed:', err.message);
  }
}

verify().catch(console.error);
