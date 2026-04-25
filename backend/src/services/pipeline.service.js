// FIXES APPLIED: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 3.1
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { getClient, query } from '../config/database.js';
import { RepoService } from './repo.service.js';
import { YAMLGenerator } from '../utils/yaml-generator.js';
import { SecurityService } from './security.service.js';
import { RemediationService } from './remediation.service.js';
import { StackDetector } from '../utils/stack-detector.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export class PipelineService {
  static async removeTempRepo(tempRepoPath, context = {}) {
    if (!tempRepoPath || !fs.existsSync(tempRepoPath)) {
      return;
    }

    try {
      await fs.promises.rm(tempRepoPath, { recursive: true, force: true }); // FIX: remove temporary repositories without invoking a shell command
      logger.info({ context: { ...context, tempRepoPath } }, 'Temporary repository deleted'); // FIX: replace console logging with structured logger
    } catch (error) {
      logger.error({ context: { ...context, tempRepoPath }, err: error }, 'Temporary repository cleanup failed'); // FIX: replace console logging with structured logger
    }
  }

  static async generatePipeline(repoId, userId, pipelineType, options = {}) {
    const activeScans = await query(`SELECT COUNT(*) FROM pipelines WHERE user_id = $1 AND status = 'scanning'`, [userId]); // FIX: basic rate guard until express-rate-limit is added
    if (parseInt(activeScans.rows[0].count) >= 3) { // FIX: basic rate guard until express-rate-limit is added
      throw new Error('Too many active scans. Max 3 concurrent scans per user.'); // FIX: basic rate guard until express-rate-limit is added
    }

    let tempRepoPath = null;
    let pipeline = null;
    let scanResult = null;

    try {
      const repository = await RepoService.getRepositoryById(repoId, userId);

      if (!repository) {
        throw new Error('Repository not found');
      }

      // TODO: ENCRYPT — access_token must be encrypted with AES-256-GCM // FIX: token encryption placeholder for plaintext DB reads
      // before production. Use a KMS key or a TOKEN_ENCRYPTION_KEY env var. // FIX: token encryption placeholder for plaintext DB reads
      // Decrypt here before use, encrypt before INSERT/UPDATE. // FIX: token encryption placeholder for plaintext DB reads
      const userResult = await query( // FIX: access_token is still being read from the database in plaintext
        'SELECT access_token FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const token = userResult.rows[0].access_token; // TODO: ENCRYPT access_token with AES-256-GCM before using plaintext DB values in production // FIX: mark plaintext token handling for remediation

      let stack = null;

      try {
        if (!/^\d+$/.test(String(repoId))) { // FIX: validate repoId before using it in a filesystem path
          throw new Error('Invalid repoId'); // FIX: prevent path traversal
        }
        tempRepoPath = path.join('/tmp', `repo_${repoId}_${Date.now()}`); // FIX: constrain temporary repositories to a controlled base directory

        await execFileAsync(
          'git',
          ['clone', '--depth=1', `https://oauth2:${token}@github.com/${repository.repo_full_name}.git`, tempRepoPath], // FIX: use execFile arguments instead of a shell-interpolated clone command
          { timeout: 60000 }
        );

        logger.info({ context: { repoId, userId, tempRepoPath } }, 'Repository cloned for pipeline generation'); // FIX: replace console logging with structured logger

        stack = await StackDetector.detectFromLocal(tempRepoPath);
        logger.info(
          { context: { repoId, userId, stackType: stack?.type, framework: stack?.framework } },
          'Repository stack detected'
        ); // FIX: replace console logging with structured logger
      } catch (cloneError) {
        logger.error(
          { context: { repoId, userId }, err: cloneError },
          'Repository clone failed; falling back to stored metadata'
        ); // FIX: replace console logging with structured logger

        stack = repository.stack_detected;

        if (!stack || stack.type === 'unknown') {
          stack = await RepoService.detectTechStack(repoId, userId, token);
        }
      }

      const generatedYAML = YAMLGenerator.generate(stack, pipelineType);
      const securityFeatures = this.extractSecurityFeatures(generatedYAML);
      const projectPath = tempRepoPath || options.projectPath || process.cwd();
      const scannerType = options.scannerType || 'trivy';

      const client = await getClient();

      try {
        await client.query('BEGIN'); // FIX: wrap pipeline creation and initial scan persistence in a single transaction

        const pipelineResult = await client.query(
          `INSERT INTO pipelines (repo_id, user_id, pipeline_type, generated_yaml, security_features, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [repoId, userId, pipelineType, generatedYAML, JSON.stringify(securityFeatures), 'draft']
        );

        pipeline = pipelineResult.rows[0];

        scanResult = await SecurityService.scanRepository(projectPath, {
          scannerType,
          pipelineId: pipeline.id,
          userId,
          dbClient: client // FIX: save scan results within the same transaction as the pipeline insert
        });

        await client.query('COMMIT'); // FIX: commit only after the pipeline and initial scan state are both persisted
      } catch (error) {
        await client.query('ROLLBACK'); // FIX: ensure partial pipeline records are not left behind when the initial scan fails
        throw error;
      } finally {
        client.release();
      }

      logger.info(
        {
          context: {
            repoId,
            userId,
            pipelineId: pipeline.id,
            totalVulnerabilities: scanResult.summary.totalVulnerabilities
          }
        },
        'Security scan completed for generated pipeline'
      ); // FIX: replace console logging with structured logger

      if (options.autoRemediate && scanResult.summary.totalVulnerabilities > 0) {
        try {
          const remediationResult = await RemediationService.runAutoRemediation(
            pipeline.id,
            userId,
            token,
            projectPath
          );

          logger.info(
            { context: { repoId, userId, pipelineId: pipeline.id, prCreated: remediationResult.pr_created } },
            'Auto-remediation completed'
          ); // FIX: replace console logging with structured logger
        } catch (remediationError) {
          logger.error(
            { context: { repoId, userId, pipelineId: pipeline.id }, err: remediationError },
            'Auto-remediation failed'
          ); // FIX: replace console logging with structured logger
        }
      }

      return pipeline;
    } catch (error) {
      logger.error({ context: { repoId, userId }, err: error }, 'Generate pipeline error'); // FIX: replace console logging with structured logger
      throw error;
    } finally {
      await this.removeTempRepo(tempRepoPath, { repoId, userId });
    }
  }

  static extractSecurityFeatures(yaml) {
    const features = [];
    if (yaml.includes('SAST')) features.push('SAST');
    if (yaml.includes('DAST')) features.push('DAST');
    if (yaml.includes('Secrets')) features.push('Secrets Scanning');
    if (yaml.includes('Dependencies')) features.push('Dependency Scanning');
    return features;
  }

  static async runSecurityScan(pipelineId, projectPath, scannerType = 'trivy') {
    try {
      return await SecurityService.scanRepository(projectPath, {
        scannerType,
        pipelineId
      });
    } catch (error) {
      logger.error({ context: { pipelineId, projectPath, scannerType }, err: error }, 'Run security scan error'); // FIX: replace console logging with structured logger
      throw error;
    }
  }

  static async getPipelinesByRepo(repoId, userId) {
    const result = await query(
      'SELECT * FROM pipelines WHERE repo_id = $1 AND user_id = $2 ORDER BY created_at DESC',
      [repoId, userId]
    );
    return result.rows;
  }

  static async pushToGitHub(pipelineId, userId) {
    // TODO: ENCRYPT — access_token must be encrypted with AES-256-GCM // FIX: token encryption placeholder for plaintext DB reads
    // before production. Use a KMS key or a TOKEN_ENCRYPTION_KEY env var. // FIX: token encryption placeholder for plaintext DB reads
    // Decrypt here before use, encrypt before INSERT/UPDATE. // FIX: token encryption placeholder for plaintext DB reads
    const userResult = await query( // FIX: access_token is still being read from the database in plaintext
      'SELECT access_token FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const token = userResult.rows[0].access_token; // TODO: ENCRYPT access_token with AES-256-GCM before using plaintext DB values in production // FIX: mark plaintext token handling for remediation

    if (!token) {
      throw new Error('Access token missing - user must re-authenticate');
    }

    try {
      const pipelineResult = await query(
        `SELECT p.*, r.*
         FROM pipelines p
         JOIN repositories r ON p.repo_id = r.id
         WHERE p.id = $1 AND p.user_id = $2`,
        [pipelineId, userId]
      );

      if (pipelineResult.rows.length === 0) {
        throw new Error('Pipeline not found');
      }

      const row = pipelineResult.rows[0];

      const repo = {
        repo_full_name: row.repo_full_name,
        default_branch: row.default_branch,
        repo_url: row.repo_url
      };

      logger.info(
        { context: { pipelineId, userId, repoFullName: repo.repo_full_name, branch: repo.default_branch } },
        'Preparing to push generated workflow to GitHub'
      ); // FIX: replace console logging with structured logger

      const filePath = '.github/workflows/secure-pipeline.yml';
      const content = Buffer.from(row.generated_yaml).toString('base64');
      let sha = null;

      try {
        const existing = await axios.get(
          `https://api.github.com/repos/${repo.repo_full_name}/contents/${filePath}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json'
            },
            timeout: 15000 // FIX: bound GitHub API calls so pipeline pushes cannot hang indefinitely
          }
        );
        sha = existing.data.sha;
        logger.info({ context: { pipelineId, userId, sha } }, 'Existing workflow found; updating file'); // FIX: replace console logging with structured logger
      } catch (error) {
        if (error.response?.status === 404) {
          logger.info({ context: { pipelineId, userId, filePath } }, 'Workflow file not found; creating new file'); // FIX: replace console logging with structured logger
        } else {
          throw error;
        }
      }

      const payload = {
        message: sha ? 'Update secure CI/CD pipeline' : 'Add secure CI/CD pipeline',
        content,
        branch: repo.default_branch,
        ...(sha ? { sha } : {})
      };

      const putResponse = await axios.put(
        `https://api.github.com/repos/${repo.repo_full_name}/contents/${filePath}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json'
          },
          timeout: 15000 // FIX: bound GitHub API calls so pipeline pushes cannot hang indefinitely
        }
      );

      logger.info({ context: { pipelineId, userId, status: putResponse.status } }, 'Workflow pushed to GitHub'); // FIX: replace console logging with structured logger

      await query(
        'UPDATE pipelines SET status = $1, pushed_at = NOW() WHERE id = $2',
        ['pushed', pipelineId]
      );

      return {
        success: true,
        message: 'Pipeline pushed to GitHub successfully',
        url: `${repo.repo_url}/blob/${repo.default_branch}/${filePath}`
      };
    } catch (error) {
      logger.error(
        { context: { pipelineId, userId }, err: error.response?.data || error },
        'Push to GitHub error'
      ); // FIX: replace console logging with structured logger
      throw new Error('Failed to push pipeline to GitHub');
    }
  }

  static async getSecurityDashboard(pipelineId, userId) {
    try {
      const pipelineResult = await query(
        'SELECT * FROM pipelines WHERE id = $1 AND user_id = $2',
        [pipelineId, userId]
      );

      if (pipelineResult.rows.length === 0) {
        throw new Error('Pipeline not found');
      }

      const pipeline = pipelineResult.rows[0];
      const scans = await SecurityService.getScanHistory(pipelineId, userId); // FIX: reuse ownership-aware scan history retrieval
      const totalVulnerabilities = scans.reduce((sum, scan) => sum + scan.vulnerabilities_count, 0);

      const riskLevels = scans.map((scan) => scan.risk_level);
      const overallRisk = riskLevels.includes('critical')
        ? 'critical'
        : riskLevels.includes('high')
          ? 'high'
          : riskLevels.includes('medium')
            ? 'medium'
            : 'low';

      const suggestions = this.generateSuggestions(scans);

      return {
        pipeline,
        scans,
        summary: {
          totalVulnerabilities,
          overallRisk,
          securityScore: SecurityService.calculateSecurityScore(scans) // FIX: reuse the severity-weighted security score calculation instead of duplicating a flat formula
        },
        suggestions
      };
    } catch (error) {
      logger.error({ context: { pipelineId, userId }, err: error }, 'Get security dashboard error'); // FIX: replace console logging with structured logger
      throw error;
    }
  }

  static generateSuggestions(scans) {
    const suggestions = [];

    scans.forEach((scan) => {
      if (scan.vulnerabilities_count > 0) {
        suggestions.push({
          type: scan.scan_type,
          message: `Found ${scan.vulnerabilities_count} issues in ${scan.scan_type} scan`,
          severity: scan.risk_level,
          action: `Review and fix ${scan.scan_type} vulnerabilities`
        });
      }
    });

    if (suggestions.length === 0) {
      suggestions.push({
        type: 'success',
        message: 'No security issues detected',
        severity: 'low',
        action: 'Continue monitoring'
      });
    }

    return suggestions;
  }
}
