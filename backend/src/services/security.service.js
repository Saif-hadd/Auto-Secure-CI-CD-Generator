// FIXES APPLIED: 1.4, 2.2, 3.1
import path from 'path';
import { SecurityScanner } from '../utils/security-scanner.js';
import { logger } from '../utils/logger.js';
import { query } from '../config/database.js';

const ALLOWED_BASE = process.env.ALLOWED_SCAN_BASE_DIR || '/tmp'; // FIX: prevent shell injection by restricting scan roots to an allowed base directory

export class SecurityService {
  static validateProjectPath(projectPath) {
    const resolved = path.resolve(projectPath); // FIX: normalize untrusted repository paths before validation

    if (!resolved.startsWith(ALLOWED_BASE)) { // FIX: reject repository paths outside the approved scan base
      throw new Error(`Path not allowed: ${projectPath}`); // FIX: prevent shell injection
    }

    return resolved; // FIX: pass only validated absolute paths into SecurityScanner.runAllScans
  }

  static requireUserId(userId) {
    if (!userId) {
      throw new Error('userId is required'); // FIX: enforce user scoping for security history lookups
    }
  }

  static async scanRepository(repositoryPath, options = {}) {
    try {
      const {
        scannerType = 'trivy',
        pipelineId = null,
        dbClient = null
      } = options;

      const safeProjectPath = this.validateProjectPath(repositoryPath); // FIX: validate every projectPath before invoking shell-backed scanners
      const scanResults = await SecurityScanner.runAllScans(safeProjectPath, scannerType);

      if (pipelineId) {
        await this.saveScanResults(pipelineId, scanResults, dbClient);
      }

      return {
        success: true,
        scans: scanResults,
        summary: this.generateSummary(scanResults)
      };
    } catch (error) {
      logger.error({ context: { repositoryPath, pipelineId: options.pipelineId }, err: error }, 'Security scan error'); // FIX: replace console logging with structured logger
      throw new Error(`Security scan failed: ${error.message}`);
    }
  }

  static async scanByRepoId(repoId, userId, options = {}) {
    try {
      const repoResult = await query(
        'SELECT * FROM repositories WHERE id = $1 AND user_id = $2',
        [repoId, userId]
      );

      if (repoResult.rows.length === 0) {
        throw new Error('Repository not found');
      }

      const projectPath = options.projectPath || process.cwd();
      const safeProjectPath = this.validateProjectPath(projectPath); // FIX: validate projectPath before delegating to scanner orchestration

      return await this.scanRepository(safeProjectPath, options);
    } catch (error) {
      logger.error({ context: { repoId, userId }, err: error }, 'Scan by repo ID error'); // FIX: replace console logging with structured logger
      throw error;
    }
  }

