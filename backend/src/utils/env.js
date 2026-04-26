import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { z } from 'zod';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const backendEnvFile = path.resolve(currentDir, '../../.env');
const loadedBackendEnvFile = fs.existsSync(backendEnvFile);

if (loadedBackendEnvFile) {
  dotenv.config({ path: backendEnvFile, override: false });
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),
  TOKEN_ENCRYPTION_KEY: z.string().min(32, 'TOKEN_ENCRYPTION_KEY must be at least 32 characters long'),
  SESSION_COOKIE_NAME: z.string().min(1).default('autosecure_session'),
  CSRF_COOKIE_NAME: z.string().min(1).default('autosecure_csrf'),
  OAUTH_STATE_COOKIE_NAME: z.string().min(1).default('autosecure_oauth_state'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict']).default('lax'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(168),
  OAUTH_STATE_TTL_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  ALLOWED_SCAN_BASE_DIR: z.string().default('/tmp')
});

const parsedEnv = schema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `- ${issue.path.join('.') || 'unknown'}: ${issue.message}`)
    .join('\n');

  const envSource = loadedBackendEnvFile
    ? `Loaded local env file: ${backendEnvFile}`
    : 'No local backend .env file was loaded. Using only the process environment.';

  console.error(
    [
      'Invalid environment configuration.',
      envSource,
      'Fix the variables below and restart the backend:',
      details
    ].join('\n')
  );

  process.exit(1);
}

export const env = parsedEnv.data;
