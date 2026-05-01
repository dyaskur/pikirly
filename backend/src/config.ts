import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  AI_PROVIDER: z.string().default('straico'),
  OPENAI_API_KEY: z.string().optional(),
  STRAICO_API_KEY: z.string().optional(),
});

export const config = envSchema.parse(process.env);
