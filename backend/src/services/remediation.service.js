// FIXES APPLIED: 1.8, 2.2, 2.3, 3.1
import axios from 'axios';
import { query } from '../config/database.js';
import { AutoFixer } from '../utils/auto-fixer.js';
import { SecurityService } from './security.service.js';
import { AuthService } from './auth.service.js';
import { logger } from '../utils/logger.js';

export class RemediationService {
  static async runAutoRemediation(pipelineId, userId, projectPath) {
    try {
      const accessToken = await AuthService.getGitHubAccessTokenForUser(userId);
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
      const repository = {
        id: row.repo_id,
        repo_full_name: row.repo_full_name,
        default_branch: row.default_branch,
        repo_url: row.repo_url
      };

      const scanHistory = await SecurityService.getScanHistory(pipelineId, userId); // FIX: enforce resource ownership when loading scan history for remediation

      if (scanHistory.length === 0) {
        return {
          success: false,
          message: 'No security scans found. Run a security scan first.'
        };
      }

      const scanResults = scanHistory.map((scan) => ({
        scan_type: scan.scan_type,
        vulnerabilities_count: scan.vulnerabilities_count,
        risk_level: scan.risk_level,
        findings: typeof scan.findings === 'string'
          ? JSON.parse(scan.findings).findings
          : scan.findings.findings || scan.findings
      }));

      const fixes = await AutoFixer.fixVulnerabilities(scanResults, projectPath);

      if (fixes.files_updated.length === 0) {
        return {
          success: false,
          message: 'No fixable vulnerabilities found',
          fixes
        };
      }

      const securityDashboard = await this.getSecurityScore(pipelineId, userId); // FIX: enforce resource ownership when calculating remediation security score
      const prDescription = AutoFixer.generatePRDescription(
        fixes.changes,
        securityDashboard?.summary?.securityScore
      );

      const prResult = await this.createRemediationPR(
        repository,
        fixes,
        accessToken,
        prDescription
      );

      await this.saveRemediationResult(pipelineId, fixes, prResult);

      return {
        success: true,
        files_updated: fixes.files_updated,
        changes: fixes.changes,
        pr_created: prResult.success,
        pr_url: prResult.pr_url,
        pr_number: prResult.pr_number,
        message: prResult.success
          ? `Successfully created PR #${prResult.pr_number}`
          : 'Fixes prepared but PR creation failed'
      };
    } catch (error) {
      logger.error({ context: { pipelineId, userId }, err: error }, 'Auto-remediation error'); // FIX: replace console logging with structured logger
      throw new Error(`Auto-remediation failed: ${error.message}`);
    }
  }

