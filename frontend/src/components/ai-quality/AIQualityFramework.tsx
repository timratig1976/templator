import React, { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  Cog6ToothIcon,
  ChartBarIcon,
  BeakerIcon,
  DocumentTextIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

export interface AITaskConfig {
  id: string;
  name: string;
  taskType: string;
  apiEndpoint: string;
  validationEndpoint?: string;
  optimizationEndpoint?: string;
}

export interface QualityMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  accuracy?: number;
  customMetrics?: Record<string, number>;
}

export interface ValidationResult {
  overallMetrics: QualityMetrics;
  testResults: Array<{
    testCase: string;
    metrics: QualityMetrics;
    status: 'excellent' | 'good' | 'poor';
  }>;
  recommendations: string[];
}

interface AIQualityFrameworkProps {
  taskConfig: AITaskConfig;
  currentPrompt: string;
  onPromptChange: (prompt: string) => void;
  onTest?: (prompt: string, testData?: any) => Promise<any>;
  className?: string;
}

export const AIQualityFramework: React.FC<AIQualityFrameworkProps> = ({
  taskConfig,
  currentPrompt,
  onPromptChange,
  onTest,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'optimizer' | 'validator' | 'monitor'>('optimizer');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [optimizedPrompts, setOptimizedPrompts] = useState<string[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<any[]>([]);

  const tabs = [
    { id: 'optimizer', name: 'AI Optimizer', icon: Cog6ToothIcon },
    { id: 'validator', name: 'Quality Validator', icon: CheckCircleIcon },
    { id: 'monitor', name: 'Performance Monitor', icon: ChartBarIcon }
  ];

  const handleOptimizePrompt = async () => {
    if (!currentPrompt.trim()) return;
    
    setIsOptimizing(true);
    try {
      const response = await fetch(`http://localhost:3009/api/ai-quality/${taskConfig.id}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPrompt,
          performanceIssues: validationResults?.recommendations || []
        })
      });

      const data = await response.json();
      setOptimizedPrompts(data.optimizedPrompts || []);
    } catch (error) {
      console.error('Failed to optimize prompt:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleValidatePrompt = async () => {
    if (!currentPrompt.trim()) return;
    
    setIsValidating(true);
    try {
      const response = await fetch(`http://localhost:3009/api/ai-quality/${taskConfig.id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt })
      });

      const data = await response.json();
      setValidationResults(data);
    } catch (error) {
      console.error('Failed to validate prompt:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const loadPerformanceHistory = async () => {
    try {
      const response = await fetch(`http://localhost:3009/api/ai-quality/${taskConfig.id}/performance`);
      const data = await response.json();
      setPerformanceHistory(data);
    } catch (error) {
      console.error('Failed to load performance history:', error);
    }
  };

  useEffect(() => {
    loadPerformanceHistory();
  }, [taskConfig.id]);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">AI Quality Framework</h3>
            <p className="text-sm text-gray-600 mt-1">{taskConfig.name}</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {taskConfig.taskType}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'optimizer' && (
          <AIPromptOptimizer
            currentPrompt={currentPrompt}
            optimizedPrompts={optimizedPrompts}
            isOptimizing={isOptimizing}
            onOptimize={handleOptimizePrompt}
            onSelectPrompt={onPromptChange}
          />
        )}

        {activeTab === 'validator' && (
          <AIQualityValidator
            validationResults={validationResults}
            isValidating={isValidating}
            onValidate={handleValidatePrompt}
          />
        )}

        {activeTab === 'monitor' && (
          <AIPerformanceMonitor
            performanceHistory={performanceHistory}
            onRefresh={loadPerformanceHistory}
          />
        )}
      </div>
    </div>
  );
};

// AI Prompt Optimizer Component
const AIPromptOptimizer: React.FC<{
  currentPrompt: string;
  optimizedPrompts: string[];
  isOptimizing: boolean;
  onOptimize: () => void;
  onSelectPrompt: (prompt: string) => void;
}> = ({ currentPrompt, optimizedPrompts, isOptimizing, onOptimize, onSelectPrompt }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-lg font-medium text-gray-900">AI-Powered Prompt Optimization</h4>
        <p className="text-sm text-gray-600 mt-1">Generate improved prompt variations using meta-prompting</p>
      </div>
      <button
        onClick={onOptimize}
        disabled={isOptimizing || !currentPrompt.trim()}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isOptimizing ? (
          <>
            <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
            Optimizing...
          </>
        ) : (
          <>
            <Cog6ToothIcon className="h-4 w-4 mr-2" />
            Optimize Prompt
          </>
        )}
      </button>
    </div>

    {optimizedPrompts.length > 0 && (
      <div className="space-y-4">
        <h5 className="text-sm font-medium text-gray-900">AI-Generated Improvements:</h5>
        {optimizedPrompts.map((prompt, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-4 border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-purple-600">Variation {index + 1}</span>
              <button
                onClick={() => onSelectPrompt(prompt)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Use This Prompt
              </button>
            </div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto bg-white p-3 rounded border">
              {prompt}
            </pre>
          </div>
        ))}
      </div>
    )}
  </div>
);

// AI Quality Validator Component
const AIQualityValidator: React.FC<{
  validationResults: ValidationResult | null;
  isValidating: boolean;
  onValidate: () => void;
}> = ({ validationResults, isValidating, onValidate }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-lg font-medium text-gray-900">Quality Validation</h4>
        <p className="text-sm text-gray-600 mt-1">Test prompt performance against ground truth data</p>
      </div>
      <button
        onClick={onValidate}
        disabled={isValidating}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
      >
        {isValidating ? (
          <>
            <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
            Validating...
          </>
        ) : (
          <>
            <BeakerIcon className="h-4 w-4 mr-2" />
            Run Validation
          </>
        )}
      </button>
    </div>

    {validationResults && (
      <div className="space-y-6">
        {/* Overall Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Precision"
            value={validationResults.overallMetrics.precision}
            color="blue"
          />
          <MetricCard
            label="Recall"
            value={validationResults.overallMetrics.recall}
            color="green"
          />
          <MetricCard
            label="F1 Score"
            value={validationResults.overallMetrics.f1Score}
            color="purple"
          />
          {validationResults.overallMetrics.accuracy && (
            <MetricCard
              label="Accuracy"
              value={validationResults.overallMetrics.accuracy}
              color="orange"
            />
          )}
        </div>

        {/* Recommendations */}
        {validationResults.recommendations.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h5 className="text-sm font-medium text-yellow-800 mb-2">Improvement Recommendations</h5>
            <ul className="text-sm text-yellow-700 space-y-1">
              {validationResults.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )}
  </div>
);

// AI Performance Monitor Component
const AIPerformanceMonitor: React.FC<{
  performanceHistory: any[];
  onRefresh: () => void;
}> = ({ performanceHistory, onRefresh }) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-lg font-medium text-gray-900">Performance Monitoring</h4>
        <p className="text-sm text-gray-600 mt-1">Track quality metrics and performance trends over time</p>
      </div>
      <button
        onClick={onRefresh}
        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
      >
        <ArrowPathIcon className="h-4 w-4 mr-2" />
        Refresh
      </button>
    </div>

    {performanceHistory.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">F1 Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Executions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {performanceHistory.map((item, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.version}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(item.avg_f1_score * 100).toFixed(1)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.total_executions}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.avg_execution_time}ms
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${item.total_cost?.toFixed(4) || '0.0000'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="text-center py-8 text-gray-500">
        <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2">No performance data available</p>
      </div>
    )}
  </div>
);

// Metric Card Component
const MetricCard: React.FC<{
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}> = ({ label, value, color }) => {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600'
  };

  return (
    <div className="text-center p-4 bg-gray-50 rounded-lg">
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>
        {(value * 100).toFixed(1)}%
      </div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
};

export default AIQualityFramework;
