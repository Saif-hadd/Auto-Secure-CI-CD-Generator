import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Shield, AlertTriangle, CheckCircle, ExternalLink, Download, Wrench, GitPullRequest, Zap, Code, Rocket } from 'lucide-react';
import { ApiClient } from '../lib/api';

interface RemediationResult {
  success: boolean;
  message?: string;
  pr_url?: string;
  pr_number?: number;
  files_updated?: string[];
}
interface PipelineGeneratorProps {
  repository: any;
  onBack: () => void;
}

export function PipelineGenerator({ repository, onBack }: PipelineGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [pipeline, setPipeline] = useState<any | null>(null);
  const [securityDashboard, setSecurityDashboard] = useState<any | null>(null);
  const [pipelineType, setPipelineType] = useState<'basic' | 'advanced' | 'secure'>('secure');
  const [pushing, setPushing] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);
  const [remediating, setRemediating] = useState(false);
  const [remediationResult, setRemediationResult] = useState<RemediationResult | null>(null);

  useEffect(() => {
    loadExistingPipeline();
  }, [repository.id]);

  const loadExistingPipeline = async () => {
    try {
      const { pipelines } = await ApiClient.getPipelinesByRepo(repository.id);
      if (pipelines.length > 0) {
        const latestPipeline = pipelines[0];
        setPipeline(latestPipeline);
        loadSecurityDashboard(latestPipeline.id);
      }
    } catch (error) {
      console.error('Failed to load pipeline:', error);
    }
  };

  const loadSecurityDashboard = async (pipelineId: string) => {
    try {
      const dashboard = await ApiClient.getSecurityDashboard(pipelineId);
      setSecurityDashboard(dashboard);
    } catch (error) {
      console.error('Failed to load security dashboard:', error);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setPushSuccess(false);
    try {
      if (!repository.stack_detected) {
        await ApiClient.detectStack(repository.id);
      }
      const { pipeline: newPipeline } = await ApiClient.generatePipeline(repository.id, pipelineType);
      setPipeline(newPipeline);
      await loadSecurityDashboard(newPipeline.id);
    } catch (error) {
      console.error('Failed to generate pipeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    if (!pipeline) return;
    setPushing(true);
    try {
      await ApiClient.pushPipelineToGitHub(pipeline.id);
      setPushSuccess(true);
    } catch (error) {
      console.error('Failed to push pipeline:', error);
    } finally {
      setPushing(false);
    }
  };

  const handleDownload = () => {
    if (!pipeline) return;
    const blob = new Blob([pipeline.generated_yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'secure-pipeline.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAutoRemediate = async () => {
    if (!pipeline) return;
    setRemediating(true);
    setRemediationResult(null);
    try {
  const result = await ApiClient.runAutoRemediation(pipeline.id) as RemediationResult;
    setRemediationResult(result);
      if (result.success) {
        await loadSecurityDashboard(pipeline.id);
      }
    } catch (error) {
      console.error('Auto-remediation failed:', error);
      setRemediationResult({
        success: false,
        message: error instanceof Error ? error.message : 'Auto-remediation failed'
      });
    } finally {
      setRemediating(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-green-400 bg-green-500/10 border-green-500/20';
    }
  };

  const getRiskDot = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const pipelineTypes = [
    { id: 'basic' as const, title: 'Basic', desc: 'Simple CI with build and test', icon: Code, color: 'from-slate-500 to-slate-600' },
    { id: 'advanced' as const, title: 'Advanced', desc: 'Lint, test, and Docker build', icon: Zap, color: 'from-cyan-500 to-blue-500' },
    { id: 'secure' as const, title: 'Secure', desc: 'Full DevSecOps with security scanning', icon: Shield, color: 'from-cyber-500 to-cyan-500' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-slate-400 hover:text-white mb-6 transition-colors duration-200 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
        <span className="text-sm">Back to repositories</span>
      </button>

      <div className="glass-card rounded-xl p-6 mb-6 animate-slide-up">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyber-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{repository.repo_name}</h2>
            <a
              href={repository.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-cyber-400 hover:text-cyber-300 transition-colors text-sm"
            >
              <span>{repository.repo_full_name}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {!pipeline && (
        <div className="glass-card rounded-xl p-8 animate-slide-up-delayed">
          <h3 className="text-xl font-bold text-white mb-6">Select Pipeline Type</h3>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {pipelineTypes.map((pt) => (
              <button
                key={pt.id}
                onClick={() => setPipelineType(pt.id)}
                className={`relative p-6 rounded-xl border transition-all duration-300 text-left group ${
                  pipelineType === pt.id
                    ? 'bg-cyber-500/10 border-cyber-500/40 shadow-[0_0_20px_rgba(13,110,253,0.1)]'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]'
                }`}
              >
                {pipelineType === pt.id && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyber-500 to-cyan-500 rounded-t-xl" />
                )}
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${pt.color} flex items-center justify-center mb-4`}>
                  <pt.icon className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-semibold text-white mb-1">{pt.title}</h4>
                <p className="text-sm text-slate-400">{pt.desc}</p>
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full btn-cyber py-4 text-base flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating Pipeline...</span>
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                <span>Generate Secure CI/CD Pipeline</span>
              </>
            )}
          </button>
        </div>
      )}

      {pipeline && (
        <div className="space-y-6">
          {pushSuccess && (
            <div className="glass rounded-xl p-4 flex items-center space-x-3 border border-green-500/20 animate-scale-in">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-medium text-green-300">Pipeline pushed successfully!</p>
                <p className="text-sm text-green-400/70">Your secure CI/CD pipeline is now active on GitHub.</p>
              </div>
            </div>
          )}

          {remediationResult && (
            <div className={`glass rounded-xl p-4 flex items-start space-x-3 border animate-scale-in ${
              remediationResult.success ? 'border-green-500/20' : 'border-yellow-500/20'
            }`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                remediationResult.success ? 'bg-green-500/10' : 'bg-yellow-500/10'
              }`}>
                {remediationResult.success ? (
                  <GitPullRequest className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                )}
              </div>
              <div className="flex-1">
                <p className={`font-medium ${remediationResult.success ? 'text-green-300' : 'text-yellow-300'}`}>
                  {remediationResult.message || 'Auto-remediation completed'}
                </p>
                {remediationResult.success && remediationResult.pr_url && (
                  <a
                    href={remediationResult.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-sm text-cyber-400 hover:text-cyber-300 mt-2 transition-colors"
                  >
                    <span>View PR #{remediationResult.pr_number}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {remediationResult.files_updated && remediationResult.files_updated.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-slate-400">
                      Updated {remediationResult.files_updated.length} file(s):
                    </p>
                    <ul className="text-sm text-slate-500 list-disc list-inside mt-1">
                      {remediationResult.files_updated.map((file: string, i: number) => (
                        <li key={i}>{file}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {securityDashboard && (
            <div className="glass-card rounded-xl p-6 animate-slide-up">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-cyber-500/10 border border-cyber-500/20 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-cyber-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Security Dashboard</h3>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="metric-card score glass rounded-xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-cyber-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Security Score</p>
                  <p className="text-4xl font-bold text-gradient">
                    {securityDashboard.summary.securityScore}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">out of 100</p>
                </div>

                <div className="metric-card vulns glass rounded-xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Vulnerabilities</p>
                  <p className={`text-4xl font-bold ${
                    securityDashboard.summary.totalVulnerabilities > 0 ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {securityDashboard.summary.totalVulnerabilities}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">total findings</p>
                </div>

                <div className="metric-card risk glass rounded-xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-teal-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Risk Level</p>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${getRiskDot(securityDashboard.summary.overallRisk)} animate-pulse`} />
                    <p className={`text-2xl font-bold capitalize ${
                      securityDashboard.summary.overallRisk === 'low' ? 'text-green-400' :
                      securityDashboard.summary.overallRisk === 'medium' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {securityDashboard.summary.overallRisk}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white text-sm">Security Scans</h4>
                  {securityDashboard.summary.totalVulnerabilities > 0 && (
                    <button
                      onClick={handleAutoRemediate}
                      disabled={remediating}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg hover:bg-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {remediating ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Fixing...</span>
                        </>
                      ) : (
                        <>
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Auto-Fix</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                {securityDashboard.scans.map((scan: any, index: number) => (
                  <div key={index} className="glass-light rounded-lg p-4 border border-white/5 hover:border-white/10 transition-all duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white text-sm uppercase tracking-wider">{scan.scan_type}</span>
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${getRiskColor(scan.risk_level)}`}>
                        {scan.risk_level}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      {scan.vulnerabilities_count} {scan.vulnerabilities_count === 1 ? 'issue' : 'issues'} found
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card rounded-xl p-6 animate-slide-up-delayed">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Code className="w-4 h-4 text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Generated Pipeline</h3>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleDownload}
                  className="btn-outline-cyber flex items-center space-x-2 px-4 py-2 text-sm rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={handlePush}
                  disabled={pushing}
                  className="btn-cyber flex items-center space-x-2 px-5 py-2 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pushing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Pushing...</span>
                    </>
                  ) : (
                    <>
                      <Rocket className="w-3.5 h-3.5" />
                      <span>Push to GitHub</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="code-block p-4 pt-12 relative overflow-hidden">
              <div className="absolute top-2.5 left-4 flex space-x-1.5 z-10">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
              <div className="absolute top-2.5 right-4 text-[10px] text-slate-500 font-mono z-10">
                secure-pipeline.yml
              </div>
              <pre className="text-xs text-slate-300 font-mono leading-relaxed overflow-x-auto max-h-[500px] overflow-y-auto">
                <code>{pipeline.generated_yaml}</code>
              </pre>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 btn-outline-cyber text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Regenerating...' : 'Regenerate Pipeline'}
          </button>
        </div>
      )}
    </div>
  );
}
