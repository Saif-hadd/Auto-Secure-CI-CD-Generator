// FIXES APPLIED: 2.5, 2.6, 3.1
import yaml from 'js-yaml';
import { logger } from '../utils/logger.js';

export class AnalyzerService {
  static getStepName(step) {
    return step?.name?.toLowerCase() || '';
  }

  static getStepUses(step) {
    return step?.uses?.toLowerCase() || '';
  }

  static getStepRun(step) {
    return step?.run?.toLowerCase() || '';
  }

  static getStepScanners(step) {
    const scanners = step?.with?.scanners;

    if (Array.isArray(scanners)) {
      return scanners.map((scanner) => String(scanner).toLowerCase());
    }

    return String(scanners ?? '')
      .split(',')
      .map((scanner) => scanner.trim().toLowerCase())
      .filter(Boolean);
  }

  static hasSASTStep(steps) {
    const hasScannerAction = steps.some((step) => {
      const uses = this.getStepUses(step);
      return uses.includes('semgrep') || uses.includes('codeql') || uses.includes('sonarcloud');
    }); // FIX: require a real SAST scanner action before trusting step-name heuristics

    if (hasScannerAction) {
      return true;
    }

    return steps.some((step) => {
      const name = this.getStepName(step);
      return !this.getStepUses(step) && (
        name.includes('sast') ||
        name.includes('static analysis') ||
        name.includes('sonar') ||
        name.includes('semgrep') ||
        name.includes('codeql')
      );
    }); // FIX: only fall back to step-name matching when the step is not just an upload/action wrapper
  }

  static hasSecretsStep(steps) {
    return steps.some((step) => {
      const uses = this.getStepUses(step);
      const name = this.getStepName(step);

      if (uses.includes('gitleaks') || uses.includes('trufflehog')) {
        return true;
      }

      if (uses.includes('trivy')) {
        return this.getStepScanners(step).includes('secret'); // FIX: only count Trivy as secrets scanning when the scanner list explicitly includes secret
      }

      return !uses && (
        name.includes('secret') ||
        name.includes('gitleaks') ||
        name.includes('trufflehog')
      );
    });
  }

  static hasDependencyStep(steps) {
    return steps.some((step) => {
      const name = this.getStepName(step);
      const uses = this.getStepUses(step);

      return (
        name.includes('dependency') ||
        name.includes('vulnerabilit') ||
        name.includes('audit') ||
        name.includes('snyk') ||
        uses.includes('trivy') ||
        uses.includes('snyk') ||
        uses.includes('dependency-check')
      );
    });
  }

  static getMutableActionRefs(steps) {
    return steps
      .map((step) => step?.uses)
      .filter((uses) => typeof uses === 'string' && /@(master|latest)$/i.test(uses)); // FIX: detect mutable action refs that increase supply-chain risk
  }

  static async analyzeYAML(yamlContent) {
    try {
      const issues = [];
      const warnings = [];

      let parsedYAML;
      try {
        parsedYAML = yaml.load(yamlContent);
      } catch (error) {
        return {
          valid: false,
          issues: [{
            type: 'syntax',
            severity: 'critical',
            message: `YAML syntax error: ${error.message}`,
            line: error.mark?.line
          }],
          warnings: [],
          optimizedYAML: null
        };
      }

      if (!parsedYAML.jobs) {
        issues.push({
          type: 'structure',
          severity: 'critical',
          message: 'No jobs defined in workflow'
        });
      }

      const securityChecks = this.checkSecurityFeatures(parsedYAML);
      issues.push(...securityChecks.issues);
      warnings.push(...securityChecks.warnings);

      const bestPractices = this.checkBestPractices(parsedYAML);
      warnings.push(...bestPractices);

      const optimizedYAML = this.optimizeYAML(parsedYAML, issues, warnings);

      return {
        valid: issues.filter((issue) => issue.severity === 'critical').length === 0,
        issues,
        warnings,
        optimizedYAML,
        suggestions: this.generateSuggestions(issues, warnings)
      };
    } catch (error) {
      logger.error({ context: {}, err: error }, 'Analyze YAML error'); // FIX: replace console logging with structured logger
      throw error;
    }
  }

