import { useState, useEffect } from 'react';
import { RefreshCw, GitBranch, Lock, Search, Filter } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredRepos = repositories.filter(repo =>
    repo.repo_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.repo_full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="flex items-center justify-between mb-8 animate-slide-up">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Dashboard</h2>
          <p className="text-slate-400 mt-1">Manage your repositories and CI/CD pipelines</p>
        </div>
      </div>

      <div className="glass rounded-xl mb-6 overflow-hidden animate-slide-up-delayed">
        <div className="flex border-b border-white/5">
          <button
            onClick={() => setActiveTab('repos')}
            className={`flex items-center space-x-2 px-6 py-4 font-medium transition-all duration-300 relative ${
              activeTab === 'repos'
                ? 'text-cyber-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Repositories</span>
            {activeTab === 'repos' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyber-500 to-cyan-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('analyzer')}
            className={`flex items-center space-x-2 px-6 py-4 font-medium transition-all duration-300 relative ${
              activeTab === 'analyzer'
                ? 'text-cyber-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Fix My CI/CD</span>
            {activeTab === 'analyzer' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyber-500 to-cyan-500" />
            )}
          </button>
        </div>
      </div>

      {activeTab === 'repos' ? (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 animate-slide-up-delayed">
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyber-500/50 focus:ring-1 focus:ring-cyber-500/20 transition-all"
                />
              </div>
              <button className="p-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-white hover:border-white/20 transition-all">
                <Filter className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <span className="text-xs text-slate-500">
                {filteredRepos.length} repo{filteredRepos.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn-cyber flex items-center space-x-2 px-4 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Sync'}</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-cyber-500/30 border-t-cyber-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-400 text-sm">Loading repositories...</p>
              </div>
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="glass-card rounded-2xl p-16 text-center animate-scale-in">
              <div className="w-16 h-16 rounded-2xl bg-cyber-600/10 border border-cyber-500/20 flex items-center justify-center mx-auto mb-6">
                <GitBranch className="w-8 h-8 text-cyber-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {searchQuery ? 'No matching repositories' : 'No repositories found'}
              </h3>
              <p className="text-slate-400 mb-8 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : 'Sync your GitHub repositories to get started'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="btn-cyber inline-flex items-center space-x-2 px-6 py-3 text-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  <span>Sync Repositories</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRepos.map((repo, i) => (
                <div
                  key={repo.id}
                  style={{ animationDelay: `${i * 0.05}s` }}
                  className="animate-slide-up"
                >
                  <RepositoryCard
                    repository={repo}
                    onSelect={() => setSelectedRepo(repo)}
                  />
                </div>
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
