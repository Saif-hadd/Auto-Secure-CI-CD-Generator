import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Shield, AlertTriangle, CheckCircle, ExternalLink, Download } from 'lucide-react';
import { ApiClient } from '../lib/api';

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
      alert('Failed to push pipeline to GitHub. Please check your permissions.');
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

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to repositories</span>
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{repository.repo_name}</h2>
        <a
          href={repository.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700"
        >
          <span className="text-sm">{repository.repo_full_name}</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {!pipeline && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Select Pipeline Type</h3>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <button
              onClick={() => setPipelineType('basic')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                pipelineType === 'basic'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <h4 className="font-semibold text-gray-900 mb-2">Basic</h4>
              <p className="text-sm text-gray-600">Simple CI pipeline with build and test steps</p>
            </button>

            <button
              onClick={() => setPipelineType('advanced')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                pipelineType === 'advanced'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <h4 className="font-semibold text-gray-900 mb-2">Advanced</h4>
              <p className="text-sm text-gray-600">Includes linting, testing, and Docker build</p>
            </button>

            <button
              onClick={() => setPipelineType('secure')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                pipelineType === 'secure'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2 mb-2">
                <h4 className="font-semibold text-gray-900">Secure</h4>
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">Full DevSecOps with security scanning</p>
            </button>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generating Pipeline...</span>
              </>
            ) : (
              <span>Generate Secure CI/CD Pipeline</span>
            )}
          </button>
        </div>
      )}

      {pipeline && (
        <div className="space-y-6">
          {pushSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-900">Pipeline pushed successfully!</p>
                <p className="text-sm text-green-700">Your secure CI/CD pipeline is now active on GitHub.</p>
              </div>
            </div>
          )}

          {securityDashboard && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Security Dashboard</h3>

              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">Security Score</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {securityDashboard.summary.securityScore}/100
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">Vulnerabilities</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {securityDashboard.summary.totalVulnerabilities}
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">Risk Level</p>
                  <p className={`text-3xl font-bold capitalize ${
                    securityDashboard.summary.overallRisk === 'low' ? 'text-green-600' :
                    securityDashboard.summary.overallRisk === 'medium' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {securityDashboard.summary.overallRisk}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Security Scans</h4>
                {securityDashboard.scans.map((scan: any, index: number) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 uppercase">{scan.scan_type}</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(scan.risk_level)}`}>
                        {scan.risk_level}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {scan.vulnerabilities_count} {scan.vulnerabilities_count === 1 ? 'issue' : 'issues'} found
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Generated Pipeline</h3>
              <div className="flex space-x-3">
                <button
                  onClick={handleDownload}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
                <button
                  onClick={handlePush}
                  disabled={pushing}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pushing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Pushing...</span>
                    </>
                  ) : (
                    <span>Push to GitHub</span>
                  )}
                </button>
              </div>
            </div>

            <pre className="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto text-sm">
              <code>{pipeline.generated_yaml}</code>
            </pre>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 border-2 border-blue-600 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Regenerating...' : 'Regenerate Pipeline'}
          </button>
        </div>
      )}
    </div>
  );
}
