import { query } from './database.js';
import { encrypt, isEncrypted } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';
import { SessionService } from '../services/session.service.js';

async function ensureSessionsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_token_hash TEXT NOT NULL UNIQUE,
      csrf_token_hash TEXT NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  await query('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)');
}

async function encryptLegacyAccessTokens() {
  const result = await query('SELECT id, access_token FROM users');
  let migratedCount = 0;

  for (const row of result.rows) {
    if (!row.access_token || isEncrypted(row.access_token)) {
      continue;
    }

    await query(
      'UPDATE users SET access_token = $1, updated_at = NOW() WHERE id = $2',
      [encrypt(row.access_token), row.id]
    );
    migratedCount += 1;
  }

  if (migratedCount > 0) {
    logger.warn({ context: { migratedCount } }, 'Migrated plaintext GitHub tokens to encrypted storage');
  }
}

export async function bootstrapSecurity() {
  await ensureSessionsTable();
  await encryptLegacyAccessTokens();
  await SessionService.invalidateExpiredSessions();
}
