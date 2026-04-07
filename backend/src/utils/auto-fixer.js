import fs from 'fs';
import path from 'path';

export class AutoFixer {
  static async fixVulnerabilities(scanResults, projectPath) {
    const fixes = {
      files_updated: [],
      changes: [],
      errors: []
    };

    try {
      const dependencyScans = scanResults.filter(scan => scan.scan_type === 'dependencies');

      if (dependencyScans.length === 0) {
        return fixes;
      }

      for (const scan of dependencyScans) {
        if (!scan.findings || scan.findings.length === 0) {
          continue;
        }

        const packageJsonFix = await this.fixPackageJson(scan.findings, projectPath);
        if (packageJsonFix) {
          fixes.files_updated.push('package.json');
          fixes.changes.push(...packageJsonFix.changes);

          if (packageJsonFix.content) {
            fixes.packageJsonContent = packageJsonFix.content;
          }
        }
      }

      const containerScans = scanResults.filter(scan => scan.scan_type === 'container');
      for (const scan of containerScans) {
        if (!scan.findings || scan.findings.length === 0) {
          continue;
        }

        const dockerfileFix = await this.fixDockerfile(scan.findings, projectPath);
        if (dockerfileFix) {
          fixes.files_updated.push('Dockerfile');
          fixes.changes.push(...dockerfileFix.changes);

          if (dockerfileFix.content) {
            fixes.dockerfileContent = dockerfileFix.content;
          }
        }
      }

      return fixes;
    } catch (error) {
      console.error('Auto-fixer error:', error);
      fixes.errors.push(error.message);
      return fixes;
    }
  }

  static async fixPackageJson(findings, projectPath) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');

      if (!fs.existsSync(packageJsonPath)) {
        return null;
      }

      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      const changes = [];
      let modified = false;

      for (const finding of findings) {
        if (!finding.package || !finding.fixedVersion) {
          continue;
        }

        const packageName = finding.package;
        const fixedVersion = finding.fixedVersion;
        const currentVersion = finding.version;

        if (packageJson.dependencies && packageJson.dependencies[packageName]) {
          const oldVersion = packageJson.dependencies[packageName];
          packageJson.dependencies[packageName] = fixedVersion;
          changes.push({
            package: packageName,
            from: currentVersion || oldVersion,
            to: fixedVersion,
            severity: finding.severity || 'unknown',
            section: 'dependencies'
          });
          modified = true;
        }

        if (packageJson.devDependencies && packageJson.devDependencies[packageName]) {
          const oldVersion = packageJson.devDependencies[packageName];
          packageJson.devDependencies[packageName] = fixedVersion;
          changes.push({
            package: packageName,
            from: currentVersion || oldVersion,
            to: fixedVersion,
            severity: finding.severity || 'unknown',
            section: 'devDependencies'
          });
          modified = true;
        }
      }

      if (!modified) {
        return null;
      }

      const updatedContent = JSON.stringify(packageJson, null, 2) + '\n';

      return {
        changes,
        content: updatedContent
      };
    } catch (error) {
      console.error('Fix package.json error:', error);
      return null;
    }
  }

  static async fixDockerfile(findings, projectPath) {
    try {
      const dockerfilePath = path.join(projectPath, 'Dockerfile');

      if (!fs.existsSync(dockerfilePath)) {
        return null;
      }

      const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf-8');
      const lines = dockerfileContent.split('\n');

      const changes = [];
      let modified = false;
      const updatedLines = [];

      for (const line of lines) {
        let updatedLine = line;

        if (line.trim().startsWith('USER root')) {
          updatedLine = line.replace('USER root', 'USER node');
          changes.push({
            type: 'dockerfile',
            issue: 'Running as root user',
            fix: 'Changed to non-root user',
            severity: 'medium'
          });
          modified = true;
        }

        if (line.includes('apt-get') && !line.includes('--no-install-recommends')) {
          updatedLine = line.replace('apt-get install', 'apt-get install --no-install-recommends');
          changes.push({
            type: 'dockerfile',
            issue: 'Missing --no-install-recommends flag',
            fix: 'Added optimization flag',
            severity: 'low'
          });
          modified = true;
        }

        if (line.includes('curl') && !line.includes('&& rm -rf')) {
          if (!updatedLine.includes('\\')) {
            updatedLine = updatedLine + ' && rm -rf /var/lib/apt/lists/*';
            changes.push({
              type: 'dockerfile',
              issue: 'Not cleaning up package manager cache',
              fix: 'Added cleanup step',
              severity: 'low'
            });
            modified = true;
          }
        }

        updatedLines.push(updatedLine);
      }

      if (!modified) {
        return null;
      }

      const updatedContent = updatedLines.join('\n');

      return {
        changes,
        content: updatedContent
      };
    } catch (error) {
      console.error('Fix Dockerfile error:', error);
      return null;
    }
  }

  static summarizeChanges(changes) {
    const summary = {
      total: changes.length,
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      packages: []
    };

    for (const change of changes) {
      if (change.severity) {
        summary.bySeverity[change.severity] = (summary.bySeverity[change.severity] || 0) + 1;
      }

      if (change.package) {
        summary.packages.push(`${change.package}: ${change.from} → ${change.to}`);
      }
    }

    return summary;
  }

  static generatePRDescription(changes, securityScore) {
    const summary = this.summarizeChanges(changes);

    let description = '## Auto-Remediation: Security Vulnerabilities Fixed\n\n';
    description += `This PR automatically fixes **${summary.total}** security vulnerabilities detected in the codebase.\n\n`;

    if (securityScore) {
      description += `### Security Score Impact\n`;
      description += `Current Score: ${securityScore}/100\n\n`;
    }

    description += `### Vulnerabilities Fixed by Severity\n`;
    description += `- Critical: ${summary.bySeverity.critical}\n`;
    description += `- High: ${summary.bySeverity.high}\n`;
    description += `- Medium: ${summary.bySeverity.medium}\n`;
    description += `- Low: ${summary.bySeverity.low}\n\n`;

    if (summary.packages.length > 0) {
      description += `### Package Updates\n\n`;
      for (const packageUpdate of summary.packages) {
        description += `- ${packageUpdate}\n`;
      }
      description += '\n';
    }

    description += `### What Changed\n\n`;
    description += `This automated fix updates vulnerable dependencies to their latest secure versions. `;
    description += `All changes have been automatically generated based on security scan results.\n\n`;

    description += `### Recommended Actions\n\n`;
    description += `1. Review the changes to ensure compatibility\n`;
    description += `2. Run tests to verify functionality\n`;
    description += `3. Merge to apply the security fixes\n\n`;

    description += `---\n`;
    description += `*Generated by Auto Secure CI/CD Generator*`;

    return description;
  }
}