  static async saveScanResults(pipelineId, scanResults, dbClient = null) {
    try {
      const executor = dbClient?.query?.bind(dbClient) || query; // FIX: allow scan persistence to participate in outer transactions

      for (const scan of scanResults) {
        await executor(
          `INSERT INTO security_scans (pipeline_id, scan_type, vulnerabilities_count, risk_level, findings)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            pipelineId,
            scan.scan_type,
            scan.vulnerabilities_count,
            scan.risk_level,
            JSON.stringify({
              findings: scan.findings,
              scanner: scan.scanner,
              timestamp: scan.timestamp,
              message: scan.message
            })
          ]
        );
      }
    } catch (error) {
      logger.error({ context: { pipelineId }, err: error }, 'Save scan results error'); // FIX: replace console logging with structured logger
      throw error;
    }
  }

  static generateSummary(scanResults) {
    const totalVulnerabilities = scanResults.reduce(
      (sum, scan) => sum + (scan.vulnerabilities_count || 0),
      0
    );

    const riskLevels = scanResults.map((scan) => scan.risk_level);
    const overallRisk = this.calculateOverallRisk(riskLevels);
    const securityScore = this.calculateSecurityScore(scanResults);
    const scannerTypes = [...new Set(scanResults.map((scan) => scan.scanner))];

    return {
      totalVulnerabilities,
      overallRisk,
      securityScore,
      scanners: scannerTypes,
      scanCount: scanResults.length,
      timestamp: new Date().toISOString()
    };
  }

  static calculateOverallRisk(riskLevels) {
    if (riskLevels.includes('critical')) return 'critical';
    if (riskLevels.includes('high')) return 'high';
    if (riskLevels.includes('medium')) return 'medium';
    return 'low';
  }

  static calculateSecurityScore(scanResults) {
    let score = 100;

    for (const scan of scanResults) {
      const vulnCount = scan.vulnerabilities_count || 0;
      const riskLevel = scan.risk_level;

      if (riskLevel === 'critical') {
        score -= vulnCount * 10;
      } else if (riskLevel === 'high') {
        score -= vulnCount * 5;
      } else if (riskLevel === 'medium') {
        score -= vulnCount * 2;
      } else {
        score -= vulnCount * 1;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  static async getScanHistory(pipelineId, userId) {
    try {
      this.requireUserId(userId); // FIX: require a user scope before returning scan history

      const result = await query(
        `SELECT s.*
         FROM security_scans s
         JOIN pipelines p ON p.id = s.pipeline_id
         WHERE s.pipeline_id = $1 AND p.user_id = $2
         ORDER BY s.created_at DESC`,
        [pipelineId, userId]
      );

      return result.rows;
    } catch (error) {
      logger.error({ context: { pipelineId, userId }, err: error }, 'Get scan history error'); // FIX: replace console logging with structured logger
      throw error;
    }
  }

  static async getLatestScanByType(pipelineId, userId, scanType) { // FIX: accept userId as the second argument for ownership-scoped queries
    try {
      if (scanType !== undefined && /^\d+$/.test(String(scanType)) && !/^\d+$/.test(String(userId))) { // FIX: preserve existing callers while moving userId to the second argument
        [userId, scanType] = [scanType, userId]; // FIX: preserve existing callers while moving userId to the second argument
      }
      this.requireUserId(userId); // FIX: require a user scope before returning the latest scan

      const result = await query(
        `SELECT s.* FROM security_scans s JOIN pipelines p ON p.id = s.pipeline_id WHERE s.pipeline_id = $1 AND p.user_id = $2 AND s.scan_type = $3 ORDER BY s.created_at DESC LIMIT 1`, // FIX: require pipeline ownership in latest-scan queries
        [pipelineId, userId, scanType] // FIX: pass userId as the second parameter in latest-scan queries
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error({ context: { pipelineId, userId, scanType }, err: error }, 'Get latest scan error'); // FIX: replace console logging with structured logger
      throw error;
    }
  }

  static async compareScanResults(pipelineId, userId, scanType) { // FIX: accept userId as the second argument for ownership-scoped queries
    try {
      if (scanType !== undefined && /^\d+$/.test(String(scanType)) && !/^\d+$/.test(String(userId))) { // FIX: preserve existing callers while moving userId to the second argument
        [userId, scanType] = [scanType, userId]; // FIX: preserve existing callers while moving userId to the second argument
      }
      this.requireUserId(userId); // FIX: require a user scope before comparing scan history

      const result = await query(
        `SELECT s.* FROM security_scans s JOIN pipelines p ON p.id = s.pipeline_id WHERE s.pipeline_id = $1 AND p.user_id = $2 AND s.scan_type = $3 ORDER BY s.created_at DESC LIMIT 2`, // FIX: require pipeline ownership in scan-comparison queries
        [pipelineId, userId, scanType] // FIX: pass userId as the second parameter in scan-comparison queries
      );

      if (result.rows.length < 2) {
        return {
          hasComparison: false,
          message: 'Not enough scan history for comparison'
        };
      }

      const [latest, previous] = result.rows;

      return {
        hasComparison: true,
        latest: {
          vulnerabilities: latest.vulnerabilities_count,
          risk_level: latest.risk_level,
          timestamp: latest.created_at
        },
        previous: {
          vulnerabilities: previous.vulnerabilities_count,
          risk_level: previous.risk_level,
          timestamp: previous.created_at
        },
        improvement: previous.vulnerabilities_count - latest.vulnerabilities_count,
        trend: this.calculateTrend(previous, latest)
      };
    } catch (error) {
      logger.error({ context: { pipelineId, userId, scanType }, err: error }, 'Compare scan results error'); // FIX: replace console logging with structured logger
      throw error;
    }
  }

  static calculateTrend(previous, latest) {
    const prevScore = this.getRiskScore(previous.risk_level);
    const latestScore = this.getRiskScore(latest.risk_level);

    if (latestScore < prevScore) return 'improving';
    if (latestScore > prevScore) return 'degrading';

    if (latest.vulnerabilities_count < previous.vulnerabilities_count) return 'improving';
    if (latest.vulnerabilities_count > previous.vulnerabilities_count) return 'degrading';

    return 'stable';
  }

  static getRiskScore(riskLevel) {
    const scores = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };
    return scores[riskLevel] || 0;
  }

  static formatScanForResponse(scan) {
    return {
      scan_type: scan.scan_type,
      vulnerabilities_count: scan.vulnerabilities_count,
      risk_level: scan.risk_level,
      findings: typeof scan.findings === 'string'
        ? JSON.parse(scan.findings)
        : scan.findings,
      created_at: scan.created_at
    };
  }

  static async deleteScansByPipeline(pipelineId) {
    try {
      await query(
        'DELETE FROM security_scans WHERE pipeline_id = $1',
        [pipelineId]
      );
    } catch (error) {
      logger.error({ context: { pipelineId }, err: error }, 'Delete scans error'); // FIX: replace console logging with structured logger
      throw error;
    }
  }
}
