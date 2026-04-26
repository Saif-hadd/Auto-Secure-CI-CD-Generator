import type { User } from '../types/user';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CSRF_COOKIE_NAME = import.meta.env.VITE_CSRF_COOKIE_NAME || 'autosecure_csrf';

interface Repository {
  id: string;
  repo_name: string;
  repo_full_name: string;
  stack_detected: unknown;
}

interface Pipeline {
  id: string;
  generated_yaml: string;
  status: string;
  security_features: string[];
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null;
}

function parseString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid API response: ${fieldName} must be a string`);
  }

  return value;
}

function parseNullableString(value: unknown, fieldName: string): string | null {
  if (value === null) {
    return null;
  }

  return parseString(value, fieldName);
}

function parseGithubId(value: unknown): number {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsedValue = Number(value);

    if (Number.isSafeInteger(parsedValue)) {
      return parsedValue;
    }
  }

  throw new Error('Invalid API response: github_id must be a safe integer');
}

function normalizeUser(value: unknown): User {
  if (!isJsonObject(value)) {
    throw new Error('Invalid API response: user payload must be an object');
  }

  return {
    id: parseString(value.id, 'user.id'),
    github_id: parseGithubId(value.github_id),
    username: parseString(value.username, 'user.username'),
    email: parseNullableString(value.email, 'user.email'),
    avatar_url: parseString(value.avatar_url, 'user.avatar_url'),
  };
}

function normalizeAuthResponse(value: unknown): { user: User } {
  if (!isJsonObject(value)) {
    throw new Error('Invalid API response: auth payload must be an object');
  }

  return {
    user: normalizeUser(value.user),
  };
}

function normalizeCurrentUserResponse(value: unknown): { user: User } {
  if (!isJsonObject(value)) {
    throw new Error('Invalid API response: current user payload must be an object');
  }

  return {
    user: normalizeUser(value.user),
  };
}

export class ApiClient {
  private static getCookie(name: string): string | null {
    const cookies = document.cookie
      .split(';')
      .map((cookie) => cookie.trim())
      .filter(Boolean);

    for (const cookie of cookies) {
      const separatorIndex = cookie.indexOf('=');

      if (separatorIndex === -1) {
        continue;
      }

      const key = cookie.slice(0, separatorIndex);

      if (key === name) {
        return decodeURIComponent(cookie.slice(separatorIndex + 1));
      }
    }

    return null;
  }

  private static isUnsafeMethod(method: string): boolean {
    return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  }

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {},
    config: { csrfProtected?: boolean } = {}
  ): Promise<T> {
    const method = options.method || 'GET';
    const shouldAttachCsrfToken = config.csrfProtected !== false && this.isUnsafeMethod(method);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (shouldAttachCsrfToken) {
      const csrfToken = this.getCookie(CSRF_COOKIE_NAME);

      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  static async getGitHubAuthUrl() {
    return this.request<{ url: string }>('/api/auth/github/url');
  }

  static async githubCallback(code: string, state: string) {
    const response = await this.request<unknown>('/api/auth/github/callback', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    }, {
      csrfProtected: false
    });

    return normalizeAuthResponse(response);
  }

  static async getCurrentUser() {
    const response = await this.request<unknown>('/api/auth/me');

    return normalizeCurrentUserResponse(response);
  }

  static async logout() {
    return this.request<{ message: string }>('/api/auth/logout', {
      method: 'POST'
    });
  }

  static async syncRepositories() {
    return this.request<{ repositories: Repository[] }>('/api/repos/sync', {
      method: 'POST',
    });
  }

  static async getUserRepositories() {
    return this.request<{ repositories: Repository[] }>('/api/repos');
  }

  static async getRepository(repoId: string) {
    return this.request<{ repository: Repository }>(`/api/repos/${repoId}`);
  }

  static async detectStack(repoId: string) {
    return this.request<{ stack: unknown }>(`/api/repos/${repoId}/detect-stack`, {
      method: 'POST',
    });
  }

  static async generatePipeline(repoId: string, pipelineType: string = 'secure') {
    return this.request<{ pipeline: Pipeline }>('/api/pipelines/generate', {
      method: 'POST',
      body: JSON.stringify({ repoId, pipelineType }),
    });
  }

  static async getPipelinesByRepo(repoId: string) {
    return this.request<{ pipelines: Pipeline[] }>(`/api/pipelines/repo/${repoId}`);
  }

  static async pushPipelineToGitHub(pipelineId: string) {
    return this.request<{ success: boolean; message: string; url: string }>(
      `/api/pipelines/${pipelineId}/push`,
      { method: 'POST' }
    );
  }

  static async getSecurityDashboard(pipelineId: string) {
    return this.request<unknown>(`/api/pipelines/${pipelineId}/security`);
  }

  static async analyzeYAML(yaml: string) {
    return this.request<unknown>('/api/analyzer/analyze', {
      method: 'POST',
      body: JSON.stringify({ yaml }),
    });
  }

  static async runAutoRemediation(pipelineId: string, projectPath?: string) {
    return this.request<unknown>(`/api/remediation/${pipelineId}/remediate`, {
      method: 'POST',
      body: JSON.stringify({ projectPath }),
    });
  }

  static async getRemediationHistory(pipelineId: string) {
    return this.request<{ success: boolean; remediations: unknown[] }>(
      `/api/remediation/${pipelineId}/history`
    );
  }

  static async getLatestRemediation(pipelineId: string) {
    return this.request<{ success: boolean; remediation: unknown }>(
      `/api/remediation/${pipelineId}/latest`
    );
  }
}
