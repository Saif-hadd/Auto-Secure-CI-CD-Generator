// FIXES APPLIED: 1.6, 2.4, 3.1, 3.4
import fs from 'fs';
import path from 'path';
import { StackDetector } from './stack-detector.js';
import { logger } from './logger.js';

export class AutoFixer {
  static async fixVulnerabilities(scanResults, projectPath) {
    const fixes = {
      files_updated: [],
      changes: [],
      errors: [],
      packageJsonFiles: [] // FIX: keep monorepo file updates so remediation PRs can commit each package.json
    };

    try {
      const dependencyScans = scanResults.filter((scan) => scan.scan_type === 'dependencies');
      const containerScans = scanResults.filter((scan) => scan.scan_type === 'container'); // FIX: keep container remediation available even without dependency scans

      if (dependencyScans.length === 0 && containerScans.length === 0) {
        return fixes;
      }

      const detectedStack = await StackDetector.detectFromLocal(projectPath); // FIX: detect monorepo services before patching package manifests
      const packageJsonPaths = detectedStack?.type === 'monorepo'
        ? detectedStack.services
          .map((service) => path.join(projectPath, service.path, 'package.json')) // FIX: target each workspace manifest in monorepos
          .filter((packageJsonPath) => fs.existsSync(packageJsonPath))
        : undefined;

      for (const scan of dependencyScans) {
        if (!scan.findings || scan.findings.length === 0) {
          continue;
        }

        const packageJsonFix = await this.fixPackageJson(scan.findings, projectPath, packageJsonPaths);
        if (packageJsonFix) {
          fixes.files_updated.push(...packageJsonFix.files.map((file) => file.path)); // FIX: preserve actual updated package.json paths for monorepos
          fixes.changes.push(...packageJsonFix.changes);
          fixes.packageJsonFiles = packageJsonFix.files; // FIX: expose every updated manifest to the remediation PR workflow

          if (packageJsonFix.content) {
            fixes.packageJsonContent = packageJsonFix.content;
          }
        }
      }

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

      fixes.files_updated = [...new Set(fixes.files_updated)]; // FIX: deduplicate file paths when multiple findings hit the same file
      return fixes;
    } catch (error) {
      logger.error({ context: { projectPath }, err: error }, 'Auto-fixer error'); // FIX: replace console logging with structured logger
      fixes.errors.push(error.message);
      return fixes;
    }
  }

