import crypto from 'crypto';
import { query } from '../config/database.js';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

const SESSION_TOKEN_BYTES = 32;
const CSRF_TOKEN_BYTES = 32;
const SESSION_TTL_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function generateOpaqueToken(size) {
  return crypto.randomBytes(size).toString('base64url');
}

export class SessionService {
  static async createSession({ userId, userAgent, ipAddress }) {
    const sessionToken = generateOpaqueToken(SESSION_TOKEN_BYTES);
    const csrfToken = generateOpaqueToken(CSRF_TOKEN_BYTES);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    const result = await query(
      `INSERT INTO sessions (
         user_id,
         session_token_hash,
         csrf_token_hash,
         expires_at,
         user_agent,
         ip_address
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, expires_at`,
      [
        userId,
        hashToken(sessionToken),
        hashToken(csrfToken),
        expiresAt,
        userAgent || null,
        ipAddress || null
      ]
    );

    return {
      id: result.rows[0].id,
      sessionToken,
      csrfToken,
      expiresAt: result.rows[0].expires_at
    };
  }

  static async authenticateSession(sessionToken) {
    if (!sessionToken) {
      return null;
    }

    const result = await query(
      `SELECT
         s.id AS session_id,
         s.user_id,
         s.expires_at,
         u.id,
         u.github_id,
         u.username,
         u.email,
         u.avatar_url,
         u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.session_token_hash = $1
         AND s.expires_at > NOW()
       LIMIT 1`,
      [hashToken(sessionToken)]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    await query(
      'UPDATE sessions SET last_used_at = NOW(), updated_at = NOW() WHERE id = $1',
      [row.session_id]
    );

    return {
      session: {
        id: row.session_id,
        userId: row.user_id,
        expiresAt: row.expires_at
      },
      user: {
        id: row.id,
        github_id: row.github_id,
        username: row.username,
        email: row.email,
        avatar_url: row.avatar_url,
        created_at: row.created_at
      }
    };
  }

  static async rotateCsrfToken(sessionId) {
    const csrfToken = generateOpaqueToken(CSRF_TOKEN_BYTES);

    await query(
      'UPDATE sessions SET csrf_token_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashToken(csrfToken), sessionId]
    );

    return csrfToken;
  }

  static async validateCsrfToken(sessionId, csrfToken) {
    if (!sessionId || !csrfToken) {
      return false;
    }

    const result = await query(
      'SELECT csrf_token_hash FROM sessions WHERE id = $1 AND expires_at > NOW() LIMIT 1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const expectedHash = Buffer.from(result.rows[0].csrf_token_hash, 'utf8');
    const receivedHash = Buffer.from(hashToken(csrfToken), 'utf8');

    if (expectedHash.length !== receivedHash.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedHash, receivedHash);
  }

  static async invalidateSessionById(sessionId) {
    await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }

  static async invalidateExpiredSessions() {
    try {
      await query('DELETE FROM sessions WHERE expires_at <= NOW()');
    } catch (error) {
      logger.warn({ err: error }, 'Failed to clean up expired sessions');
    }
  }
}
