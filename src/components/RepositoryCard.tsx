import { GitBranch, Lock, Unlock, ExternalLink } from 'lucide-react';

interface RepositoryCardProps {
  repository: any;
  onSelect: () => void;
}

export function RepositoryCard({ repository, onSelect }: RepositoryCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {repository.repo_name}
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <GitBranch className="w-4 h-4" />
            <span>{repository.default_branch}</span>
          </div>
        </div>
        {repository.is_private ? (
          <Lock className="w-5 h-5 text-gray-400" />
        ) : (
          <Unlock className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {repository.stack_detected && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs font-medium text-blue-900 mb-1">Detected Stack</p>
          <div className="flex flex-wrap gap-2">
            {repository.stack_detected.language && (
              <span className="px-2 py-1 bg-white text-xs font-medium text-blue-700 rounded">
                {repository.stack_detected.language}
              </span>
            )}
            {repository.stack_detected.framework && (
              <span className="px-2 py-1 bg-white text-xs font-medium text-blue-700 rounded">
                {repository.stack_detected.framework}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={onSelect}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Generate Pipeline
        </button>
        <a
          href={repository.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ExternalLink className="w-5 h-5 text-gray-600" />
        </a>
      </div>
    </div>
  );
}
