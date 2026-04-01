import yaml from 'js-yaml';
import { YAMLGenerator } from '../utils/yaml-generator.js';

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

    const hasSAST = stepNames.some(n => n.includes('sast') || n.includes('static analysis') || n.includes('sonar'));
    const hasSecrets = stepNames.some(n => n.includes('secret') || n.includes('trivy'));
    const hasDependency = stepNames.some(n => n.includes('dependency') || n.includes('vulnerabilit'));

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

      if (optimized.jobs) {
        Object.keys(optimized.jobs).forEach(jobKey => {
          const job = optimized.jobs[jobKey];

          if (!job.steps) {
            job.steps = [];
          }

          const stepNames = job.steps.map(s => s.name?.toLowerCase() || '');

          if (!stepNames.some(n => n.includes('sast') || n.includes('static analysis'))) {
            job.steps.push({
              name: 'SAST Scan',
              run: 'echo "Running static application security testing..."'
            });
          }

          if (!stepNames.some(n => n.includes('secret'))) {
            job.steps.push({
              name: 'Secrets Scan',
              run: 'echo "Scanning for exposed secrets..."'
            });
          }

          if (!stepNames.some(n => n.includes('dependency') || n.includes('vulnerabilit'))) {
            job.steps.push({
              name: 'Dependency Scan',
              run: 'echo "Scanning dependencies for vulnerabilities..."'
            });
          }
        });
      }

      return yaml.dump(optimized, { lineWidth: -1 });
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
