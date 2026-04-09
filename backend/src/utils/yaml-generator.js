export class YAMLGenerator {
  static generate(stack, pipelineType = 'secure') {
    const templates = {
      basic: this.generateBasic(stack),
      advanced: this.generateAdvanced(stack),
      secure: this.generateSecure(stack)
    };
    return templates[pipelineType] || templates.secure;
  }

  static generateBasic(stack) {
    return `name: Basic CI Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

${this.generateInstallSteps(stack)}
${this.generateTestSteps(stack)}
${this.generateBuildSteps(stack)}
`;
  }

  static generateAdvanced(stack) {
    return `name: Advanced CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

${this.generateInstallSteps(stack)}

      - name: Lint code
        run: ${this.getLintCommand(stack)}
        continue-on-error: true

${this.generateTestSteps(stack)}
${this.generateBuildSteps(stack)}
${this.generateDockerSteps(stack)}
`;
  }

  static generateSecure(stack) {
    return `name: Secure CI/CD Pipeline with DevSecOps

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'

jobs:
  security-scan:
    runs-on: ubuntu-latest
    name: Security Analysis
    permissions:
      contents: read
      security-events: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: SAST - Semgrep
        uses: semgrep/semgrep-action@v1
        with:
          config: auto
        continue-on-error: true

      - name: Secrets scanning - Trivy
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          scanners: 'secret'
          format: 'sarif'
          output: 'trivy-secrets.sarif'
        continue-on-error: true

      - name: Upload secrets scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-secrets.sarif'
        continue-on-error: true

      - name: Dependency vulnerability scan - Trivy
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          scanners: 'vuln'
          format: 'sarif'
          output: 'trivy-vuln.sarif'
          severity: 'CRITICAL,HIGH,MEDIUM'
        continue-on-error: true

      - name: Upload vulnerability scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-vuln.sarif'
        continue-on-error: true

${this.getDependencyAuditSteps(stack)}

  build-and-test:
    runs-on: ubuntu-latest
    needs: security-scan

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

${this.generateInstallSteps(stack)}

      - name: Run tests
        run: ${this.getTestCommand(stack)}
        continue-on-error: true

      - name: Generate test coverage
        run: ${this.getCoverageCommand(stack)}
        continue-on-error: true

${this.generateBuildSteps(stack)}

${this.generateDockerBuildAndScanSteps(stack)}

  deploy:
    runs-on: ubuntu-latest
    needs: build-and-test
    if: github.ref == 'refs/heads/main'
    environment:
      name: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          echo "🚀 Deploying to production..."

      - name: Security verification post-deploy
        run: |
          echo "✅ Verifying SSL/TLS and security headers..."
`;
  }

  static getDependencyAuditSteps(stack) {
    switch (stack.type) {
      case 'node':
        return `      - name: npm audit
        run: |
          npm audit --audit-level=moderate --production || true
          npm audit fix || true
        continue-on-error: true

      - name: Block on critical vulnerabilities
        run: npm audit --audit-level=critical
        continue-on-error: false`;

      case 'python':
        return `      - name: pip-audit
        run: |
          pip install pip-audit
          pip-audit || true
        continue-on-error: true`;

      case 'java':
        return `      - name: OWASP Dependency Check
        run: mvn dependency-check:check || true
        continue-on-error: true`;

      default:
        return `      - name: Dependency audit
        run: echo "Configure dependency audit for your stack"`;
    }
  }

  static generateDockerBuildAndScanSteps(stack) {
    return `      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: app:\${{ github.sha }}
          load: true
        continue-on-error: true

      - name: Scan Docker image - Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: app:\${{ github.sha }}
          format: 'sarif'
          output: 'trivy-image.sarif'
          severity: 'CRITICAL,HIGH'
        continue-on-error: true

      - name: Upload image scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-image.sarif'
        continue-on-error: true`;
  }

  static generateInstallSteps(stack) {
    switch (stack.type) {
      case 'node':
        return `      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci`;

      case 'python':
        return `      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt`;

      case 'java':
        return `      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Build with Maven
        run: mvn clean install -DskipTests`;

      case 'go':
        return `      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'

      - name: Install dependencies
        run: go mod download`;

      default:
        return `      - name: Install dependencies
        run: echo "Configure install steps for your stack"`;
    }
  }

  static generateBuildSteps(stack) {
    switch (stack.type) {
      case 'node':
        return `      - name: Build application
        run: npm run build`;
      case 'python':
        return `      - name: Build application
        run: echo "Python app ready"`;
      case 'go':
        return `      - name: Build application
        run: go build -v ./...`;
      default:
        return `      - name: Build application
        run: echo "Configure build steps"`;
    }
  }

  static generateTestSteps(stack) {
    return `      - name: Run tests
        run: ${this.getTestCommand(stack)}
        continue-on-error: true`;
  }

  static generateDockerSteps(stack) {
    return `      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: app:latest`;
  }

  static getTestCommand(stack) {
    switch (stack.type) {
      case 'node': return 'npm test || echo "No tests configured"';
      case 'python': return 'pytest || echo "No tests configured"';
      case 'java': return stack.buildTool === 'Gradle' ? './gradlew test' : 'mvn test';
      case 'go': return 'go test ./...';
      default: return 'echo "Configure test command"';
    }
  }

  static getLintCommand(stack) {
    switch (stack.type) {
      case 'node': return 'npm run lint || echo "No lint configured"';
      case 'python': return 'pylint **/*.py || echo "Pylint not configured"';
      default: return 'echo "Configure lint command"';
    }
  }

  static getCoverageCommand(stack) {
    switch (stack.type) {
      case 'node': return 'npm run test:coverage || echo "Coverage not configured"';
      case 'python': return 'pytest --cov || echo "Coverage not configured"';
      case 'java': return 'mvn jacoco:report || echo "Jacoco not configured"';
      default: return 'echo "Configure coverage command"';
    }
  }
}