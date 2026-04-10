import yaml from 'js-yaml';

export class AnalyzerService {
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
        valid: issues.filter(i => i.severity === 'critical').length === 0,
        issues,
        warnings,
        optimizedYAML,
        suggestions: this.generateSuggestions(issues, warnings)
      };
    } catch (error) {
      console.error('Analyze YAML error:', error);
      throw error;
    }
  }

  static checkSecurityFeatures(parsedYAML) {
    const issues = [];
    const warnings = [];

    const allSteps = this.getAllSteps(parsedYAML);
    const stepNames = allSteps.map(s => s.name?.toLowerCase() || '');
    const stepUses = allSteps.map(s => s.uses?.toLowerCase() || '');

    // ✅ Détection élargie — inclut les vraies actions ET les echo fake
    const hasSAST = stepNames.some(n =>
      n.includes('sast') || n.includes('static analysis') || n.includes('sonar') || n.includes('semgrep') || n.includes('codeql')
    ) || stepUses.some(u =>
      u.includes('semgrep') || u.includes('codeql') || u.includes('sonarcloud')
    );

    const hasSecrets = stepNames.some(n =>
      n.includes('secret') || n.includes('gitleaks') || n.includes('trufflehog')
    ) || stepUses.some(u =>
      u.includes('trivy') || u.includes('gitleaks') || u.includes('trufflehog')
    ) || allSteps.some(s => {
      const withObj = s.with || {};
      return JSON.stringify(withObj).toLowerCase().includes('secret');
    });

    const hasDependency = stepNames.some(n =>
      n.includes('dependency') || n.includes('vulnerabilit') || n.includes('audit') || n.includes('snyk')
    ) || stepUses.some(u =>
      u.includes('trivy') || u.includes('snyk') || u.includes('dependency-check')
    );

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

    return { issues, warnings };
  }

  static checkBestPractices(parsedYAML) {
    const warnings = [];
    const allSteps = this.getAllSteps(parsedYAML);

    const hasTests = allSteps.some(s => {
      const name = s.name?.toLowerCase() || '';
      const run = s.run?.toLowerCase() || '';
      return name.includes('test') || run.includes('test');
    });

    if (!hasTests) {
      warnings.push({
        type: 'best-practice',
        severity: 'medium',
        message: 'No test step found'
      });
    }

    const hasCheckout = allSteps.some(s => s.uses?.includes('actions/checkout'));
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
      Object.values(parsedYAML.jobs).forEach(job => {
        if (job.steps) {
          steps.push(...job.steps);
        }
      });
    }

    return steps;
  }

  static optimizeYAML(parsedYAML, issues, warnings) {
    try {
      const criticalIssues = issues.filter(i => i.severity === 'critical');
      if (criticalIssues.length > 0) {
        return null;
      }

      const optimized = JSON.parse(JSON.stringify(parsedYAML));

      // ✅ Ajouter permissions globales si manquantes
      if (!optimized.permissions) {
        optimized.permissions = {
          contents: 'read',
          'security-events': 'write'
        };
      }

      if (optimized.jobs) {
        Object.keys(optimized.jobs).forEach(jobKey => {
          const job = optimized.jobs[jobKey];

          if (!job.steps) {
            job.steps = [];
          }

          const stepNames = job.steps.map(s => s.name?.toLowerCase() || '');
          const stepUses = job.steps.map(s => s.uses?.toLowerCase() || '');

          const hasSAST = stepNames.some(n =>
            n.includes('sast') || n.includes('semgrep') || n.includes('codeql')
          ) || stepUses.some(u => u.includes('semgrep') || u.includes('codeql'));

          const hasSecrets = stepNames.some(n =>
            n.includes('secret') || n.includes('gitleaks')
          ) || stepUses.some(u => u.includes('trivy') || u.includes('gitleaks'));

          const hasDependency = stepNames.some(n =>
            n.includes('dependency') || n.includes('audit') || n.includes('vulnerabilit')
          ) || stepUses.some(u => u.includes('trivy') || u.includes('snyk'));

          // ✅ SAST — vraie action Semgrep
          if (!hasSAST) {
            job.steps.push({
              name: 'SAST - Semgrep',
              uses: 'semgrep/semgrep-action@v1',
              with: {
                config: 'auto'
              },
              'continue-on-error': true
            });
          }

          // ✅ Secrets scanning — vraie action Trivy
          if (!hasSecrets) {
            job.steps.push({
              name: 'Secrets scanning - Trivy',
              uses: 'aquasecurity/trivy-action@master',
              with: {
                'scan-type': 'fs',
                'scan-ref': '.',
                scanners: 'secret',
                format: 'sarif',
                output: 'trivy-secrets.sarif'
              },
              'continue-on-error': true
            });
            job.steps.push({
              name: 'Upload secrets scan results',
              uses: 'github/codeql-action/upload-sarif@v3',
              if: 'always()',
              with: {
                sarif_file: 'trivy-secrets.sarif'
              },
              'continue-on-error': true
            });
          }

          // ✅ Dependency scan — vraie action Trivy
          if (!hasDependency) {
            job.steps.push({
              name: 'Dependency vulnerability scan - Trivy',
              uses: 'aquasecurity/trivy-action@master',
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
            job.steps.push({
              name: 'Upload vulnerability scan results',
              uses: 'github/codeql-action/upload-sarif@v3',
              if: 'always()',
              with: {
                sarif_file: 'trivy-vuln.sarif'
              },
              'continue-on-error': true
            });
          }

          // ✅ Npm audit si npm install détecté et pas d'audit existant
          const hasNpmInstall = job.steps.some(s => s.run?.includes('npm install') || s.run?.includes('npm ci'));
          const hasAudit = stepNames.some(n => n.includes('audit'));
          if (hasNpmInstall && !hasAudit) {
            job.steps.push({
              name: 'npm audit',
              run: 'npm audit --audit-level=moderate --production || true',
              'continue-on-error': true
            });
          }

          // ✅ Pinning des versions — remplacer @v3 par @v4 pour checkout
          job.steps = job.steps.map(step => {
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
      console.error('Optimize YAML error:', error);
      return null;
    }
  }

  static generateSuggestions(issues, warnings) {
    const suggestions = [];

    if (issues.some(i => i.type === 'security')) {
      suggestions.push({
        title: 'Add Security Scanning',
        description: 'Implement SAST, DAST, and secrets scanning in your pipeline',
        priority: 'high'
      });
    }

    if (warnings.some(w => w.message.includes('test'))) {
      suggestions.push({
        title: 'Add Test Steps',
        description: 'Include unit and integration tests to ensure code quality',
        priority: 'medium'
      });
    }

    if (warnings.some(w => w.message.includes('checkout'))) {
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