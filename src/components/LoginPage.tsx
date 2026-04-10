import { useEffect } from 'react';
import { Github, Shield, Lock, Zap, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_GITHUB_REDIRECT_URI || window.location.origin;

export function LoginPage() {
  const { login } = useAuth();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      login(code).catch(error => {
        console.error('Login error:', error);
        window.history.replaceState({}, document.title, '/');
      });
    }
  }, [login]);

  const handleGitHubLogin = () => {
const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo,user,workflow`;
    window.location.href = githubAuthUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-3 rounded-xl">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900">
                  Auto Secure CI/CD Generator
                </h1>
              </div>
              <p className="text-xl text-gray-600 leading-relaxed">
                Generate production-ready, security-focused CI/CD pipelines for your GitHub repositories in seconds.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg mt-1">
                  <Lock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Built-in Security Scanning</h3>
                  <p className="text-gray-600">SAST, DAST, secrets scanning, and dependency vulnerability checks</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="bg-cyan-100 p-2 rounded-lg mt-1">
                  <Zap className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Smart Stack Detection</h3>
                  <p className="text-gray-600">Automatically detects your tech stack and generates optimized workflows</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="bg-green-100 p-2 rounded-lg mt-1">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">DevSecOps Best Practices</h3>
                  <p className="text-gray-600">Industry-standard security practices integrated into every pipeline</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleGitHubLogin}
              className="flex items-center justify-center space-x-3 w-full sm:w-auto px-8 py-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Github className="w-6 h-6" />
              <span className="text-lg font-semibold">Continue with GitHub</span>
            </button>

            <p className="text-sm text-gray-500">
              By continuing, you agree to authorize access to your GitHub repositories to generate CI/CD pipelines.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">How It Works</h2>

              <div className="space-y-4">
                <div className="flex space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Connect GitHub</h4>
                    <p className="text-gray-600">Sign in with your GitHub account</p>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Select Repository</h4>
                    <p className="text-gray-600">Choose a repository to secure</p>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Generate Pipeline</h4>
                    <p className="text-gray-600">AI analyzes your stack and creates a secure pipeline</p>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Push to GitHub</h4>
                    <p className="text-gray-600">Deploy your secure CI/CD workflow</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