  static async fixPackageJson(findings, projectPath, packageJsonPaths = []) {
    try {
      const targetPaths = (packageJsonPaths.length > 0
        ? packageJsonPaths
        : [path.join(projectPath, 'package.json')])
        .map((packageJsonPath) => path.resolve(packageJsonPath));

      const files = [];
      const changes = [];
      let modified = false;

      for (const packageJsonPath of [...new Set(targetPaths)]) {
        if (!fs.existsSync(packageJsonPath)) {
          continue;
        }

        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);
        let fileModified = false;

        for (const finding of findings) {
          if (!finding.package) { // FIX: defer fixedVersion validation to the dedicated semver check below
            continue; // FIX: skip findings that do not identify a package to patch
          }

          const packageName = finding.package;
          const fixedVersion = finding.fixedVersion ? String(finding.fixedVersion).trim() : ''; // FIX: normalize scanner-provided versions before validating them

          if (!fixedVersion || !/^\d+\.\d+\.\d+/.test(fixedVersion)) { // FIX: validate scanner-provided versions before patching package.json
            continue; // FIX: skip malformed or missing version from scanner
          }

          const currentVersion = finding.version;

          if (packageJson.dependencies && packageJson.dependencies[packageName]) {
            const oldVersion = packageJson.dependencies[packageName];
            packageJson.dependencies[packageName] = fixedVersion;
            changes.push({
              file: path.relative(projectPath, packageJsonPath).replace(/\\/g, '/') || 'package.json', // FIX: retain the manifest path for monorepo remediation reporting
              package: packageName,
              from: currentVersion || oldVersion,
              to: fixedVersion,
              severity: finding.severity || 'unknown',
              section: 'dependencies'
            });
            fileModified = true;
            modified = true;
          }

          if (packageJson.devDependencies && packageJson.devDependencies[packageName]) {
            const oldVersion = packageJson.devDependencies[packageName];
            packageJson.devDependencies[packageName] = fixedVersion;
            changes.push({
              file: path.relative(projectPath, packageJsonPath).replace(/\\/g, '/') || 'package.json', // FIX: retain the manifest path for monorepo remediation reporting
              package: packageName,
              from: currentVersion || oldVersion,
              to: fixedVersion,
              severity: finding.severity || 'unknown',
              section: 'devDependencies'
            });
            fileModified = true;
            modified = true;
          }
        }

        if (!fileModified) {
          continue;
        }

        const updatedContent = `${JSON.stringify(packageJson, null, 2)}\n`;
        const relativePath = path.relative(projectPath, packageJsonPath).replace(/\\/g, '/') || 'package.json';

        files.push({
          path: relativePath,
          content: updatedContent
        });
      }

      if (!modified) {
        return null;
      }

      return {
        changes,
        files,
        content: files.length === 1 ? files[0].content : null // FIX: preserve the previous single-file contract while supporting monorepos
      };
    } catch (error) {
      logger.error({ context: { projectPath }, err: error }, 'Fix package.json error'); // FIX: replace console logging with structured logger
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
        const trimmedLine = line.trim();
        const isMultilineRun = trimmedLine.toLowerCase().startsWith('run ') && trimmedLine.endsWith('\\'); // FIX: avoid rewriting partial multi-line RUN commands

        if (trimmedLine.startsWith('USER root')) {
          updatedLine = line.replace('USER root', 'USER appuser'); // FIX: switch away from the root user; ensure appuser is created earlier in the image
          changes.push({
            type: 'dockerfile',
            issue: 'Running as root user',
            fix: 'Changed to non-root user (appuser); ensure appuser is created before this line',
            severity: 'medium'
          });
          modified = true;
        }

        if (line.includes('apt-get') && !line.includes('--no-install-recommends')) {
          if (isMultilineRun) {
            changes.push({
              type: 'dockerfile',
              issue: 'Skipped multi-line RUN command',
              fix: 'Manual review required because multi-line RUN commands are not rewritten automatically',
              severity: 'low',
              warning: true
            });
          } else {
            updatedLine = line.replace('apt-get install', 'apt-get install --no-install-recommends'); // FIX: harden package installation flags only on safe single-line RUN commands
            changes.push({
              type: 'dockerfile',
              issue: 'Missing --no-install-recommends flag',
              fix: 'Added optimization flag',
              severity: 'low'
            });
            modified = true;
          }
        }

        if (line.includes('curl') && !line.includes('&& rm -rf')) {
          if (isMultilineRun) {
            changes.push({
              type: 'dockerfile',
              issue: 'Skipped multi-line RUN command',
              fix: 'Manual review required because cleanup was not appended to a multi-line RUN command',
              severity: 'low',
              warning: true
            });
          } else {
            updatedLine = `${updatedLine} && rm -rf /var/lib/apt/lists/*`; // FIX: add package cache cleanup only when the RUN command is single-line
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
      logger.error({ context: { projectPath, findingsCount: findings?.length || 0 }, err: error }, 'Fix Dockerfile error'); // FIX: replace console logging with structured logger
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
        summary.packages.push(`${change.package}: ${change.from} -> ${change.to}`);
      }
    }

    return summary;
  }

  static generatePRDescription(changes, securityScore) {
    const summary = this.summarizeChanges(changes);

    let description = '## Auto-Remediation: Security Vulnerabilities Fixed\n\n';
    description += `This PR automatically fixes **${summary.total}** security vulnerabilities detected in the codebase.\n\n`;

    if (securityScore) {
      description += '### Security Score Impact\n';
      description += `Current Score: ${securityScore}/100\n\n`;
    }

    description += '### Vulnerabilities Fixed by Severity\n';
    description += `- Critical: ${summary.bySeverity.critical}\n`;
    description += `- High: ${summary.bySeverity.high}\n`;
    description += `- Medium: ${summary.bySeverity.medium}\n`;
    description += `- Low: ${summary.bySeverity.low}\n\n`;

    if (summary.packages.length > 0) {
      description += '### Package Updates\n\n';
      for (const packageUpdate of summary.packages) {
        description += `- ${packageUpdate}\n`;
      }
      description += '\n';
    }

    description += '### What Changed\n\n';
    description += 'This automated fix updates vulnerable dependencies to their latest secure versions. ';
    description += 'All changes have been automatically generated based on security scan results.\n\n';

    description += '### Recommended Actions\n\n';
    description += '1. Review the changes to ensure compatibility\n';
    description += '2. Run tests to verify functionality\n';
    description += '3. Merge to apply the security fixes\n\n';

    description += '---\n';
    description += '*Generated by Auto Secure CI/CD Generator*';

    return description;
  }
}
