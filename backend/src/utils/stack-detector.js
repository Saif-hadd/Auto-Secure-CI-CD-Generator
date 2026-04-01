import axios from 'axios';

export class StackDetector {
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

      if (files.includes('package.json')) {
        stack.type = 'node';
        stack.language = 'JavaScript';
        stack.packageManager = 'npm';

        const packageJson = await this.getFileContent(
          repoFullName,
          'package.json',
          branch,
          accessToken
        );

        if (packageJson) {
          const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

          if (deps.react) {
            stack.framework = 'React';
          } else if (deps.vue) {
            stack.framework = 'Vue';
          } else if (deps.angular) {
            stack.framework = 'Angular';
          } else if (deps.express) {
            stack.framework = 'Express';
          } else if (deps.next) {
            stack.framework = 'Next.js';
          }

          stack.hasTests = !!(deps.jest || deps.vitest || deps.mocha || packageJson.scripts?.test);
        }
      } else if (files.includes('requirements.txt') || files.includes('setup.py')) {
        stack.type = 'python';
        stack.language = 'Python';
        stack.packageManager = 'pip';

        const requirements = await this.getFileContent(
          repoFullName,
          'requirements.txt',
          branch,
          accessToken
        );

        if (requirements && typeof requirements === 'string') {
          if (requirements.includes('django')) {
            stack.framework = 'Django';
          } else if (requirements.includes('flask')) {
            stack.framework = 'Flask';
          } else if (requirements.includes('fastapi')) {
            stack.framework = 'FastAPI';
          }

          stack.hasTests = requirements.includes('pytest') || requirements.includes('unittest');
        }
      } else if (files.includes('pom.xml')) {
        stack.type = 'java';
        stack.language = 'Java';
        stack.packageManager = 'maven';
        stack.buildTool = 'Maven';
        stack.framework = 'Spring';
      } else if (files.includes('build.gradle')) {
        stack.type = 'java';
        stack.language = 'Java';
        stack.packageManager = 'gradle';
        stack.buildTool = 'Gradle';
      } else if (files.includes('go.mod')) {
        stack.type = 'go';
        stack.language = 'Go';
        stack.packageManager = 'go mod';
      } else if (files.includes('Cargo.toml')) {
        stack.type = 'rust';
        stack.language = 'Rust';
        stack.packageManager = 'cargo';
      } else if (files.includes('composer.json')) {
        stack.type = 'php';
        stack.language = 'PHP';
        stack.packageManager = 'composer';
      }

      stack.dockerized = files.includes('Dockerfile') || files.includes('docker-compose.yml');

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
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
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
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

      if (filePath.endsWith('.json')) {
        return JSON.parse(content);
      }

      return content;
    } catch (error) {
      return null;
    }
  }
}
