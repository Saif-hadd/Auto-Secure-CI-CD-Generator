import { useState, useEffect } from 'react';
import { RefreshCw, GitBranch, Lock } from 'lucide-react';
import { ApiClient } from '../lib/api';
import { RepositoryCard } from './RepositoryCard';
import { PipelineGenerator } from './PipelineGenerator';
import { AnalyzerPage } from './AnalyzerPage';

export function Dashboard() {
  const [repositories, setRepositories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'repos' | 'analyzer'>('repos');

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    try {
      const { repositories: repos } = await ApiClient.getUserRepositories();
      setRepositories(repos);
    } catch (error) {
      console.error('Failed to load repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { repositories: repos } = await ApiClient.syncRepositories();
      setRepositories(repos);
    } catch (error) {
      console.error('Failed to sync repositories:', error);
    } finally {
      setSyncing(false);
    }
  };

  if (selectedRepo) {
    return (
      <PipelineGenerator
        repository={selectedRepo}
        onBack={() => setSelectedRepo(null)}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">Manage your repositories and CI/CD pipelines</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('repos')}
            className={activeTab === 'repos'
              ? 'flex items-center space-x-2 px-6 py-4 font-medium transition-colors text-blue-600 border-b-2 border-blue-600'
              : 'flex items-center space-x-2 px-6 py-4 font-medium transition-colors text-gray-500 hover:text-gray-700'
            }
          >
            <GitBranch className="w-5 h-5" />
            <span>Repositories</span>
          </button>
          <button
            onClick={() => setActiveTab('analyzer')}
            className={activeTab === 'analyzer'
              ? 'flex items-center space-x-2 px-6 py-4 font-medium transition-colors text-blue-600 border-b-2 border-blue-600'
              : 'flex items-center space-x-2 px-6 py-4 font-medium transition-colors text-gray-500 hover:text-gray-700'
            }
          >
            <Lock className="w-5 h-5" />
            <span>Fix My CI/CD</span>
          </button>
        </div>
      </div>

      {activeTab === 'repos' ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-gray-600">
              {repositories.length} {repositories.length === 1 ? 'repository' : 'repositories'} found
            </p>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Repositories'}</span>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : repositories.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No repositories found</h3>
              <p className="text-gray-600 mb-6">
                Click the sync button above to load your GitHub repositories
              </p>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                <span>Sync Repositories</span>
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {repositories.map(repo => (
                <RepositoryCard
                  key={repo.id}
                  repository={repo}
                  onSelect={() => setSelectedRepo(repo)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <AnalyzerPage />
      )}
    </div>
  );
}
