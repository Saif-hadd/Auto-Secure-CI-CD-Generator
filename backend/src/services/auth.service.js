import axios from 'axios';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

export class AuthService {
  static async handleGitHubCallback(code) {
    try {
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code
        },
        {
          headers: { Accept: 'application/json' }
        }
      );

      logger.info(
        {
          context: {
            hasToken: Boolean(tokenResponse.data?.access_token),
            tokenType: tokenResponse.data?.token_type || 'unknown'
          }
        },
        'GitHub OAuth token exchange completed'
      ); // FIX: avoid logging raw token payloads while retaining observable auth flow telemetry

      if (tokenResponse.data.error) {
        throw new Error(`GitHub OAuth error: ${tokenResponse.data.error_description || tokenResponse.data.error}`);
      }

      const accessToken = tokenResponse.data.access_token;

      if (!accessToken) {
        throw new Error('Failed to obtain access token from GitHub');
      }

      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      const scopes = userResponse.headers['x-oauth-scopes'] || '';
      logger.info({ context: { scopes } }, 'GitHub token scopes loaded'); // FIX: replace console logging with structured logger

      if (!scopes.includes('repo')) {
        logger.warn({ context: { scopes } }, 'GitHub token is missing the repo scope'); // FIX: replace console logging with structured logger
      }

      const githubUser = userResponse.data;
      const existingUserResult = await query(
        'SELECT * FROM users WHERE github_id = $1',
        [githubUser.id]
      );

      let user;
      if (existingUserResult.rows.length > 0) {
        const updateResult = await query(
          `UPDATE users
           SET username = $1, email = $2, avatar_url = $3, access_token = $4, updated_at = NOW()
           WHERE github_id = $5
           RETURNING *`, // TODO: ENCRYPT access_token with AES-256-GCM before writing to the DB in production // FIX: mark plaintext token storage for remediation
          [githubUser.login, githubUser.email, githubUser.avatar_url, accessToken, githubUser.id]
        );
        user = updateResult.rows[0];
      } else {
        const insertResult = await query(
          `INSERT INTO users (github_id, username, email, avatar_url, access_token)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`, // TODO: ENCRYPT access_token with AES-256-GCM before writing to the DB in production // FIX: mark plaintext token storage for remediation
          [githubUser.id, githubUser.login, githubUser.email, githubUser.avatar_url, accessToken]
        );
        user = insertResult.rows[0];
      }

      logger.info({ context: { userId: user.id, tokenPersisted: true } }, 'GitHub user persisted'); // FIX: avoid re-reading the stored token field while keeping structured audit logging

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar_url: user.avatar_url,
          github_id: user.github_id
        },
        token: user.id
      };
    } catch (error) {
      logger.error({ context: {}, err: error }, 'GitHub OAuth error'); // FIX: replace console logging with structured logger
      throw new Error(error.message || 'Authentication failed');
    }
  }

  static async getUserById(userId) {
    const result = await query(
      'SELECT id, github_id, username, email, avatar_url, access_token, created_at FROM users WHERE id = $1', // TODO: ENCRYPT access_token with AES-256-GCM before reading from the DB in production // FIX: mark plaintext token access for remediation
      [userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }
}