  static checkSecurityFeatures(parsedYAML) {
    const issues = [];
    const warnings = [];
    const allSteps = this.getAllSteps(parsedYAML);
    const hasSAST = this.hasSASTStep(allSteps);
    const hasSecrets = this.hasSecretsStep(allSteps);
    const hasDependency = this.hasDependencyStep(allSteps);
    const mutableActionRefs = this.getMutableActionRefs(allSteps);

    if (!hasSAST) {
      issues.push({
        type: 'security',
        severity: 'high',
        message: 'No SAST (Static Application Security Testing) step found'
      });
    }

    if (!hasSecrets) {
      warnings.push({
        type: 'security',
        severity: 'medium',
        message: 'No secrets scanning step found'
      });
    }

    if (!hasDependency) {
      warnings.push({
        type: 'security',
        severity: 'medium',
        message: 'No dependency vulnerability scanning step found'
      });
    }

    if (mutableActionRefs.length > 0) {
      warnings.push({
        type: 'security',
        severity: 'medium',
        message: `Workflow uses mutable action references: ${mutableActionRefs.join(', ')}`
      }); // FIX: warn when actions are pinned to @master or @latest instead of immutable refs
    }

    return { issues, warnings };
  }

  static checkBestPractices(parsedYAML) {
    const warnings = [];
    const allSteps = this.getAllSteps(parsedYAML);

    const hasTests = allSteps.some((step) => {
      const name = this.getStepName(step);
      const run = this.getStepRun(step);
      return name.includes('test') || run.includes('test');
    });

    if (!hasTests) {
      warnings.push({
        type: 'best-practice',
        severity: 'medium',
        message: 'No test step found'
      });
    }

    const hasCheckout = allSteps.some((step) => step.uses?.includes('actions/checkout'));
    if (!hasCheckout) {
      warnings.push({
        type: 'best-practice',
        severity: 'high',
        message: 'Missing checkout step'
      });
    }

    return warnings;
  }

  static getAllSteps(parsedYAML) {
    const steps = [];

    if (parsedYAML.jobs) {
      Object.values(parsedYAML.jobs).forEach((job) => {
        if (job.steps) {
          steps.push(...job.steps);
        }
      });
    }

    return steps;
  }

