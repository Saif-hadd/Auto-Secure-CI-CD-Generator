const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class ApiClient {
  private static getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  static async githubCallback(code: string) {
    return this.request<{ user: any; token: string }>('/api/auth/github/callback', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  static async getCurrentUser() {
    return this.request<{ user: any }>('/api/auth/me');
  }

  static async syncRepositories() {
    return this.request<{ repositories: any[] }>('/api/repos/sync', {
      method: 'POST',
    });
  }

  static async getUserRepositories() {
    return this.request<{ repositories: any[] }>('/api/repos');
  }

  static async getRepository(repoId: string) {
    return this.request<{ repository: any }>(`/api/repos/${repoId}`);
  }

  static async detectStack(repoId: string) {
    return this.request<{ stack: any }>(`/api/repos/${repoId}/detect-stack`, {
      method: 'POST',
    });
  }

  static async generatePipeline(repoId: string, pipelineType: string = 'secure') {
    return this.request<{ pipeline: any }>('/api/pipelines/generate', {
      method: 'POST',
      body: JSON.stringify({ repoId, pipelineType }),
    });
  }

  static async getPipelinesByRepo(repoId: string) {
    return this.request<{ pipelines: any[] }>(`/api/pipelines/repo/${repoId}`);
  }

  static async pushPipelineToGitHub(pipelineId: string) {
    return this.request<{ success: boolean; message: string; url: string }>(
      `/api/pipelines/${pipelineId}/push`,
      { method: 'POST' }
    );
  }

  static async getSecurityDashboard(pipelineId: string) {
    return this.request<any>(`/api/pipelines/${pipelineId}/security`);
  }

  static async analyzeYAML(yaml: string) {
    return this.request<any>('/api/analyzer/analyze', {
      method: 'POST',
      body: JSON.stringify({ yaml }),
    });
  }

  static async runAutoRemediation(pipelineId: string, projectPath?: string) {
    return this.request<any>(`/api/remediation/${pipelineId}/remediate`, {
      method: 'POST',
      body: JSON.stringify({ projectPath }),
    });
  }

  static async getRemediationHistory(pipelineId: string) {
    return this.request<{ success: boolean; remediations: any[] }>(
      `/api/remediation/${pipelineId}/history`
    );
  }

  static async getLatestRemediation(pipelineId: string) {
    return this.request<{ success: boolean; remediation: any }>(
      `/api/remediation/${pipelineId}/latest`
    );
  }
}