  static async createRemediationPR(repository, fixes, accessToken, prDescription) {
    try {
      const branchName = `fix/auto-remediate-${Date.now()}`;
      const baseBranch = repository.default_branch;

      const baseRefResponse = await axios.get(
        `https://api.github.com/repos/${repository.repo_full_name}/git/ref/heads/${baseBranch}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000 // FIX: bound GitHub API calls so remediation does not hang indefinitely
        }
      );

      const baseSha = baseRefResponse.data.object.sha;

      await axios.post(
        `https://api.github.com/repos/${repository.repo_full_name}/git/refs`,
        {
          ref: `refs/heads/${branchName}`,
          sha: baseSha
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000 // FIX: bound GitHub API calls so remediation does not hang indefinitely
        }
      );

      const filesToCommit = [];

      if (Array.isArray(fixes.packageJsonFiles) && fixes.packageJsonFiles.length > 0) {
        filesToCommit.push(...fixes.packageJsonFiles); // FIX: support committing multiple package.json files for monorepo remediations
      } else if (fixes.packageJsonContent) {
        filesToCommit.push({
          path: 'package.json',
          content: fixes.packageJsonContent
        });
      }

      if (fixes.dockerfileContent) {
        filesToCommit.push({
          path: 'Dockerfile',
          content: fixes.dockerfileContent
        });
      }

      for (const file of filesToCommit) {
        const content = Buffer.from(file.content).toString('base64');

        try {
          const existingFileResponse = await axios.get(
            `https://api.github.com/repos/${repository.repo_full_name}/contents/${file.path}?ref=${branchName}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 15000 // FIX: bound GitHub API calls so remediation does not hang indefinitely
            }
          );

          await axios.put(
            `https://api.github.com/repos/${repository.repo_full_name}/contents/${file.path}`,
            {
              message: `fix: auto-remediate security vulnerabilities in ${file.path}`,
              content,
              sha: existingFileResponse.data.sha,
              branch: branchName
            },
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 15000 // FIX: bound GitHub API calls so remediation does not hang indefinitely
            }
          );
        } catch (error) {
          if (error.response?.status === 404) {
            await axios.put(
              `https://api.github.com/repos/${repository.repo_full_name}/contents/${file.path}`,
              {
                message: `fix: auto-remediate security vulnerabilities in ${file.path}`,
                content,
                branch: branchName
              },
              {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 15000 // FIX: bound GitHub API calls so remediation does not hang indefinitely
              }
            );
          } else {
            throw error;
          }
        }
      }

      const prResponse = await axios.post(
        `https://api.github.com/repos/${repository.repo_full_name}/pulls`,
        {
          title: 'fix: auto-remediate security vulnerabilities',
          head: branchName,
          base: baseBranch,
          body: prDescription,
          maintainer_can_modify: true
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000 // FIX: bound GitHub API calls so remediation does not hang indefinitely
        }
      );

      return {
        success: true,
        pr_url: prResponse.data.html_url,
        pr_number: prResponse.data.number,
        branch_name: branchName
      };
    } catch (error) {
      logger.error(
        { context: { repoFullName: repository.repo_full_name }, err: error.response?.data || error },
        'Create remediation PR error'
      ); // FIX: replace console logging with structured logger
      return {
        success: false,
        error: error.message,
        pr_url: null,
        pr_number: null
      };
    }
  }

  static async saveRemediationResult(pipelineId, fixes, prResult) {
    try {
      await query(
        `INSERT INTO remediations (
          pipeline_id,
          files_updated,
          changes,
          pr_created,
          pr_url,
          pr_number,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          pipelineId,
          JSON.stringify(fixes.files_updated),
          JSON.stringify(fixes.changes),
          prResult.success,
          prResult.pr_url,
          prResult.pr_number,
          prResult.success ? 'completed' : 'failed'
        ]
      );
    } catch (error) {
      logger.error({ context: { pipelineId }, err: error }, 'Save remediation result error'); // FIX: replace console logging with structured logger
    }
  }

  static async getRemediationHistory(pipelineId, userId) {
    try {
      const result = await query(
        `SELECT r.*
         FROM remediations r
         JOIN pipelines p ON p.id = r.pipeline_id
         WHERE r.pipeline_id = $1 AND p.user_id = $2
         ORDER BY r.created_at DESC`,
        [pipelineId, userId]
      ); // FIX: scope remediation history to the owning user

      return result.rows.map((row) => ({
        id: row.id,
        files_updated: row.files_updated,
        changes: row.changes,
        pr_created: row.pr_created,
        pr_url: row.pr_url,
        pr_number: row.pr_number,
        status: row.status,
        created_at: row.created_at
      }));
    } catch (error) {
      logger.error({ context: { pipelineId, userId }, err: error }, 'Get remediation history error'); // FIX: replace console logging with structured logger
      return [];
    }
  }

  static async getLatestRemediation(pipelineId, userId) {
    try {
      const result = await query(
        `SELECT r.*
         FROM remediations r
         JOIN pipelines p ON p.id = r.pipeline_id
         WHERE r.pipeline_id = $1 AND p.user_id = $2
         ORDER BY r.created_at DESC
         LIMIT 1`,
        [pipelineId, userId]
      ); // FIX: scope remediation lookups to the owning user

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        files_updated: row.files_updated,
        changes: row.changes,
        pr_created: row.pr_created,
        pr_url: row.pr_url,
        pr_number: row.pr_number,
        status: row.status,
        created_at: row.created_at
      };
    } catch (error) {
      logger.error({ context: { pipelineId, userId }, err: error }, 'Get latest remediation error'); // FIX: replace console logging with structured logger
      return null;
    }
  }

  static async getSecurityScore(pipelineId, userId) {
    try {
      const result = await query(
        'SELECT * FROM pipelines WHERE id = $1 AND user_id = $2',
        [pipelineId, userId]
      ); // FIX: scope security score lookups to the owning user

      if (result.rows.length === 0) {
        return null;
      }

      const scansResult = await query(
        `SELECT s.*
         FROM security_scans s
         JOIN pipelines p ON p.id = s.pipeline_id
         WHERE s.pipeline_id = $1 AND p.user_id = $2`,
        [pipelineId, userId]
      ); // FIX: scope scan aggregation to the owning user

      const scans = scansResult.rows;
      const totalVulnerabilities = scans.reduce((sum, scan) => sum + scan.vulnerabilities_count, 0);

      return {
        summary: {
          totalVulnerabilities,
          securityScore: SecurityService.calculateSecurityScore(scans) // FIX: reuse the severity-weighted security score calculation instead of duplicating a flat formula
        }
      };
    } catch (error) {
      logger.error({ context: { pipelineId, userId }, err: error }, 'Get security score error'); // FIX: replace console logging with structured logger
      return null;
    }
  }
}
