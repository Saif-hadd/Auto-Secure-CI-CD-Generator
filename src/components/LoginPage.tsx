import { useEffect, useState } from 'react';
import { Github, Shield, Lock, Terminal, Cpu, Eye, Fingerprint } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_GITHUB_REDIRECT_URI || window.location.origin;

function FloatingOrb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <div
      className={`absolute rounded-full blur-3xl opacity-20 animate-float ${className}`}
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

function GridPattern() {
  return <div className="absolute inset-0 grid-bg opacity-60" />;
}

function ParticleField() {
  const [particles] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 4 + 4,
      delay: Math.random() * 4,
    }))
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full bg-cyber-500/30"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animation: `float ${p.duration}s ease-in-out ${p.delay}s infinite, pulse-glow ${p.duration / 2}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      setLoading(true);
      login(code)
        .catch(error => {
          console.error('Login error:', error);
          window.history.replaceState({}, document.title, '/');
        })
        .finally(() => setLoading(false));
    }
  }, [login]);

  const handleGitHubLogin = () => {
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo,user,workflow`;
    window.location.href = githubAuthUrl;
  };

  const features = [
    { icon: Lock, title: 'SAST & DAST', desc: 'Static and dynamic analysis built-in', color: 'from-blue-500 to-cyan-500' },
    { icon: Eye, title: 'Secrets Scanning', desc: 'Detect exposed credentials instantly', color: 'from-cyan-500 to-teal-500' },
    { icon: Fingerprint, title: 'Dependency Audit', desc: 'Vulnerability checks for every package', color: 'from-teal-500 to-emerald-500' },
    { icon: Cpu, title: 'Smart Detection', desc: 'Auto-detect your tech stack', color: 'from-emerald-500 to-green-500' },
  ];

  const steps = [
    { num: '01', title: 'Connect', desc: 'Authenticate with GitHub' },
    { num: '02', title: 'Analyze', desc: 'AI scans your repository' },
    { num: '03', title: 'Generate', desc: 'Create a secure pipeline' },
    { num: '04', title: 'Deploy', desc: 'Push to GitHub in one click' },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0e1a]">
      <FloatingOrb className="w-96 h-96 bg-cyber-600 top-[-10%] left-[-5%]" delay={0} />
      <FloatingOrb className="w-80 h-80 bg-cyan-500 bottom-[-10%] right-[-5%]" delay={2} />
      <FloatingOrb className="w-64 h-64 bg-blue-700 top-[40%] right-[20%]" delay={4} />
      <GridPattern />
      <ParticleField />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen flex flex-col">
        <div className="flex items-center space-x-3 mb-12 animate-fade-in">
          <div className="relative">
            <div className="bg-gradient-to-br from-cyber-500 to-cyan-500 p-2.5 rounded-xl animate-shield-pulse">
              <Shield className="w-7 h-7 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">AutoSecure</h1>
            <p className="text-xs text-cyber-400 font-medium tracking-wider uppercase">DevSecOps Platform</p>
          </div>
        </div>

        <div className="flex-1 grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-10 animate-slide-up">
            <div className="space-y-5">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full glass-light text-xs font-medium text-cyber-300 border border-cyber-500/20">
                <Terminal className="w-3.5 h-3.5" />
                <span>Next-Gen CI/CD Security</span>
              </div>

              <h2 className="text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight">
                <span className="text-white">Secure Your</span>
                <br />
                <span className="text-gradient">CI/CD Pipelines</span>
                <br />
                <span className="text-white">in Seconds</span>
              </h2>

              <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
                Generate production-ready, security-hardened CI/CD pipelines with built-in SAST, DAST, secrets scanning, and dependency audits.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className="glass-card rounded-xl p-4"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center mb-3`}>
                    <f.icon className="w-4 h-4 text-white" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">{f.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <button
                onClick={handleGitHubLogin}
                disabled={loading}
                className="group relative w-full sm:w-auto inline-flex items-center justify-center space-x-3 px-8 py-4 bg-white text-gray-900 rounded-xl font-bold text-lg transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <Github className="w-6 h-6" />
                    <span>Continue with GitHub</span>
                    <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  </>
                )}
              </button>

              <p className="text-xs text-slate-500 max-w-sm">
                We only request repository read access and workflow write permissions. Your code stays on GitHub.
              </p>
            </div>
          </div>

          <div className="animate-slide-up-delayed-2">
            <div className="glass rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyber-500/50 to-transparent" />

              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">How It Works</h3>
                  <p className="text-sm text-slate-400">Four steps to a secure pipeline</p>
                </div>

                <div className="space-y-5">
                  {steps.map((step) => (
  <div key={step.num} className="flex items-start space-x-4 group">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cyber-600/20 border border-cyber-500/30 flex items-center justify-center font-mono text-sm font-bold text-cyber-400 group-hover:bg-cyber-600/30 group-hover:border-cyber-500/50 transition-all duration-300">
                        {step.num}
                      </div>
                      <div className="flex-1 pt-1.5">
                        <h4 className="font-semibold text-white group-hover:text-cyber-300 transition-colors duration-300">{step.title}</h4>
                        <p className="text-sm text-slate-400">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="code-block p-4 pt-12 relative">
                  <div className="absolute top-2.5 left-4 flex space-x-1.5 z-10">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  </div>
                  <pre className="text-xs text-slate-300 font-mono leading-relaxed overflow-hidden">
                    <span className="text-cyber-400">name:</span> Secure CI/CD Pipeline{'\n'}
                    <span className="text-cyber-400">on:</span>{'\n'}
                    {'  '}<span className="text-cyber-400">push:</span>{'\n'}
                    {'    '}<span className="text-cyber-400">branches:</span> [ main ]{'\n'}
                    <span className="text-cyber-400">jobs:</span>{'\n'}
                    {'  '}<span className="text-green-400">security-scan</span>:{'\n'}
                    {'    '}<span className="text-cyber-400">steps:</span>{'\n'}
                    {'      '}- <span className="text-yellow-400">SAST</span> Analysis{'\n'}
                    {'      '}- <span className="text-yellow-400">Secrets</span> Detection{'\n'}
                    {'      '}- <span className="text-yellow-400">Dependency</span> Audit
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1">
            <Shield className="w-3.5 h-3.5 text-cyber-500" />
            <span>End-to-end encrypted</span>
          </div>
          <span>AutoSecure CI/CD v2.0</span>
        </div>
      </div>
    </div>
  );
}
