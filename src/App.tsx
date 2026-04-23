import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { Header } from './components/Header';
import { Shield } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyber-500 to-cyan-500 flex items-center justify-center mx-auto animate-shield-pulse">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="w-8 h-8 border-2 border-cyber-500/30 border-t-cyber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-medium text-sm">Initializing secure environment...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] relative">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyber-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10">
        <Header />
        <Dashboard />
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
