import axios from 'axios';
import fs from 'fs';
import path from 'path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'vendor', '__pycache__', 'coverage', '.cache']);

function getAllFiles(dirPath, depth = 0, maxDepth = 2) {
  const fileList = [];
  if (depth > maxDepth) return fileList;

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return fileList;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        const subFiles = getAllFiles(path.join(dirPath, entry.name), depth + 1, maxDepth);
        fileList.push(...subFiles);
      }
    } else if (entry.isFile()) {
      fileList.push(path.join(dirPath, entry.name));
    }
  }

  return fileList;
}

export class StackDetector {

  static async detectFromLocal(projectPath) {
    try {
      const allFiles = getAllFiles(projectPath);
      const fileNames = allFiles.map(f => path.basename(f));
      const filePaths = allFiles.map(f => path.relative(projectPath, f));

      console.log(`📦 Files found (first 20): ${filePaths.slice(0, 20).join(', ')}`);

      const stack = {
        type: 'unknown',
        framework: null,
        language: null,
        hasTests: false,
        dockerized: false,
        packageManager: null,
        buildTool: null
      };

      const packageJsonPath = allFiles.find(
        f => path.basename(f) === 'package.json' && !f.includes('node_modules')
      );
      const requirementsTxtPath = allFiles.find(f => path.basename(f) === 'requirements.txt');
      const setupPyPath = allFiles.find(f => path.basename(f) === 'setup.py');
      const pyprojectPath = allFiles.find(f => path.basename(f) === 'pyproject.toml');
      const pomXmlPath = allFiles.find(f => path.basename(f) === 'pom.xml');
      const buildGradlePath = allFiles.find(
        f => path.basename(f) === 'build.gradle' || path.basename(f) === 'build.gradle.kts'
      );
      const goModPath = allFiles.find(f => path.basename(f) === 'go.mod');
      const cargoTomlPath = allFiles.find(f => path.basename(f) === 'Cargo.toml');
      const composerJsonPath = allFiles.find(f => path.basename(f) === 'composer.json');

      if (packageJsonPath) {
        stack.type = 'node';
        stack.language = 'JavaScript';
        stack.packageManager = 'npm';

        const pkgDir = path.dirname(packageJsonPath);
        if (fs.existsSync(path.join(pkgDir, 'yarn.lock'))) stack.packageManager = 'yarn';
        else if (fs.existsSync(path.join(pkgDir, 'pnpm-lock.yaml'))) stack.packageManager = 'pnpm';

        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

          if (deps.react || deps['react-dom']) stack.framework = 'React';
          else if (deps.vue) stack.framework = 'Vue';
          else if (deps['@angular/core']) stack.framework = 'Angular';
          else if (deps.express) stack.framework = 'Express';
          else if (deps.next) stack.framework = 'Next.js';
          else if (deps['@nestjs/core']) stack.framework = 'NestJS';
          else if (deps.fastify) stack.framework = 'Fastify';
          else if (deps.koa) stack.framework = 'Koa';

          stack.hasTests = !!(
            deps.jest || deps.vitest || deps.mocha || deps.jasmine || deps.cypress ||
            packageJson.scripts?.test
          );

          if (deps.typescript || fileNames.includes('tsconfig.json')) {
            stack.language = 'TypeScript';
          }

        } catch (e) {
          console.error('Error reading package.json:', e.message);
        }

      } else if (requirementsTxtPath || setupPyPath || pyprojectPath) {
        stack.type = 'python';
        stack.language = 'Python';
        stack.packageManager = 'pip';

        try {
          if (requirementsTxtPath) {
            const requirements = fs.readFileSync(requirementsTxtPath, 'utf-8').toLowerCase();
            if (requirements.includes('django')) stack.framework = 'Django';
            else if (requirements.includes('flask')) stack.framework = 'Flask';
            else if (requirements.includes('fastapi')) stack.framework = 'FastAPI';
            else if (requirements.includes('tornado')) stack.framework = 'Tornado';
            stack.hasTests = requirements.includes('pytest') || requirements.includes('unittest');
          }

          if (!stack.hasTests) {
            stack.hasTests = filePaths.some(f => f.startsWith('tests/') || f.startsWith('test/'));
          }
        } catch (e) {
          console.error('Error reading requirements.txt:', e.message);
        }

      } else if (pomXmlPath) {
        stack.type = 'java';
        stack.language = 'Java';
        stack.packageManager = 'maven';
        stack.buildTool = 'Maven';
        stack.framework = 'Spring';
        stack.hasTests = true;

      } else if (buildGradlePath) {
        stack.type = 'java';
        stack.language = 'Java';
        stack.packageManager = 'gradle';
        stack.buildTool = 'Gradle';
        stack.hasTests = true;

      } else if (goModPath) {
        stack.type = 'go';
        stack.language = 'Go';
        stack.packageManager = 'go mod';

        try {
          const goMod = fs.readFileSync(goModPath, 'utf-8');
          if (goMod.includes('gin-gonic/gin')) stack.framework = 'Gin';
          else if (goMod.includes('labstack/echo')) stack.framework = 'Echo';
          else if (goMod.includes('gofiber/fiber')) stack.framework = 'Fiber';
        } catch {}

        stack.hasTests = filePaths.some(f => f.endsWith('_test.go'));

      } else if (cargoTomlPath) {
        stack.type = 'rust';
        stack.language = 'Rust';
        stack.packageManager = 'cargo';
        stack.hasTests = true;

      } else if (composerJsonPath) {
        stack.type = 'php';
        stack.language = 'PHP';
        stack.packageManager = 'composer';

        try {
          const composer = JSON.parse(fs.readFileSync(composerJsonPath, 'utf-8'));
          const deps = { ...composer.require, ...composer['require-dev'] };
          if (deps['laravel/framework']) stack.framework = 'Laravel';
          else if (deps['symfony/symfony'] || deps['symfony/framework-bundle']) stack.framework = 'Symfony';
        } catch {}
      }

      stack.dockerized = fileNames.includes('Dockerfile') ||
                         fileNames.includes('docker-compose.yml') ||
                         fileNames.includes('docker-compose.yaml');

      console.log(`✅ Stack detected locally: ${stack.type} / ${stack.framework || 'no framework'} (${stack.language})`);
      return stack;

    } catch (error) {
      console.error('Local stack detection error:', error);
      return {
        type: 'unknown',
        framework: null,
        language: null,
        hasTests: false,
        dockerized: false,
        packageManager: null,
        buildTool: null
      };
    }
  }

  static async detect(repoFullName, branch, accessToken) {
    try {
      const files = await this.getRepoFiles(repoFullName, branch, accessToken);

      const stack = {
        type: 'unknown',
        framework: null,
        language: null,
        hasTests: false,
        dockerized: false,
        packageManager: null,
        buildTool: null
      };

      const fileNames = files.map(f => path.basename(f));

      if (fileNames.includes('package.json')) {
        stack.type = 'node';
        stack.language = 'JavaScript';
        stack.packageManager = 'npm';

        const packageJson = await this.getFileContent(
          repoFullName, 'package.json', branch, accessToken
        );

        if (packageJson) {
          const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

          if (deps.react || deps['react-dom']) stack.framework = 'React';
          else if (deps.vue) stack.framework = 'Vue';
          else if (deps['@angular/core']) stack.framework = 'Angular';
          else if (deps.express) stack.framework = 'Express';
          else if (deps.next) stack.framework = 'Next.js';
          else if (deps['@nestjs/core']) stack.framework = 'NestJS';

          stack.hasTests = !!(deps.jest || deps.vitest || deps.mocha || packageJson.scripts?.test);

          if (deps.typescript || fileNames.includes('tsconfig.json')) {
            stack.language = 'TypeScript';
          }
        }
      } else if (fileNames.includes('requirements.txt') || fileNames.includes('setup.py')) {
        stack.type = 'python';
        stack.language = 'Python';
        stack.packageManager = 'pip';

        const requirements = await this.getFileContent(
          repoFullName, 'requirements.txt', branch, accessToken
        );

        if (requirements && typeof requirements === 'string') {
          if (requirements.includes('django')) stack.framework = 'Django';
          else if (requirements.includes('flask')) stack.framework = 'Flask';
          else if (requirements.includes('fastapi')) stack.framework = 'FastAPI';
          stack.hasTests = requirements.includes('pytest') || requirements.includes('unittest');
        }
      } else if (fileNames.includes('pom.xml')) {
        stack.type = 'java';
        stack.language = 'Java';
        stack.packageManager = 'maven';
        stack.buildTool = 'Maven';
        stack.framework = 'Spring';
      } else if (fileNames.includes('build.gradle') || fileNames.includes('build.gradle.kts')) {
        stack.type = 'java';
        stack.language = 'Java';
        stack.packageManager = 'gradle';
        stack.buildTool = 'Gradle';
      } else if (fileNames.includes('go.mod')) {
        stack.type = 'go';
        stack.language = 'Go';
        stack.packageManager = 'go mod';
      } else if (fileNames.includes('Cargo.toml')) {
        stack.type = 'rust';
        stack.language = 'Rust';
        stack.packageManager = 'cargo';
      } else if (fileNames.includes('composer.json')) {
        stack.type = 'php';
        stack.language = 'PHP';
        stack.packageManager = 'composer';
      }

      stack.dockerized = fileNames.includes('Dockerfile') || fileNames.includes('docker-compose.yml');

      return stack;
    } catch (error) {
      console.error('Stack detection error:', error);
      return {
        type: 'unknown',
        framework: null,
        language: null,
        hasTests: false,
        dockerized: false,
        packageManager: null,
        buildTool: null
      };
    }
  }

  static async getRepoFiles(repoFullName, branch, accessToken) {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${repoFullName}/git/trees/${branch}?recursive=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return response.data.tree.map(item => item.path);
    } catch (error) {
      console.error('Get repo files error:', error);
      return [];
    }
  }

  static async getFileContent(repoFullName, filePath, branch, accessToken) {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${repoFullName}/contents/${filePath}?ref=${branch}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

      if (filePath.endsWith('.json')) {
        return JSON.parse(content);
      }

      return content;
    } catch {
      return null;
    }
  }
}
