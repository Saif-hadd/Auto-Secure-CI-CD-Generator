import { useState } from 'react';
import { AlertTriangle, CheckCircle, FileCode, Loader2, Search, Sparkles, Shield, ArrowRight } from 'lucide-react';
import { ApiClient } from '../lib/api';

export function AnalyzerPage() {
  const [yaml, setYaml] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any | null>(null);

  const handleAnalyze = async () => {
    if (!yaml.trim()) return;
    setAnalyzing(true);
    try {
      const result = await ApiClient.analyzeYAML(yaml);
      setAnalysis(result);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLoadSample = () => {
    const sampleYAML = `name: Sample CI Pipeline

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build`;

    setYaml(sampleYAML);
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500/30 bg-red-500/5';
      case 'high': return 'border-orange-500/30 bg-orange-500/5';
      case 'medium': return 'border-yellow-500/30 bg-yellow-500/5';
      default: return 'border-cyber-500/30 bg-cyber-500/5';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-cyber-400 bg-cyber-500/10 border-cyber-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyber-500 to-cyan-500 flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">CI/CD Pipeline Analyzer</h3>
              <p className="text-sm text-slate-400">Paste your GitHub Actions YAML to analyze and improve it</p>
            </div>
          </div>
          <button
            onClick={handleLoadSample}
            className="btn-outline-cyber px-4 py-2 text-sm rounded-lg"
          >
            Load Sample
          </button>
        </div>

        <div className="relative">
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            placeholder="Paste your GitHub Actions YAML here..."
            className="w-full h-64 p-4 bg-[#0c1222] border border-white/[0.06] rounded-lg font-mono text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyber-500/30 focus:ring-1 focus:ring-cyber-500/20 resize-none transition-all"
          />
          {yaml && (
            <div className="absolute bottom-3 right-3 text-[10px] text-slate-600 font-mono">
              {yaml.split('\n').length} lines
            </div>
          )}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={analyzing || !yaml.trim()}
          className="w-full mt-4 btn-cyber py-3.5 text-sm flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing Pipeline...</span>
            </>
          ) : (
            <>
              <FileCode className="w-4 h-4" />
              <span>Analyze Pipeline</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {analysis && (
        <div className="space-y-6 animate-slide-up">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-6">
              {analysis.valid ? (
                <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-white">
                  {analysis.valid ? 'Pipeline Valid' : 'Issues Found'}
                </h3>
                <p className="text-sm text-slate-400">
                  {analysis.issues?.length || 0} issues, {analysis.warnings?.length || 0} warnings
                </p>
              </div>
            </div>

            {analysis.issues && analysis.issues.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-white text-sm mb-3 uppercase tracking-wider">Issues</h4>
                <div className="space-y-3">
                  {analysis.issues.map((issue: any, index: number) => (
                    <div key={index} className={`p-4 border rounded-lg ${getSeverityStyle(issue.severity)}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-white text-sm">{issue.message}</p>
                          <p className="text-xs text-slate-400 mt-1 capitalize">{issue.type}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase ${getSeverityBadge(issue.severity)}`}>
                          {issue.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.warnings && analysis.warnings.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-white text-sm mb-3 uppercase tracking-wider">Warnings</h4>
                <div className="space-y-3">
                  {analysis.warnings.map((warning: any, index: number) => (
                    <div key={index} className={`p-4 border rounded-lg ${getSeverityStyle(warning.severity)}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-white text-sm">{warning.message}</p>
                          <p className="text-xs text-slate-400 mt-1 capitalize">{warning.type}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase ${getSeverityBadge(warning.severity)}`}>
                          {warning.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.suggestions && analysis.suggestions.length > 0 && (
              <div>
                <h4 className="font-semibold text-white text-sm mb-3 uppercase tracking-wider">Suggestions</h4>
                <div className="space-y-3">
                  {analysis.suggestions.map((suggestion: any, index: number) => (
                    <div key={index} className="p-4 border border-cyber-500/20 bg-cyber-500/5 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Sparkles className="w-4 h-4 text-cyber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-cyber-300 text-sm">{suggestion.title}</p>
                          <p className="text-xs text-slate-400 mt-1">{suggestion.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {analysis.optimizedYAML && (
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-shield-500/10 border border-shield-500/20 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-shield-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Optimized Pipeline</h3>
              </div>
              <div className="code-block p-4 pt-12 relative">
                <div className="absolute top-2.5 left-4 flex space-x-1.5 z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <pre className="text-xs text-slate-300 font-mono leading-relaxed overflow-x-auto max-h-[400px] overflow-y-auto">
                  <code>{analysis.optimizedYAML}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
