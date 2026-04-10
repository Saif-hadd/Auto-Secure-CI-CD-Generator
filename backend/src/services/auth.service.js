import axios from 'axios';
import { query } from '../config/database.js';

export class AuthService {
  static async handleGitHubCallback(code) {
    try {
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id:     process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code
        },
        {
          headers: { Accept: 'application/json' }
        }
      );

      // ✅ Log pour voir ce que GitHub retourne réellement
      console.log('GitHub token response:', tokenResponse.data);

      // ✅ Vérifier les erreurs GitHub explicites
      if (tokenResponse.data.error) {
        throw new Error(`GitHub OAuth error: ${tokenResponse.data.error_description || tokenResponse.data.error}`);
      }

      const accessToken = tokenResponse.data.access_token;

      if (!accessToken) {
        throw new Error('Failed to obtain access token from GitHub');
      }

      // ✅ Vérifier que le token fonctionne + récupérer les scopes
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      const scopes = userResponse.headers['x-oauth-scopes'] || '';
      console.log('✅ Token scopes:', scopes);

      if (!scopes.includes('repo')) {
        console.warn('⚠️ Token missing repo scope — push to GitHub will fail');
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
           RETURNING *`,
          [githubUser.login, githubUser.email, githubUser.avatar_url, accessToken, githubUser.id]
        );
        user = updateResult.rows[0];
      } else {
        const insertResult = await query(
          `INSERT INTO users (github_id, username, email, avatar_url, access_token)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [githubUser.id, githubUser.login, githubUser.email, githubUser.avatar_url, accessToken]
        );
        user = insertResult.rows[0];
      }

      console.log('✅ User saved, access_token in DB:', !!user.access_token);

      return {
        user: {
          id:         user.id,
          username:   user.username,
          email:      user.email,
          avatar_url: user.avatar_url,
          github_id:  user.github_id
        },
        token: user.id
      };

    } catch (error) {
      // ✅ Log le vrai message d'erreur
      console.error('GitHub OAuth error:', error.message);
      throw new Error(error.message || 'Authentication failed');
    }
  }

  static async getUserById(userId) {
    const result = await query(
      // ✅ access_token inclus pour cohérence avec le middleware
      'SELECT id, github_id, username, email, avatar_url, access_token, created_at FROM users WHERE id = $1',
      [userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }
}