import { SecurityScanner } from '../utils/security-scanner.js';
import { query } from '../config/database.js';

export class SecurityService {
  static async scanRepository(repositoryPath, options = {}) {
    try {
      const {
        scannerType = 'trivy',
        pipelineId = null
      } = options;

      const scanResults = await SecurityScanner.runAllScans(repositoryPath, scannerType);

      if (pipelineId) {
        await this.saveScanResults(pipelineId, scanResults);
      }

      return {
        success: true,
        scans: scanResults,
        summary: this.generateSummary(scanResults)
      };
    } catch (error) {
      console.error('Security scan error:', error);
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

      const repository = repoResult.rows[0];
      const projectPath = options.projectPath || process.cwd();

      return await this.scanRepository(projectPath, options);
    } catch (error) {
      console.error('Scan by repo ID error:', error);
      throw error;
    }
  }

  static async saveScanResults(pipelineId, scanResults) {
    try {
      for (const scan of scanResults) {
        await query(
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
      console.error('Save scan results error:', error);
      throw error;
    }
  }

  static generateSummary(scanResults) {
    const totalVulnerabilities = scanResults.reduce(
      (sum, scan) => sum + (scan.vulnerabilities_count || 0),
      0
    );

    const riskLevels = scanResults.map(scan => scan.risk_level);
    const overallRisk = this.calculateOverallRisk(riskLevels);

    const securityScore = this.calculateSecurityScore(scanResults);

    const scannerTypes = [...new Set(scanResults.map(scan => scan.scanner))];

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

  static async getScanHistory(pipelineId) {
    try {
      const result = await query(
        'SELECT * FROM security_scans WHERE pipeline_id = $1 ORDER BY created_at DESC',
        [pipelineId]
      );

      return result.rows;
    } catch (error) {
      console.error('Get scan history error:', error);
      throw error;
    }
  }

  static async getLatestScanByType(pipelineId, scanType) {
    try {
      const result = await query(
        `SELECT * FROM security_scans
         WHERE pipeline_id = $1 AND scan_type = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [pipelineId, scanType]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Get latest scan error:', error);
      throw error;
    }
  }

  static async compareScanResults(pipelineId, scanType) {
    try {
      const result = await query(
        `SELECT * FROM security_scans
         WHERE pipeline_id = $1 AND scan_type = $2
         ORDER BY created_at DESC
         LIMIT 2`,
        [pipelineId, scanType]
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
      console.error('Compare scan results error:', error);
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
      console.error('Delete scans error:', error);
      throw error;
    }
  }
}
