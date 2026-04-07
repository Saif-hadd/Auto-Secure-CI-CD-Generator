import { useState } from 'react';
import { AlertTriangle, CheckCircle, FileCode, Loader2 } from 'lucide-react';
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">CI/CD Pipeline Analyzer</h3>
            <p className="text-gray-600 mt-1">Paste your GitHub Actions YAML to analyze and improve it</p>
          </div>
          <button
            onClick={handleLoadSample}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Load Sample
          </button>
        </div>

        <textarea
          value={yaml}
          onChange={(e) => setYaml(e.target.value)}
          placeholder="Paste your GitHub Actions YAML here..."
          className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />

        <button
          onClick={handleAnalyze}
          disabled={analyzing || !yaml.trim()}
          className="w-full mt-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <FileCode className="w-5 h-5" />
              <span>Analyze Pipeline</span>
            </>
          )}
        </button>
      </div>

      {analysis && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              {analysis.valid ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              )}
              <h3 className="text-xl font-bold text-gray-900">
                {analysis.valid ? 'Valid Pipeline' : 'Issues Found'}
              </h3>
            </div>

            {analysis.issues && analysis.issues.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Issues</h4>
                <div className="space-y-3">
                  {analysis.issues.map((issue: any, index: number) => (
                    <div key={index} className={`p-4 border rounded-lg ${getSeverityColor(issue.severity)}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{issue.message}</p>
                          <p className="text-sm mt-1 capitalize">Type: {issue.type}</p>
                        </div>
                        <span className="px-2 py-1 rounded text-xs font-medium">
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
                <h4 className="font-semibold text-gray-900 mb-3">Warnings</h4>
                <div className="space-y-3">
                  {analysis.warnings.map((warning: any, index: number) => (
                    <div key={index} className={`p-4 border rounded-lg ${getSeverityColor(warning.severity)}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{warning.message}</p>
                          <p className="text-sm mt-1 capitalize">Type: {warning.type}</p>
                        </div>
                        <span className="px-2 py-1 rounded text-xs font-medium">
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
                <h4 className="font-semibold text-gray-900 mb-3">Suggestions</h4>
                <div className="space-y-3">
                  {analysis.suggestions.map((suggestion: any, index: number) => (
                    <div key={index} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="font-medium text-blue-900">{suggestion.title}</p>
                      <p className="text-sm text-blue-700 mt-1">{suggestion.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {analysis.optimizedYAML && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Optimized Pipeline</h3>
              <pre className="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto text-sm">
                <code>{analysis.optimizedYAML}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
