import axios from 'axios';
import { query } from '../config/database.js';
import { encrypt, decryptIfNeeded, isEncrypted } from '../utils/encryption.js';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

export class AuthService {
  static sanitizeUser(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      github_id: user.github_id
    };
  }

  static async handleGitHubCallback(code) {
    try {
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code
        },
        {
          headers: { Accept: 'application/json' },
          timeout: 15000
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
        },
        timeout: 15000
      });

      const scopes = userResponse.headers['x-oauth-scopes'] || '';
      logger.info({ context: { scopes } }, 'GitHub token scopes loaded'); // FIX: replace console logging with structured logger

      if (!scopes.includes('repo')) {
        logger.warn({ context: { scopes } }, 'GitHub token is missing the repo scope'); // FIX: replace console logging with structured logger
      }

      const githubUser = userResponse.data;
      const encryptedAccessToken = encrypt(accessToken);
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
           RETURNING id, github_id, username, email, avatar_url`,
          [githubUser.login, githubUser.email, githubUser.avatar_url, encryptedAccessToken, githubUser.id]
        );
        user = updateResult.rows[0];
      } else {
        const insertResult = await query(
          `INSERT INTO users (github_id, username, email, avatar_url, access_token)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, github_id, username, email, avatar_url`,
          [githubUser.id, githubUser.login, githubUser.email, githubUser.avatar_url, encryptedAccessToken]
        );
        user = insertResult.rows[0];
      }

      logger.info({ context: { userId: user.id, tokenPersisted: true } }, 'GitHub user persisted'); // FIX: avoid re-reading the stored token field while keeping structured audit logging

      return {
        user: this.sanitizeUser(user)
      };
    } catch (error) {
      logger.error({ context: {}, err: error }, 'GitHub OAuth error'); // FIX: replace console logging with structured logger
      throw new Error(error.message || 'Authentication failed');
    }
  }

  static async getUserById(userId) {
    const result = await query(
      'SELECT id, github_id, username, email, avatar_url, created_at FROM users WHERE id = $1',
      [userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  static async getGitHubAccessTokenForUser(userId) {
    const result = await query(
      'SELECT access_token FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const storedToken = result.rows[0].access_token;

    if (!storedToken) {
      throw new Error('Access token missing - user must re-authenticate');
    }

    if (!isEncrypted(storedToken)) {
      await query(
        'UPDATE users SET access_token = $1, updated_at = NOW() WHERE id = $2',
        [encrypt(storedToken), userId]
      );
    }

    return decryptIfNeeded(storedToken);
  }
}
