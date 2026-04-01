import axios from 'axios';
import { query } from '../config/database.js';
import { StackDetector } from '../utils/stack-detector.js';

export class RepoService {
  static async getUserRepositories(userId) {
    const result = await query(
      'SELECT * FROM repositories WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  static async getRepositoryById(repoId, userId) {
    const result = await query(
      'SELECT * FROM repositories WHERE id = $1 AND user_id = $2',
      [repoId, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  static async syncUserRepositories(userId, accessToken) {
    try {
      const response = await axios.get('https://api.github.com/user/repos', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          sort: 'updated',
          per_page: 100
        }
      });

      const githubRepos = response.data;
      const repositories = [];

      for (const repo of githubRepos) {
        const existingRepoResult = await query(
          'SELECT * FROM repositories WHERE user_id = $1 AND github_repo_id = $2',
          [userId, repo.id]
        );

        if (existingRepoResult.rows.length > 0) {
          const updateResult = await query(
            `UPDATE repositories
             SET repo_name = $1, repo_full_name = $2, repo_url = $3,
                 default_branch = $4, is_private = $5, updated_at = NOW()
             WHERE id = $6
             RETURNING *`,
            [
              repo.name,
              repo.full_name,
              repo.html_url,
              repo.default_branch || 'main',
              repo.private,
              existingRepoResult.rows[0].id
            ]
          );
          repositories.push(updateResult.rows[0]);
        } else {
          const insertResult = await query(
            `INSERT INTO repositories
             (user_id, github_repo_id, repo_name, repo_full_name, repo_url, default_branch, is_private)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [userId, repo.id, repo.name, repo.full_name, repo.html_url, repo.default_branch || 'main', repo.private]
          );
          repositories.push(insertResult.rows[0]);
        }
      }

      return repositories;
    } catch (error) {
      console.error('Sync repositories error:', error);
      throw new Error('Failed to sync repositories');
    }
  }

  static async detectTechStack(repoId, userId, accessToken) {
    try {
      const repository = await this.getRepositoryById(repoId, userId);

      if (!repository) {
        throw new Error('Repository not found');
      }

      const stack = await StackDetector.detect(
        repository.repo_full_name,
        repository.default_branch,
        accessToken
      );

      await query(
        'UPDATE repositories SET stack_detected = $1 WHERE id = $2',
        [JSON.stringify(stack), repoId]
      );

      return stack;
    } catch (error) {
      console.error('Detect stack error:', error);
      throw new Error('Failed to detect tech stack');
    }
  }
}
