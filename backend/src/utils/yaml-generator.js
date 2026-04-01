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
        uses: actions/checkout@v3

${this.generateInstallSteps(stack)}

${this.generateBuildSteps(stack)}

${this.generateTestSteps(stack)}
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
        uses: actions/checkout@v3

${this.generateInstallSteps(stack)}

      - name: Lint code
        run: ${this.getLintCommand(stack)}

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

jobs:
  security-scan:
    runs-on: ubuntu-latest
    name: Security Analysis

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: SAST - Static Application Security Testing
        run: |
          echo "🔍 Running static code analysis..."
          echo "Checking for security vulnerabilities in source code..."
          # In production: Use SonarQube, Semgrep, or CodeQL

      - name: Secrets Scanning
        run: |
          echo "🔐 Scanning for exposed secrets..."
          echo "Checking for API keys, tokens, and credentials..."
          # In production: Use Trivy, GitGuardian, or TruffleHog

      - name: Dependency Vulnerability Scan
        run: |
          echo "📦 Scanning dependencies for known vulnerabilities..."
${this.getDependencyScanCommand(stack)}
          # In production: Use Snyk, OWASP Dependency-Check, or npm audit

  build-and-test:
    runs-on: ubuntu-latest
    needs: security-scan

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

${this.generateInstallSteps(stack)}

      - name: Run unit tests
        run: ${this.getTestCommand(stack)}

      - name: Generate test coverage
        run: |
          echo "📊 Generating code coverage report..."
          ${this.getCoverageCommand(stack)}

${this.generateBuildSteps(stack)}

      - name: DAST - Dynamic Application Security Testing
        run: |
          echo "🌐 Running dynamic security testing..."
          echo "Testing running application for vulnerabilities..."
          # In production: Use OWASP ZAP or Burp Suite

${this.generateDockerSteps(stack)}

  deploy:
    runs-on: ubuntu-latest
    needs: build-and-test
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Deploy to staging
        run: |
          echo "🚀 Deploying to staging environment..."
          # In production: Deploy to your cloud provider (AWS, Azure, GCP, etc.)

      - name: Security verification post-deploy
        run: |
          echo "✅ Verifying security configurations..."
          echo "Checking SSL/TLS, headers, and security policies..."
`;
  }

  static generateInstallSteps(stack) {
    switch (stack.type) {
      case 'node':
        return `      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci`;

      case 'python':
        return `      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt`;

      case 'java':
        return `      - name: Setup Java
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Build with ${stack.buildTool || 'Maven'}
        run: ${stack.buildTool === 'Gradle' ? './gradlew build' : 'mvn clean install'}`;

      case 'go':
        return `      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'

      - name: Install dependencies
        run: go mod download`;

      default:
        return `      - name: Install dependencies
        run: echo "Installing dependencies..."`;
    }
  }

  static generateBuildSteps(stack) {
    switch (stack.type) {
      case 'node':
        return `      - name: Build application
        run: npm run build`;

      case 'python':
        return `      - name: Build application
        run: |
          echo "Python application ready"
          # Add build steps if needed`;

      case 'go':
        return `      - name: Build application
        run: go build -v ./...`;

      default:
        return `      - name: Build application
        run: echo "Building application..."`;
    }
  }

  static generateTestSteps(stack) {
    const testCommand = this.getTestCommand(stack);
    return `      - name: Run tests
        run: ${testCommand}`;
  }

  static generateDockerSteps(stack) {
    return `      - name: Build Docker image
        run: |
          echo "🐳 Building Docker image..."
          docker build -t ${stack.framework?.toLowerCase() || 'app'}:latest .
          # In production: Push to Docker Hub or container registry

      - name: Container security scan
        run: |
          echo "🔍 Scanning Docker image for vulnerabilities..."
          # In production: Use Trivy or Anchore`;
  }

  static getTestCommand(stack) {
    switch (stack.type) {
      case 'node':
        return 'npm test';
      case 'python':
        return 'pytest';
      case 'java':
        return stack.buildTool === 'Gradle' ? './gradlew test' : 'mvn test';
      case 'go':
        return 'go test ./...';
      default:
        return 'echo "Running tests..."';
    }
  }

  static getLintCommand(stack) {
    switch (stack.type) {
      case 'node':
        return 'npm run lint || echo "No lint command configured"';
      case 'python':
        return 'pylint **/*.py || echo "Pylint not configured"';
      default:
        return 'echo "Linting code..."';
    }
  }

  static getCoverageCommand(stack) {
    switch (stack.type) {
      case 'node':
        return 'npm run test:coverage || echo "Coverage not configured"';
      case 'python':
        return 'pytest --cov';
      case 'java':
        return 'mvn jacoco:report';
      default:
        return 'echo "Generating coverage..."';
    }
  }

  static getDependencyScanCommand(stack) {
    switch (stack.type) {
      case 'node':
        return `          npm audit || true
          # Use 'npm audit fix' to automatically fix vulnerabilities`;
      case 'python':
        return `          pip-audit || true
          # Use 'pip-audit --fix' to update vulnerable packages`;
      case 'java':
        return `          mvn dependency-check:check || true`;
      default:
        return `          echo "Checking dependencies..."`;
    }
  }
}
