import { Shield, LogOut, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="glass sticky top-0 z-50 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="bg-gradient-to-br from-cyber-500 to-cyan-500 p-2 rounded-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0a0e1a] animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">AutoSecure</h1>
              <p className="text-[10px] text-cyber-400 font-medium tracking-wider uppercase">DevSecOps Platform</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <Activity className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-medium text-green-400">System Active</span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="relative">
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-8 h-8 rounded-lg ring-2 ring-white/10"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0a0e1a]" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-white">{user.username}</p>
                  <p className="text-[10px] text-slate-400">Authenticated</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
