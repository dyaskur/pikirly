import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z.coerce.boolean().default(false),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  AI_PROVIDER: z.enum(['straico', 'openai', 'openrouter']).default('straico'),
  OPENAI_API_KEY: z.string().optional(),
  STRAICO_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
});

export const config = envSchema.parse(process.env);
