import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export class SecurityScanner {
  static async runAllScans(projectPath, scannerType = 'trivy') {
    const scans = await Promise.allSettled([
      this.runDependencyScan(projectPath, scannerType),
      this.runSecretsScan(projectPath),
      this.runContainerScan(projectPath),
      this.runSASTScan(projectPath)
    ]);

    return scans.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`Scan ${index} failed:`, result.reason);
        return this.getFallbackScan(['dependency', 'secrets', 'container', 'sast'][index]);
      }
    });
  }

  static async runDependencyScan(projectPath, scannerType = 'trivy') {
    try {
      if (scannerType === 'snyk' && await this.isCommandAvailable('snyk')) {
        return await this.runSnykDependencyScan(projectPath);
      }

      if (await this.isCommandAvailable('trivy')) {
        return await this.runTrivyDependencyScan(projectPath);
      }

      return this.getFallbackScan('dependencies');
    } catch (error) {
      console.error('Dependency scan error:', error);
      return this.getFallbackScan('dependencies');
    }
  }

  static async runTrivyDependencyScan(projectPath) {
    try {
      const { stdout } = await execAsync(
        `trivy fs --format json --scanners vuln ${projectPath}`,
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
      console.error('Trivy dependency scan error:', error);
      return this.getFallbackScan('dependencies');
    }
  }

  static async runSnykDependencyScan(projectPath) {
    try {
      const { stdout } = await execAsync(
        `snyk test --json`,
        { cwd: projectPath, timeout: 60000 }
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
          console.error('Snyk output parse error:', parseError);
        }
      }
      return this.getFallbackScan('dependencies');
    }
  }

  static async runSecretsScan(projectPath) {
    try {
      if (await this.isCommandAvailable('trivy')) {
        const { stdout } = await execAsync(
          `trivy fs --format json --scanners secret ${projectPath}`,
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
      console.error('Secrets scan error:', error);
      return this.getFallbackScan('secrets');
    }
  }

  static async runContainerScan(projectPath) {
    try {
      const dockerfilePath = path.join(projectPath, 'Dockerfile');

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
        const { stdout } = await execAsync(
          `trivy config --format json ${dockerfilePath}`,
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
      console.error('Container scan error:', error);
      return this.getFallbackScan('container');
    }
  }

  static async runSASTScan(projectPath) {
    try {
      if (await this.isCommandAvailable('semgrep')) {
        const { stdout } = await execAsync(
          `semgrep --config=auto --json ${projectPath}`,
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
      console.error('SAST scan error:', error);
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

    const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = vulnerabilities.filter(v => v.severity === 'high').length;

    if (criticalCount > 0) return 'critical';
    if (highCount > 2) return 'high';
    if (highCount > 0 || vulnerabilities.length > 5) return 'medium';
    return 'low';
  }

  static async isCommandAvailable(command) {
    try {
      await execAsync(`which ${command}`);
      return true;
    } catch (error) {
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
