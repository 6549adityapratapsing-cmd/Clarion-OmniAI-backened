import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const configSchema = z.object({
  port: z.coerce.number().default(5000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  jwtSecret: z.string().min(16).default('super_secure_clarion_omni_ai_jwt_secret_key_2026!'),
  bcryptRounds: z.coerce.number().default(12),
  supabaseUrl: z.string().optional().default(''),
  supabaseAnonKey: z.string().optional().default(''),
  supabaseServiceRoleKey: z.string().optional().default(''),
  databaseUrl: z.string().optional().default(''),
  storageDriver: z.enum(['local', 'supabase']).default('local'),
  localStoragePath: z.string().default('./storage'),
  aiProvider: z.enum(['mock', 'gemini', 'openai']).default('mock'),
  aiFallbackProvider: z.enum(['mock', 'gemini', 'openai']).default('mock'),
  aiApiKey: z.string().optional().default(''),
  ocrProvider: z.enum(['mock', 'tesseract', 'vision']).default('mock'),
  ocrApiKey: z.string().optional().default(''),
  redisUrl: z.string().optional().default(''),
  frontendUrl: z.string().default('http://localhost:5173')
});

const parsed = configSchema.safeParse({
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  jwtSecret: process.env.JWT_SECRET,
  bcryptRounds: process.env.BCRYPT_ROUNDS,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  databaseUrl: process.env.DATABASE_URL,
  storageDriver: process.env.STORAGE_DRIVER,
  localStoragePath: process.env.LOCAL_STORAGE_PATH,
  aiProvider: process.env.AI_PROVIDER,
  aiFallbackProvider: process.env.AI_FALLBACK_PROVIDER,
  aiApiKey: process.env.AI_API_KEY,
  ocrProvider: process.env.OCR_PROVIDER,
  ocrApiKey: process.env.OCR_API_KEY,
  redisUrl: process.env.REDIS_URL,
  frontendUrl: process.env.FRONTEND_URL
});

if (!parsed.success) {
  console.error('Environment configuration validation error:', parsed.error.format());
  throw new Error('Invalid environment variables for Clarion OmniAI Backend');
}

export const config = parsed.data;
