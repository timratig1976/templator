'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BeakerIcon,
  CodeBracketIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  PhotoIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface AIProcess {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: 'analysis' | 'generation' | 'enhancement' | 'validation';
  isActive: boolean;
  updatedAt?: string | Date;
  prompts: any[];
  _count: {
    prompts: number;
    testResults?: number;
  };
}

interface ProcessStats {
  totalProcesses: number;
  activeProcesses: number;
  totalPrompts: number;
  totalTests: number;
  avgAccuracy: number;
}

export default function UniversalAIProcessManager() {
  const router = useRouter();
  const [processes, setProcesses] = useState<AIProcess[]>([]);
  const [stats, setStats] = useState<ProcessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initializingProcesses, setInitializingProcesses] = useState(false);

  useEffect(() => {
    loadProcesses();
  }, []);

  const loadProcesses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ai-prompts/processes');
      const data = await response.json();

      if (data.success) {
        setProcesses(data.data);
        calculateStats(data.data);
      } else {
        setError(data.error || 'Failed to load processes');
      }
    } catch (err) {
      setError('Failed to load AI processes');
      console.error('Failed to load processes:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (processData: AIProcess[]) => {
    const stats: ProcessStats = {
      totalProcesses: processData.length,
      activeProcesses: processData.filter(p => p.isActive).length,
      totalPrompts: processData.reduce((sum, p) => sum + p._count.prompts, 0),
      totalTests: processData.reduce((sum, p) => sum + p._count.testResults, 0),
      avgAccuracy: 82 // Mock average - would be calculated from actual metrics
    };
    setStats(stats);
  };

  const initializeProcesses = async () => {
    try {
      setInitializingProcesses(true);
      const response = await fetch('/api/admin/ai-prompts/initialize', {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        await loadProcesses(); // Reload processes after initialization
        alert('AI processes initialized successfully!');
      } else {
        alert('Failed to initialize processes: ' + data.error);
      }
    } catch (err) {
      alert('Failed to initialize processes');
      console.error('Failed to initialize:', err);
    } finally {
      setInitializingProcesses(false);
    }
  };

  const getProcessIcon = (name: string) => {
    const icons: Record<string, any> = {
      'split-detection': MagnifyingGlassIcon,
      'html-generation': CodeBracketIcon,
      'content-enhancement': SparklesIcon,
      'quality-analysis': ChartBarIcon,
      'image-analysis': PhotoIcon
    };
    return icons[name] || BeakerIcon;
  };

  const getProcessColor = (category: string) => {
    const colors: Record<string, string> = {
      analysis: 'bg-blue-500',
      generation: 'bg-green-500',
      enhancement: 'bg-purple-500',
      validation: 'bg-yellow-500'
    };
    return colors[category] || 'bg-gray-500';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      analysis: 'bg-blue-100 text-blue-800',
      generation: 'bg-green-100 text-green-800',
      enhancement: 'bg-purple-100 text-purple-800',
      validation: 'bg-yellow-100 text-yellow-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const navigateToProcess = (processName: string) => {
    router.push(`/ai/${processName}/editor`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading AI processes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
          <div>
            <h3 className="text-red-800 font-medium">Error Loading Processes</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <button
              onClick={loadProcesses}
              className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">AI Process Management</h2>
          <p className="mt-2 text-gray-600">
            Manage and refine AI prompts across all processes for optimal performance.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={initializeProcesses}
            disabled={initializingProcesses}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <CogIcon className="h-4 w-4 mr-2" />
            {initializingProcesses ? 'Initializing...' : 'Initialize Processes'}
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Processes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalProcesses}</p>
              </div>
              <BeakerIcon className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeProcesses}</p>
              </div>
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Prompts</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPrompts}</p>
              </div>
              <CodeBracketIcon className="h-8 w-8 text-purple-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Test Results</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTests}</p>
              </div>
              <ChartBarIcon className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Accuracy</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgAccuracy}%</p>
              </div>
              <SparklesIcon className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>
      )}

      {/* Process Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {processes.map((process) => {
          const IconComponent = getProcessIcon(process.name);
          const activePrompt = process.prompts[0];
          
          return (
            <div
              key={process.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigateToProcess(process.name)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`${getProcessColor(process.category)} p-2 rounded-lg`}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {process.displayName}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(process.category)}`}>
                        {process.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {process.isActive ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {process.description}
                </p>

                {/* Process Statistics */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {process._count.prompts}
                    </div>
                    <div className="text-xs text-gray-500">Prompt Versions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {process._count.testResults}
                    </div>
                    <div className="text-xs text-gray-500">Test Results</div>
                  </div>
                </div>

                {/* Active Prompt Info */}
                {activePrompt && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Active: {activePrompt.version}
                        </p>
                        <p className="text-xs text-gray-500">
                          {activePrompt.title || activePrompt.description || 'No description'}
                        </p>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(activePrompt.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Last updated: {new Date(process.updatedAt || Date.now()).toLocaleDateString()}
                  </span>
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {processes.length === 0 && (
        <div className="text-center py-12">
          <BeakerIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No AI Processes Found</h3>
          <p className="text-gray-600 mb-6">
            Initialize the AI processes to start managing prompts and improving AI performance.
          </p>
          <button
            onClick={initializeProcesses}
            disabled={initializingProcesses}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <CogIcon className="h-4 w-4 mr-2" />
            {initializingProcesses ? 'Initializing...' : 'Initialize AI Processes'}
          </button>
        </div>
      )}

      {/* Getting Started Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">AI Process Management Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-blue-900 mb-2">Process Categories</h4>
            <ul className="space-y-1 text-blue-700">
              <li><strong>Analysis:</strong> Image analysis, split detection</li>
              <li><strong>Generation:</strong> HTML generation, content creation</li>
              <li><strong>Enhancement:</strong> Content improvement, optimization</li>
              <li><strong>Validation:</strong> Quality analysis, compliance checking</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-900 mb-2">Best Practices</h4>
            <ul className="space-y-1 text-blue-700">
              <li>• Test prompts with multiple static files</li>
              <li>• Version prompts with descriptive names</li>
              <li>• Monitor performance metrics regularly</li>
              <li>• Keep backup of high-performing prompts</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
