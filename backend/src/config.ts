import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

// z.coerce.boolean() uses Boolean() which treats "false" as truthy. Parse strings explicitly.
function envBool(defaultValue: boolean) {
  return z.preprocess((v) => {
    if (v === undefined || v === null || v === '') return defaultValue;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const lower = v.toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes';
    }
    return defaultValue;
  }, z.boolean());
}

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: envBool(false),
  DATABASE_SSL_NO_VERIFY: envBool(false),
  ALLOW_INSECURE_TLS: envBool(false),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  AI_PROVIDER: z.enum(['straico', 'openai', 'openrouter']).default('straico'),
  AI_FALLBACK_PROVIDER: z.enum(['straico', 'openai', 'openrouter']).default('openrouter'),
  OPENAI_API_KEY: z.string().optional(),
  STRAICO_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
});

export const config = envSchema.parse(process.env);
