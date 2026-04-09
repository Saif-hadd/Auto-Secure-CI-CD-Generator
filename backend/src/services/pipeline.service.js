import { query } from '../config/database.js';
import { RepoService } from './repo.service.js';
import { YAMLGenerator } from '../utils/yaml-generator.js';
import { SecurityService } from './security.service.js';
import { RemediationService } from './remediation.service.js';
import { StackDetector } from '../utils/stack-detector.js';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export class PipelineService {
  static async generatePipeline(repoId, userId, pipelineType, options = {}) {
    let tempRepoPath = null;

    try {
      const repository = await RepoService.getRepositoryById(repoId, userId);

      if (!repository) {
        throw new Error('Repository not found');
      }

      // ✅ ÉTAPE 1 — Récupérer le token une seule fois
      const userResult = await query(
        'SELECT access_token FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const token = userResult.rows[0].access_token;

      // ✅ ÉTAPE 2 — Cloner le repo en premier
      let stack = null;

      try {
        tempRepoPath = `/tmp/repo_${repoId}_${Date.now()}`;

        await execAsync(
          `git clone --depth=1 https://oauth2:${token}@github.com/${repository.repo_full_name}.git ${tempRepoPath}`,
          { timeout: 60000 }
        );

        console.log(`✅ Repo cloned: ${tempRepoPath}`);

        // ✅ ÉTAPE 3 — Détecter le stack depuis le clone local
        stack = await StackDetector.detectFromLocal(tempRepoPath);
        console.log(`✅ Stack detected: ${stack.type} / ${stack.framework}`);

      } catch (cloneError) {
        console.error('❌ Clone failed, fallback to DB/API:', cloneError.message);

        // Fallback — stack depuis la DB ou GitHub API
        stack = repository.stack_detected;

        if (!stack || stack.type === 'unknown') {
          stack = await RepoService.detectTechStack(repoId, userId, token);
        }
      }

      // ✅ ÉTAPE 4 — Générer le YAML avec le bon stack détecté
      const generatedYAML = YAMLGenerator.generate(stack, pipelineType);
      const securityFeatures = this.extractSecurityFeatures(generatedYAML);

      // ✅ ÉTAPE 5 — Sauvegarder en DB
      const pipelineResult = await query(
        `INSERT INTO pipelines (repo_id, user_id, pipeline_type, generated_yaml, security_features, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [repoId, userId, pipelineType, generatedYAML, JSON.stringify(securityFeatures), 'draft']
      );

      const pipeline = pipelineResult.rows[0];

      // ✅ ÉTAPE 6 — Scanner le repo cloné (ou cwd en fallback)
      const projectPath = tempRepoPath || options.projectPath || process.cwd();
      const scannerType = options.scannerType || 'trivy';

      try {
        const scanResult = await SecurityService.scanRepository(projectPath, {
          scannerType,
          pipelineId: pipeline.id
        });

        console.log('Security scan completed:', scanResult.summary);

        // Auto-remediation si activée
        if (options.autoRemediate && scanResult.summary.totalVulnerabilities > 0) {
          try {
            const remediationResult = await RemediationService.runAutoRemediation(
              pipeline.id,
              userId,
              token,
              projectPath
            );
            console.log('Auto-remediation completed:', remediationResult);
          } catch (remediationError) {
            console.error('Auto-remediation failed:', remediationError);
          }
        }

      } catch (scanError) {
        console.error('Security scan failed, using fallback:', scanError.message);
      }

      // ✅ ÉTAPE 7 — Cleanup du dossier temporaire
      if (tempRepoPath && fs.existsSync(tempRepoPath)) {
        try {
          await execAsync(`rm -rf ${tempRepoPath}`);
          console.log('🧹 Temp repo deleted');
        } catch (cleanError) {
          console.error('Cleanup failed:', cleanError.message);
        }
      }

      return pipeline;

    } catch (error) {
      // ✅ Cleanup en cas d'erreur aussi
      if (tempRepoPath && fs.existsSync(tempRepoPath)) {
        try {
          await execAsync(`rm -rf ${tempRepoPath}`);
        } catch (cleanError) {
          console.error('Cleanup failed:', cleanError.message);
        }
      }

      console.error('Generate pipeline error:', error);
      throw error;
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
      const scanResult = await SecurityService.scanRepository(projectPath, {
        scannerType,
        pipelineId
      });
      return scanResult;
    } catch (error) {
      console.error('Run security scan error:', error);
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

  static async pushToGitHub(pipelineId, userId, accessToken) {
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

      const content = Buffer.from(row.generated_yaml).toString('base64');

      try {
        const { data: existingFile } = await axios.get(
          `https://api.github.com/repos/${repo.repo_full_name}/contents/.github/workflows/secure-pipeline.yml`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        await axios.put(
          `https://api.github.com/repos/${repo.repo_full_name}/contents/.github/workflows/secure-pipeline.yml`,
          {
            message: 'Update secure CI/CD pipeline',
            content,
            sha: existingFile.sha,
            branch: repo.default_branch
          },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
      } catch (error) {
        if (error.response?.status === 404) {
          await axios.put(
            `https://api.github.com/repos/${repo.repo_full_name}/contents/.github/workflows/secure-pipeline.yml`,
            {
              message: 'Add secure CI/CD pipeline',
              content,
              branch: repo.default_branch
            },
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
        } else {
          throw error;
        }
      }

      await query(
        'UPDATE pipelines SET status = $1, pushed_at = NOW() WHERE id = $2',
        ['pushed', pipelineId]
      );

      return {
        success: true,
        message: 'Pipeline pushed to GitHub successfully',
        url: `${repo.repo_url}/blob/${repo.default_branch}/.github/workflows/secure-pipeline.yml`
      };
    } catch (error) {
      console.error('Push to GitHub error:', error);
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

      const scansResult = await query(
        'SELECT * FROM security_scans WHERE pipeline_id = $1',
        [pipelineId]
      );

      const scans = scansResult.rows;
      const totalVulnerabilities = scans.reduce((sum, scan) => sum + scan.vulnerabilities_count, 0);

      const riskLevels = scans.map(s => s.risk_level);
      const overallRisk = riskLevels.includes('critical') ? 'critical' :
                          riskLevels.includes('high') ? 'high' :
                          riskLevels.includes('medium') ? 'medium' : 'low';

      const suggestions = this.generateSuggestions(scans);

      return {
        pipeline,
        scans,
        summary: {
          totalVulnerabilities,
          overallRisk,
          securityScore: Math.max(0, 100 - totalVulnerabilities * 5)
        },
        suggestions
      };
    } catch (error) {
      console.error('Get security dashboard error:', error);
      throw error;
    }
  }

  static generateSuggestions(scans) {
    const suggestions = [];

    scans.forEach(scan => {
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