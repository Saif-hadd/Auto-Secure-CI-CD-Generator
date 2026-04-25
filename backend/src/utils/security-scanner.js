// FIXES APPLIED: 1.4, 3.1
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { env } from './env.js';
import { logger } from './logger.js';

const execFileAsync = promisify(execFile);
const ALLOWED_BASE_DIR = path.resolve(env.ALLOWED_SCAN_BASE_DIR); // FIX: centralize the allowed scan base directory for project path validation

export class SecurityScanner {
  static validateProjectPath(projectPath) {
    const safeProjectPath = path.resolve(projectPath);

    if (!safeProjectPath.startsWith(ALLOWED_BASE_DIR)) {
      throw new Error('Invalid path'); // FIX: block project paths outside the approved scan directory
    }

    return safeProjectPath;
  }

  static async runAllScans(projectPath, scannerType = 'trivy') {
    const safeProjectPath = this.validateProjectPath(projectPath); // FIX: normalize and validate the project path before dispatching shell-backed scans
    const scanTypes = ['dependencies', 'secrets', 'container', 'sast'];

    const scans = await Promise.allSettled([
      this.runDependencyScan(safeProjectPath, scannerType),
      this.runSecretsScan(safeProjectPath),
      this.runContainerScan(safeProjectPath),
      this.runSASTScan(safeProjectPath)
    ]);

    return scans.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      logger.error(
        { context: { projectPath: safeProjectPath, scanType: scanTypes[index] }, err: result.reason },
        'Security scan failed'
      ); // FIX: replace console logging with structured logger

      return this.getFallbackScan(scanTypes[index]);
    });
  }

  static async runDependencyScan(projectPath, scannerType = 'trivy') {
    const safeProjectPath = this.validateProjectPath(projectPath); // FIX: validate every projectPath before it reaches a shell-backed scan

    try {
      if (scannerType === 'snyk' && await this.isCommandAvailable('snyk')) {
        return await this.runSnykDependencyScan(safeProjectPath);
      }

      if (await this.isCommandAvailable('trivy')) {
        return await this.runTrivyDependencyScan(safeProjectPath);
      }

      return this.getFallbackScan('dependencies');
    } catch (error) {
      logger.error({ context: { projectPath: safeProjectPath, scannerType }, err: error }, 'Dependency scan error'); // FIX: replace console logging with structured logger
      return this.getFallbackScan('dependencies');
    }
  }

  static async runTrivyDependencyScan(projectPath) {
    const safeProjectPath = this.validateProjectPath(projectPath); // FIX: validate every projectPath before it reaches a shell-backed scan

    try {
      const { stdout } = await execFileAsync(
        'trivy',
        ['fs', '--format', 'json', '--scanners', 'vuln', safeProjectPath], // FIX: avoid shell interpolation by passing command arguments explicitly
        { timeout: 60000 }
      );

      const result = JSON.parse(stdout);
      const vulnerabilities = this.parseTrivyOutput(result);

      return {
        scan_type: 'dependencies',
        vulnerabilities_count: vulnerabilities.length,
        risk_level: this.calculateRiskLevel(vulnerabilities),
        findings: vulnerabilities.slice(0, 10),
        scanner: 'trivy',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error({ context: { projectPath: safeProjectPath }, err: error }, 'Trivy dependency scan error'); // FIX: replace console logging with structured logger
      return this.getFallbackScan('dependencies');
    }
  }

  static async runSnykDependencyScan(projectPath) {
    const safeProjectPath = this.validateProjectPath(projectPath); // FIX: validate every projectPath before it reaches a shell-backed scan

    try {
      const { stdout } = await execFileAsync(
        'snyk',
        ['test', '--json'], // FIX: avoid shell interpolation by passing command arguments explicitly
        { cwd: safeProjectPath, timeout: 60000 }
      );

      const result = JSON.parse(stdout);
      const vulnerabilities = this.parseSnykOutput(result);

      return {
        scan_type: 'dependencies',
        vulnerabilities_count: vulnerabilities.length,
        risk_level: this.calculateRiskLevel(vulnerabilities),
        findings: vulnerabilities.slice(0, 10),
        scanner: 'snyk',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error.stdout) {
        try {
          const result = JSON.parse(error.stdout);
          const vulnerabilities = this.parseSnykOutput(result);

          return {
            scan_type: 'dependencies',
            vulnerabilities_count: vulnerabilities.length,
            risk_level: this.calculateRiskLevel(vulnerabilities),
            findings: vulnerabilities.slice(0, 10),
            scanner: 'snyk',
            timestamp: new Date().toISOString()
          };
        } catch (parseError) {
          logger.error({ context: { projectPath: safeProjectPath }, err: parseError }, 'Snyk output parse error'); // FIX: replace console logging with structured logger
        }
      }

      return this.getFallbackScan('dependencies');
    }
  }

  static async runSecretsScan(projectPath) {
    const safeProjectPath = this.validateProjectPath(projectPath); // FIX: validate every projectPath before it reaches a shell-backed scan

    try {
      if (await this.isCommandAvailable('trivy')) {
        const { stdout } = await execFileAsync(
          'trivy',
          ['fs', '--format', 'json', '--scanners', 'secret', safeProjectPath], // FIX: avoid shell interpolation by passing command arguments explicitly
          { timeout: 60000 }
        );

        const result = JSON.parse(stdout);
        const secrets = this.parseTrivySecretsOutput(result);

        return {
          scan_type: 'secrets',
          vulnerabilities_count: secrets.length,
          risk_level: secrets.length > 0 ? 'critical' : 'low',
          findings: secrets.slice(0, 10),
          scanner: 'trivy',
          timestamp: new Date().toISOString()
        };
      }

      return this.getFallbackScan('secrets');
    } catch (error) {
      logger.error({ context: { projectPath: safeProjectPath }, err: error }, 'Secrets scan error'); // FIX: replace console logging with structured logger
      return this.getFallbackScan('secrets');
    }
  }

  static async runContainerScan(projectPath) {
    const safeProjectPath = this.validateProjectPath(projectPath); // FIX: validate every projectPath before it reaches a shell-backed scan

    try {
      const dockerfilePath = path.join(safeProjectPath, 'Dockerfile');

      if (!fs.existsSync(dockerfilePath)) {
        return {
          scan_type: 'container',
          vulnerabilities_count: 0,
          risk_level: 'low',
          findings: [],
          message: 'No Dockerfile found',
          scanner: 'trivy',
          timestamp: new Date().toISOString()
        };
      }

      if (await this.isCommandAvailable('trivy')) {
        const { stdout } = await execFileAsync(
          'trivy',
          ['config', '--format', 'json', dockerfilePath], // FIX: avoid shell interpolation by passing command arguments explicitly
          { timeout: 60000 }
        );

        const result = JSON.parse(stdout);
        const issues = this.parseTrivyConfigOutput(result);

        return {
          scan_type: 'container',
          vulnerabilities_count: issues.length,
          risk_level: this.calculateRiskLevel(issues),
          findings: issues.slice(0, 10),
          scanner: 'trivy',
          timestamp: new Date().toISOString()
        };
      }

      return this.getFallbackScan('container');
    } catch (error) {
      logger.error({ context: { projectPath: safeProjectPath }, err: error }, 'Container scan error'); // FIX: replace console logging with structured logger
      return this.getFallbackScan('container');
    }
  }

  static async runSASTScan(projectPath) {
    const safeProjectPath = this.validateProjectPath(projectPath); // FIX: validate every projectPath before it reaches a shell-backed scan

    try {
      if (await this.isCommandAvailable('semgrep')) {
        const { stdout } = await execFileAsync(
          'semgrep',
          ['--config=auto', '--json', safeProjectPath], // FIX: avoid shell interpolation by passing command arguments explicitly
          { timeout: 90000 }
        );

        const result = JSON.parse(stdout);
        const findings = this.parseSemgrepOutput(result);

        return {
          scan_type: 'sast',
          vulnerabilities_count: findings.length,
          risk_level: this.calculateRiskLevel(findings),
          findings: findings.slice(0, 10),
          scanner: 'semgrep',
          timestamp: new Date().toISOString()
        };
      }

      return this.getFallbackScan('sast');
    } catch (error) {
      logger.error({ context: { projectPath: safeProjectPath }, err: error }, 'SAST scan error'); // FIX: replace console logging with structured logger
      return this.getFallbackScan('sast');
    }
  }

  static parseTrivyOutput(result) {
    const vulnerabilities = [];

    if (result.Results) {
      for (const res of result.Results) {
        if (res.Vulnerabilities) {
          for (const vuln of res.Vulnerabilities) {
            vulnerabilities.push({
              title: `${vuln.PkgName}: ${vuln.VulnerabilityID}`,
              severity: vuln.Severity?.toLowerCase() || 'medium',
              description: vuln.Title || vuln.Description || 'No description available',
              package: vuln.PkgName,
              version: vuln.InstalledVersion,
              fixedVersion: vuln.FixedVersion
            });
          }
        }
      }
    }

    return vulnerabilities;
  }

  static parseTrivySecretsOutput(result) {
    const secrets = [];

    if (result.Results) {
      for (const res of result.Results) {
        if (res.Secrets) {
          for (const secret of res.Secrets) {
            secrets.push({
              title: secret.Title || 'Secret detected',
              severity: 'critical',
              description: secret.Match || 'Potential secret found',
              file: res.Target,
              line: secret.StartLine
            });
          }
        }
      }
    }

    return secrets;
  }

  static parseTrivyConfigOutput(result) {
    const issues = [];

    if (result.Results) {
      for (const res of result.Results) {
        if (res.Misconfigurations) {
          for (const misc of res.Misconfigurations) {
            issues.push({
              title: misc.Title,
              severity: misc.Severity?.toLowerCase() || 'medium',
              description: misc.Description,
              resolution: misc.Resolution
            });
          }
        }
      }
    }

    return issues;
  }

  static parseSnykOutput(result) {
    const vulnerabilities = [];

    if (result.vulnerabilities) {
      for (const vuln of result.vulnerabilities) {
        vulnerabilities.push({
          title: vuln.title,
          severity: vuln.severity,
          description: vuln.description || 'No description available',
          package: vuln.packageName,
          version: vuln.version,
          fixedVersion: vuln.fixedIn?.join(', ')
        });
      }
    }

    return vulnerabilities;
  }

  static parseSemgrepOutput(result) {
    const findings = [];

    if (result.results) {
      for (const finding of result.results) {
        findings.push({
          title: finding.check_id || 'Security issue detected',
          severity: finding.extra?.severity?.toLowerCase() || 'medium',
          description: finding.extra?.message || 'No description available',
          file: finding.path,
          line: finding.start?.line
        });
      }
    }

    return findings;
  }

  static calculateRiskLevel(vulnerabilities) {
    if (!Array.isArray(vulnerabilities)) {
      return 'low';
    }

    const criticalCount = vulnerabilities.filter((vulnerability) => vulnerability.severity === 'critical').length;
    const highCount = vulnerabilities.filter((vulnerability) => vulnerability.severity === 'high').length;

    if (criticalCount > 0) return 'critical';
    if (highCount > 2) return 'high';
    if (highCount > 0 || vulnerabilities.length > 5) return 'medium';
    return 'low';
  }

  static async isCommandAvailable(command) {
    try {
      const lookupCommand = process.platform === 'win32' ? 'where' : 'which'; // FIX: make command detection portable while avoiding shell interpolation
      await execFileAsync(lookupCommand, [command]);
      return true;
    } catch {
      return false;
    }
  }

  static getFallbackScan(scanType) {
    const fallbackData = {
      dependencies: {
        scan_type: 'dependencies',
        vulnerabilities_count: 0,
        risk_level: 'low',
        findings: [],
        message: 'Scanner not available - install Trivy or Snyk for real scans',
        scanner: 'fallback',
        timestamp: new Date().toISOString()
      },
      secrets: {
        scan_type: 'secrets',
        vulnerabilities_count: 0,
        risk_level: 'low',
        findings: [],
        message: 'Scanner not available - install Trivy for real secret scanning',
        scanner: 'fallback',
        timestamp: new Date().toISOString()
      },
      container: {
        scan_type: 'container',
        vulnerabilities_count: 0,
        risk_level: 'low',
        findings: [],
        message: 'Scanner not available - install Trivy for container scanning',
        scanner: 'fallback',
        timestamp: new Date().toISOString()
      },
      sast: {
        scan_type: 'sast',
        vulnerabilities_count: 0,
        risk_level: 'low',
        findings: [],
        message: 'Scanner not available - install Semgrep for SAST scanning',
        scanner: 'fallback',
        timestamp: new Date().toISOString()
      }
    };

    return fallbackData[scanType] || fallbackData.dependencies;
  }
}