  static optimizeYAML(parsedYAML, issues, warnings) {
    try {
      const criticalIssues = issues.filter((issue) => issue.severity === 'critical');
      if (criticalIssues.length > 0) return null;

      const optimized = JSON.parse(JSON.stringify(parsedYAML));

      if (!optimized.permissions) {
        optimized.permissions = {
          contents: 'read',
          'security-events': 'write'
        };
      }

      if (optimized.jobs) {
        Object.keys(optimized.jobs).forEach((jobKey) => {
          const job = optimized.jobs[jobKey];
          if (!job.steps) job.steps = [];

          const hasSAST = this.hasSASTStep(job.steps);
          const hasSecrets = this.hasSecretsStep(job.steps);
          const hasDependency = this.hasDependencyStep(job.steps);
          const hasNpmInstall = job.steps.some((step) => step.run?.includes('npm install') || step.run?.includes('npm ci'));
          const hasAudit = job.steps.some((step) => this.getStepName(step).includes('audit'));
          const securitySteps = [];

          if (!hasSAST) {
            securitySteps.push({
              name: 'SAST - Semgrep',
              uses: 'semgrep/semgrep-action@v1', // FIX: inject a pinned Semgrep action version instead of a mutable ref
              with: { config: 'auto' },
              'continue-on-error': true
            });
          }

          if (!hasSecrets) {
            securitySteps.push({
              name: 'Secrets scanning - Trivy',
              uses: 'aquasecurity/trivy-action@0.20.0', // FIX: inject a pinned Trivy action version instead of a mutable ref
              with: {
                'scan-type': 'fs',
                'scan-ref': '.',
                scanners: 'secret',
                format: 'sarif',
                output: 'trivy-secrets.sarif'
              },
              'continue-on-error': true
            });
            securitySteps.push({
              name: 'Upload secrets scan results',
              uses: 'github/codeql-action/upload-sarif@v3', // FIX: pin injected SARIF uploads to a stable version
              if: 'always()',
              with: { sarif_file: 'trivy-secrets.sarif' },
              'continue-on-error': true
            });
          }

          if (!hasDependency) {
            securitySteps.push({
              name: 'Dependency vulnerability scan - Trivy',
              uses: 'aquasecurity/trivy-action@0.20.0', // FIX: inject a pinned Trivy action version instead of a mutable ref
              with: {
                'scan-type': 'fs',
                'scan-ref': '.',
                scanners: 'vuln',
                format: 'sarif',
                output: 'trivy-vuln.sarif',
                severity: 'CRITICAL,HIGH,MEDIUM'
              },
              'continue-on-error': true
            });
            securitySteps.push({
              name: 'Upload vulnerability scan results',
              uses: 'github/codeql-action/upload-sarif@v3', // FIX: pin injected SARIF uploads to a stable version
              if: 'always()',
              with: { sarif_file: 'trivy-vuln.sarif' },
              'continue-on-error': true
            });
          }

          if (hasNpmInstall && !hasAudit) {
            securitySteps.push({
              name: 'npm audit',
              run: 'npm audit --audit-level=moderate --production || true',
              'continue-on-error': true
            });
          }

          if (securitySteps.length > 0) {
            const buildIndex = job.steps.findIndex((step) => {
              const name = this.getStepName(step);
              const run = this.getStepRun(step);
              return name.includes('build') || run.includes('build');
            });

            if (buildIndex !== -1) {
              job.steps.splice(buildIndex, 0, ...securitySteps);
            } else {
              const checkoutIndex = job.steps.findIndex((step) => step.uses?.includes('actions/checkout'));
              const insertAt = checkoutIndex !== -1 ? checkoutIndex + 1 : 0;
              job.steps.splice(insertAt, 0, ...securitySteps);
            }
          }

          job.steps = job.steps.map((step) => {
            if (step.uses?.includes('actions/checkout@v3')) {
              return { ...step, uses: 'actions/checkout@v4' };
            }

            if (step.uses?.includes('actions/setup-node@v3')) {
              return { ...step, uses: 'actions/setup-node@v4' };
            }

            return step;
          });
        });
      }

      return yaml.dump(optimized, { lineWidth: -1, quotingType: '"' });
    } catch (error) {
      logger.error({ context: { warningCount: warnings.length }, err: error }, 'Optimize YAML error'); // FIX: replace console logging with structured logger
      return null;
    }
  }

  static generateSuggestions(issues, warnings) {
    const suggestions = [];

    if (issues.some((issue) => issue.type === 'security')) {
      suggestions.push({
        title: 'Add Security Scanning',
        description: 'Implement SAST, DAST, and secrets scanning in your pipeline',
        priority: 'high'
      });
    }

    if (warnings.some((warning) => warning.message.includes('test'))) {
      suggestions.push({
        title: 'Add Test Steps',
        description: 'Include unit and integration tests to ensure code quality',
        priority: 'medium'
      });
    }

    if (warnings.some((warning) => warning.message.includes('checkout'))) {
      suggestions.push({
        title: 'Add Checkout Step',
        description: 'Always checkout code at the beginning of your workflow',
        priority: 'high'
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        title: 'Pipeline Looks Good',
        description: 'Your pipeline follows security best practices',
        priority: 'low'
      });
    }

    return suggestions;
  }
}
