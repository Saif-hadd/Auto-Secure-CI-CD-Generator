# Security Scanning Setup Guide

This guide explains how to set up real security scanning with Trivy and Snyk for the Auto Secure CI/CD Generator.

## Overview

The platform now supports real security scanning using industry-standard tools:

- **Trivy** - Comprehensive vulnerability scanner for containers, filesystems, and dependencies
- **Snyk** - Developer-first security platform for finding and fixing vulnerabilities
- **Semgrep** - SAST tool for finding bugs and security issues in code

## Installation

### Install Trivy

#### macOS
```bash
brew install aquasecurity/trivy/trivy
```

#### Linux
```bash
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt-get update
sudo apt-get install trivy
```

#### Docker
```bash
docker pull aquasec/trivy
```

### Install Snyk (Optional)

```bash
npm install -g snyk
snyk auth
```

### Install Semgrep (Optional)

```bash
pip install semgrep
```

## Usage

### API Endpoints

#### Run Security Scan
```bash
POST /api/security/:pipelineId/scan
Content-Type: application/json
Authorization: Bearer <token>

{
  "scannerType": "trivy",
  "projectPath": "/path/to/project"
}
```

#### Get Scan History
```bash
GET /api/security/:pipelineId/history
Authorization: Bearer <token>
```

#### Compare Scan Results
```bash
GET /api/security/:pipelineId/compare?scanType=dependencies
Authorization: Bearer <token>
```

#### Get Latest Scan
```bash
GET /api/security/:pipelineId/latest?scanType=sast
Authorization: Bearer <token>
```

### Example Response

```json
{
  "success": true,
  "scans": [
    {
      "scan_type": "dependencies",
      "vulnerabilities_count": 3,
      "risk_level": "high",
      "findings": [
        {
          "title": "lodash: Prototype Pollution",
          "severity": "high",
          "description": "Versions of lodash prior to 4.17.21 are vulnerable",
          "package": "lodash",
          "version": "4.17.15",
          "fixedVersion": "4.17.21"
        }
      ],
      "scanner": "trivy",
      "timestamp": "2026-04-01T10:30:00Z"
    }
  ],
  "summary": {
    "totalVulnerabilities": 3,
    "overallRisk": "high",
    "securityScore": 85,
    "scanners": ["trivy"],
    "scanCount": 4
  }
}
```

## Scan Types

### 1. Dependency Scanning
Scans your project dependencies for known vulnerabilities.

**Tools:** Trivy, Snyk
**Targets:** package.json, package-lock.json, requirements.txt, go.mod, etc.

### 2. Secrets Scanning
Detects exposed secrets, API keys, and credentials in your codebase.

**Tools:** Trivy
**Targets:** All files in the repository

### 3. Container Scanning
Scans Docker images and Dockerfiles for vulnerabilities and misconfigurations.

**Tools:** Trivy
**Targets:** Dockerfile, built images

### 4. SAST (Static Application Security Testing)
Analyzes source code for security vulnerabilities and code quality issues.

**Tools:** Semgrep
**Targets:** Source code files

## GitHub Actions Integration

The project includes a comprehensive GitHub Actions workflow that automatically runs security scans on every push and pull request.

### Workflow Features

- Trivy vulnerability scanning (filesystem and container)
- Secret detection
- Dependency auditing
- Docker image security scanning
- SARIF upload to GitHub Security tab
- Security summary generation
- PR comments with scan results

### View Results

1. Go to your GitHub repository
2. Click on the "Security" tab
3. View "Code scanning alerts" for detailed vulnerability reports

## Configuration

### Environment Variables

No additional environment variables are required for local development. The scanners will gracefully fallback if tools are not installed.

### Scanner Selection

You can specify which scanner to use when calling the API:

```javascript
{
  "scannerType": "trivy"  // or "snyk"
}
```

### Fallback Behavior

If a scanner is not installed, the system will:
1. Attempt to use the requested scanner
2. Fall back to an alternative scanner if available
3. Return a safe fallback result with a message indicating the scanner is not available

## Security Score Calculation

The security score is calculated based on:

- **Critical vulnerabilities:** -10 points each
- **High vulnerabilities:** -5 points each
- **Medium vulnerabilities:** -2 points each
- **Low vulnerabilities:** -1 point each

Starting from 100, the minimum score is 0.

## Risk Level Determination

- **Critical:** Any critical vulnerability present
- **High:** More than 2 high vulnerabilities
- **Medium:** 1+ high vulnerabilities or 5+ total vulnerabilities
- **Low:** Few or no vulnerabilities

## Best Practices

1. **Run scans regularly** - Integrate into your CI/CD pipeline
2. **Fix critical issues first** - Prioritize based on severity
3. **Keep dependencies updated** - Use automated dependency updates
4. **Monitor trends** - Track security score over time
5. **Review findings** - Not all findings are exploitable in your context

## Troubleshooting

### Trivy not found
```bash
which trivy
```
If not found, install Trivy following the installation instructions above.

### Snyk authentication failed
```bash
snyk auth
```
Follow the prompts to authenticate with your Snyk account.

### Scan timeout
Increase the timeout in the scanner configuration:
```javascript
{ timeout: 120000 } // 2 minutes
```

### Permission denied
Ensure the scanner has read access to your project files:
```bash
chmod -R 755 /path/to/project
```

## Advanced Usage

### Custom Scan Configuration

You can extend the SecurityScanner class to add custom scanning logic:

```javascript
import { SecurityScanner } from './utils/security-scanner.js';

class CustomScanner extends SecurityScanner {
  static async runCustomScan(projectPath) {
    // Your custom scanning logic
  }
}
```

### Integrating Additional Scanners

To add a new scanner:

1. Add the scanner method in `SecurityScanner` class
2. Update the parser methods to handle the output format
3. Add fallback handling in `getFallbackScan`
4. Update the scanner selection logic

## Support

For issues or questions:
- Check the [GitHub Issues](https://github.com/your-repo/issues)
- Review the [documentation](./README.md)
- Contact the development team

## License

MIT License - See LICENSE file for details
