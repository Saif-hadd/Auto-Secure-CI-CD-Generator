// FIXES APPLIED: 3.2
import 'dotenv/config'; // FIX: load environment variables before validation
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  ALLOWED_SCAN_BASE_DIR: z.string().default('/tmp')
});

export const env = schema.parse(process.env); // FIX: validate critical environment variables at startup
