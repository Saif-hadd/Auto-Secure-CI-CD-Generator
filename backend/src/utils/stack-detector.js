import axios from 'axios';
import fs from 'fs';
import path from 'path';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build',
  '.next', '.nuxt', 'vendor', '__pycache__',
  'coverage', '.cache'
]);

function getAllFiles(dirPath, depth = 0, maxDepth = 5) {
  const fileList = [];
  if (depth > maxDepth) return fileList;

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return fileList;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        fileList.push(...getAllFiles(fullPath, depth + 1, maxDepth));
      }
    } else if (entry.isFile()) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

export class StackDetector {

  // ════════════════════════════════════════════════════════════
  // LOCAL
  // ════════════════════════════════════════════════════════════
  static async detectFromLocal(projectPath) {
    try {
      const allFiles = getAllFiles(projectPath);
      const fileNames = allFiles.map(f => path.basename(f));
      const filePaths = allFiles.map(f => path.relative(projectPath, f));

      console.log(`📦 Files found: ${allFiles.length}`);

      const stack = {
        type: 'unknown',
        framework: null,
        language: null,
        hasTests: false,
        dockerized: false,
        packageManager: null,
        buildTool: null,
        services: []
      };

      // ─────────────────────────────────────────
      // NODE.JS
      // ─────────────────────────────────────────
      const packageJsonFiles = allFiles.filter(
        f => path.basename(f) === 'package.json' && !f.includes('node_modules')
      );

      if (packageJsonFiles.length > 0) {

        for (const pkgPath of packageJsonFiles) {
          try {
            const pkgDir = path.dirname(pkgPath);
            const packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

            const language =
              deps['typescript'] || fs.existsSync(path.join(pkgDir, 'tsconfig.json'))
                ? 'TypeScript'
                : 'JavaScript';

            let framework = null;
            if      (deps['react'] || deps['react-dom']) framework = 'React';
            else if (deps['next'])                       framework = 'Next.js';
            else if (deps['vue'])                        framework = 'Vue';
            else if (deps['@angular/core'])              framework = 'Angular';
            else if (deps['@nestjs/core'])               framework = 'NestJS';
            else if (deps['express'])                    framework = 'Express';
            else if (deps['fastify'])                    framework = 'Fastify';
            else if (deps['koa'])                        framework = 'Koa';

            let packageManager = 'npm';
            if      (fs.existsSync(path.join(pkgDir, 'yarn.lock')))      packageManager = 'yarn';
            else if (fs.existsSync(path.join(pkgDir, 'pnpm-lock.yaml'))) packageManager = 'pnpm';

            const hasTests = !!(
              deps['jest']    || deps['vitest'] ||
              deps['mocha']   || deps['jasmine'] ||
              deps['cypress'] || packageJson.scripts?.test
            );

            stack.services.push({
              path: path.relative(projectPath, pkgDir) || '.',
              framework,
              language,
              packageManager,
              hasTests
            });

          } catch (e) {
            console.error(`Error reading ${pkgPath}:`, e.message);
          }
        }

        if (stack.services.length > 1) {
          stack.type      = 'monorepo';
          stack.framework = stack.services.map(s => s.framework).filter(Boolean).join(' + ') || null;
          stack.language  = [...new Set(stack.services.map(s => s.language))].join(' + ');
        } else {
          stack.type           = 'node';
          stack.framework      = stack.services[0]?.framework      ?? null;
          stack.language       = stack.services[0]?.language       ?? 'JavaScript';
          stack.packageManager = stack.services[0]?.packageManager ?? 'npm';
        }

        stack.hasTests = stack.services.some(s => s.hasTests);

      // ─────────────────────────────────────────
      // PYTHON
      // ─────────────────────────────────────────
      } else if (allFiles.some(f =>
        ['requirements.txt', 'setup.py', 'pyproject.toml'].includes(path.basename(f))
      )) {
        stack.type           = 'python';
        stack.language       = 'Python';
        stack.packageManager = 'pip';

        const reqPath = allFiles.find(f => path.basename(f) === 'requirements.txt');
        if (reqPath) {
          try {
            const req = fs.readFileSync(reqPath, 'utf-8').toLowerCase();
            if      (req.includes('django'))  stack.framework = 'Django';
            else if (req.includes('flask'))   stack.framework = 'Flask';
            else if (req.includes('fastapi')) stack.framework = 'FastAPI';
            else if (req.includes('tornado')) stack.framework = 'Tornado';
            stack.hasTests = req.includes('pytest') || req.includes('unittest');
          } catch (e) {
            console.error('Error reading requirements.txt:', e.message);
          }
        }

        if (!stack.hasTests) {
          stack.hasTests = filePaths.some(f =>
            f.startsWith('tests/') || f.startsWith('test/')
          );
        }

      // ─────────────────────────────────────────
      // JAVA — Maven
      // ─────────────────────────────────────────
      } else if (fileNames.includes('pom.xml')) {
        stack.type           = 'java';
        stack.language       = 'Java';
        stack.packageManager = 'maven';
        stack.buildTool      = 'Maven';
        stack.framework      = 'Spring';
        stack.hasTests       = true;

      // ─────────────────────────────────────────
      // JAVA — Gradle
      // ─────────────────────────────────────────
      } else if (fileNames.includes('build.gradle') || fileNames.includes('build.gradle.kts')) {
        stack.type           = 'java';
        stack.language       = 'Java';
        stack.packageManager = 'gradle';
        stack.buildTool      = 'Gradle';
        stack.hasTests       = true;

      // ─────────────────────────────────────────
      // GO
      // ─────────────────────────────────────────
      } else if (fileNames.includes('go.mod')) {
        stack.type           = 'go';
        stack.language       = 'Go';
        stack.packageManager = 'go mod';

        const goModPath = allFiles.find(f => path.basename(f) === 'go.mod');
        if (goModPath) {
          try {
            const goMod = fs.readFileSync(goModPath, 'utf-8');
            if      (goMod.includes('gin-gonic/gin'))  stack.framework = 'Gin';
            else if (goMod.includes('labstack/echo'))  stack.framework = 'Echo';
            else if (goMod.includes('gofiber/fiber'))  stack.framework = 'Fiber';
          } catch {}
        }

        stack.hasTests = filePaths.some(f => f.endsWith('_test.go'));

      // ─────────────────────────────────────────
      // RUST
      // ─────────────────────────────────────────
      } else if (fileNames.includes('Cargo.toml')) {
        stack.type           = 'rust';
        stack.language       = 'Rust';
        stack.packageManager = 'cargo';
        stack.hasTests       = true;

      // ─────────────────────────────────────────
      // PHP
      // ─────────────────────────────────────────
      } else if (fileNames.includes('composer.json')) {
        stack.type           = 'php';
        stack.language       = 'PHP';
        stack.packageManager = 'composer';

        const composerPath = allFiles.find(f => path.basename(f) === 'composer.json');
        if (composerPath) {
          try {
            const composer = JSON.parse(fs.readFileSync(composerPath, 'utf-8'));
            const deps = { ...composer.require, ...composer['require-dev'] };
            if      (deps['laravel/framework'])        stack.framework = 'Laravel';
            else if (deps['symfony/framework-bundle']) stack.framework = 'Symfony';
          } catch {}
        }
      }

      // ─────────────────────────────────────────
      // DOCKER (tous langages)
      // ─────────────────────────────────────────
      stack.dockerized = allFiles.some(f =>
        ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'].includes(path.basename(f))
      );

      console.log(`✅ Stack: ${stack.type} / ${stack.framework ?? 'no framework'} (${stack.language})`);
      console.log(`📦 Services:`, stack.services);

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
        buildTool: null,
        services: []
      };
    }
  }

  // ════════════════════════════════════════════════════════════
  // GITHUB API
  // ════════════════════════════════════════════════════════════
  static async detect(repoFullName, branch, accessToken) {
    try {
      const files = await this.getRepoFiles(repoFullName, branch, accessToken);
      const fileNames = files.map(f => path.basename(f));

      const stack = {
        type: 'unknown',
        framework: null,
        language: null,
        hasTests: false,
        dockerized: false,
        packageManager: null,
        buildTool: null,
        services: []
      };

      // ─────────────────────────────────────────
      // NODE.JS — parallel fetch
      // ─────────────────────────────────────────
      const packageJsonPaths = files.filter(f => path.basename(f) === 'package.json');

      if (packageJsonPaths.length > 0) {

        const results = await Promise.all(
          packageJsonPaths.map(async (filePath) => {
            const packageJson = await this.getFileContent(
              repoFullName, filePath, branch, accessToken
            );
            return { filePath, packageJson };
          })
        );

        for (const { filePath, packageJson } of results) {
          if (!packageJson || typeof packageJson !== 'object') continue;

          const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
          const pkgDir = path.dirname(filePath);

          const hasTsConfig = files.includes(
            pkgDir === '.' ? 'tsconfig.json' : `${pkgDir}/tsconfig.json`
          );
          const language = deps['typescript'] || hasTsConfig ? 'TypeScript' : 'JavaScript';

          let framework = null;
          if      (deps['react'] || deps['react-dom']) framework = 'React';
          else if (deps['next'])                       framework = 'Next.js';
          else if (deps['vue'])                        framework = 'Vue';
          else if (deps['@angular/core'])              framework = 'Angular';
          else if (deps['@nestjs/core'])               framework = 'NestJS';
          else if (deps['express'])                    framework = 'Express';
          else if (deps['fastify'])                    framework = 'Fastify';
          else if (deps['koa'])                        framework = 'Koa';

          const hasTests = !!(
            deps['jest']    || deps['vitest'] ||
            deps['mocha']   || deps['jasmine'] ||
            deps['cypress'] || packageJson.scripts?.test
          );

          stack.services.push({
            path: pkgDir === '.' ? '(root)' : pkgDir,
            framework,
            language,
            hasTests
          });
        }

        if (stack.services.length > 1) {
          stack.type      = 'monorepo';
          stack.framework = stack.services.map(s => s.framework).filter(Boolean).join(' + ') || null;
          stack.language  = [...new Set(stack.services.map(s => s.language))].join(' + ');
        } else {
          stack.type      = 'node';
          stack.framework = stack.services[0]?.framework ?? null;
          stack.language  = stack.services[0]?.language  ?? 'JavaScript';
        }

        stack.hasTests = stack.services.some(s => s.hasTests);

      // ─────────────────────────────────────────
      // PYTHON
      // ─────────────────────────────────────────
      } else if (fileNames.includes('requirements.txt') || fileNames.includes('setup.py')) {
        stack.type           = 'python';
        stack.language       = 'Python';
        stack.packageManager = 'pip';

        const requirements = await this.getFileContent(
          repoFullName, 'requirements.txt', branch, accessToken
        );

        if (requirements && typeof requirements === 'string') {
          const req = requirements.toLowerCase();
          if      (req.includes('django'))  stack.framework = 'Django';
          else if (req.includes('flask'))   stack.framework = 'Flask';
          else if (req.includes('fastapi')) stack.framework = 'FastAPI';
          else if (req.includes('tornado')) stack.framework = 'Tornado';
          stack.hasTests = req.includes('pytest') || req.includes('unittest');
        }

      // ─────────────────────────────────────────
      // JAVA — Maven
      // ─────────────────────────────────────────
      } else if (fileNames.includes('pom.xml')) {
        stack.type           = 'java';
        stack.language       = 'Java';
        stack.packageManager = 'maven';
        stack.buildTool      = 'Maven';
        stack.framework      = 'Spring';
        stack.hasTests       = true;

      // ─────────────────────────────────────────
      // JAVA — Gradle
      // ─────────────────────────────────────────
      } else if (fileNames.includes('build.gradle') || fileNames.includes('build.gradle.kts')) {
        stack.type           = 'java';
        stack.language       = 'Java';
        stack.packageManager = 'gradle';
        stack.buildTool      = 'Gradle';
        stack.hasTests       = true;

      // ─────────────────────────────────────────
      // GO
      // ─────────────────────────────────────────
      } else if (fileNames.includes('go.mod')) {
        stack.type           = 'go';
        stack.language       = 'Go';
        stack.packageManager = 'go mod';

        const goMod = await this.getFileContent(
          repoFullName, 'go.mod', branch, accessToken
        );
        if (goMod && typeof goMod === 'string') {
          if      (goMod.includes('gin-gonic/gin'))  stack.framework = 'Gin';
          else if (goMod.includes('labstack/echo'))  stack.framework = 'Echo';
          else if (goMod.includes('gofiber/fiber'))  stack.framework = 'Fiber';
        }

        stack.hasTests = files.some(f => f.endsWith('_test.go'));

      // ─────────────────────────────────────────
      // RUST
      // ─────────────────────────────────────────
      } else if (fileNames.includes('Cargo.toml')) {
        stack.type           = 'rust';
        stack.language       = 'Rust';
        stack.packageManager = 'cargo';
        stack.hasTests       = true;

      // ─────────────────────────────────────────
      // PHP
      // ─────────────────────────────────────────
      } else if (fileNames.includes('composer.json')) {
        stack.type           = 'php';
        stack.language       = 'PHP';
        stack.packageManager = 'composer';

        const composer = await this.getFileContent(
          repoFullName, 'composer.json', branch, accessToken
        );
        if (composer && typeof composer === 'object') {
          const deps = { ...composer.require, ...composer['require-dev'] };
          if      (deps['laravel/framework'])        stack.framework = 'Laravel';
          else if (deps['symfony/framework-bundle']) stack.framework = 'Symfony';
        }
      }

      // ─────────────────────────────────────────
      // DOCKER (tous langages)
      // ─────────────────────────────────────────
      stack.dockerized = fileNames.includes('Dockerfile') ||
                         fileNames.includes('docker-compose.yml') ||
                         fileNames.includes('docker-compose.yaml');

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
        buildTool: null,
        services: []
      };
    }
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════
  static async getRepoFiles(repoFullName, branch, accessToken) {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${repoFullName}/git/trees/${branch}?recursive=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return response.data.tree
        .filter(item => item.type === 'blob')
        .map(item => item.path);
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
      return filePath.endsWith('.json') ? JSON.parse(content) : content;
    } catch {
      return null;
    }
  }
}