import { GitBranch, Lock, Unlock, ExternalLink, Shield, Zap } from 'lucide-react';

interface RepositoryCardProps {
  repository: any;
  onSelect: () => void;
}

export function RepositoryCard({ repository, onSelect }: RepositoryCardProps) {
  const stack = repository.stack_detected;
  const hasStack = stack && stack.type && stack.type !== 'unknown';

  return (
    <div className="glass-card glow-border rounded-xl p-5 h-full flex flex-col group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white mb-1.5 truncate group-hover:text-cyber-300 transition-colors duration-300">
            {repository.repo_name}
          </h3>
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <GitBranch className="w-3.5 h-3.5" />
            <span>{repository.default_branch}</span>
            {repository.is_private ? (
              <Lock className="w-3.5 h-3.5 text-amber-400/60" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-slate-600" />
            )}
          </div>
        </div>
      </div>

      {hasStack && (
        <div className="mb-4 p-3 rounded-lg bg-cyber-500/5 border border-cyber-500/10">
          <div className="flex items-center space-x-1.5 mb-2">
            <Zap className="w-3 h-3 text-cyber-400" />
            <p className="text-[10px] font-semibold text-cyber-400 uppercase tracking-wider">Detected Stack</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stack.language && (
              <span className="px-2 py-0.5 bg-cyber-500/10 text-[11px] font-medium text-cyber-300 rounded-md border border-cyber-500/15">
                {stack.language}
              </span>
            )}
            {stack.framework && (
              <span className="px-2 py-0.5 bg-cyan-500/10 text-[11px] font-medium text-cyan-300 rounded-md border border-cyan-500/15">
                {stack.framework}
              </span>
            )}
            {stack.packageManager && (
              <span className="px-2 py-0.5 bg-teal-500/10 text-[11px] font-medium text-teal-300 rounded-md border border-teal-500/15">
                {stack.packageManager}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-auto flex space-x-2 pt-2">
        <button
          onClick={onSelect}
          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 btn-cyber text-sm rounded-lg"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Secure</span>
        </button>
        <a
          href={repository.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 btn-outline-cyber rounded-lg"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
