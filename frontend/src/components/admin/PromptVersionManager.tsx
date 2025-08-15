'use client';

import { useState } from 'react';
import { 
  ClockIcon,
  TagIcon,
  UserIcon,
  ChartBarIcon,
  TrashIcon,
  EyeIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface PromptVersion {
  id: string;
  version: string;
  timestamp: string;
  author: string;
  description: string;
  isActive: boolean;
  prompt?: string;
  metrics?: {
    accuracy: number;
    avgConfidence: number;
    avgSections: number;
  };
}

interface PromptVersionManagerProps {
  versions: PromptVersion[];
  onLoadVersion: (version: PromptVersion) => void;
  onDeleteVersion: (id: string) => void;
}

export default function PromptVersionManager({ 
  versions, 
  onLoadVersion, 
  onDeleteVersion 
}: PromptVersionManagerProps) {
  const [showComparison, setShowComparison] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);

  const handleVersionSelect = (versionId: string) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      } else if (prev.length < 2) {
        return [...prev, versionId];
      } else {
        return [prev[1], versionId]; // Replace first with new selection
      }
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMetricChange = (current: number, previous: number) => {
    const change = current - previous;
    const percentage = ((change / previous) * 100).toFixed(1);
    return {
      value: change,
      percentage,
      isPositive: change > 0,
      isNegative: change < 0
    };
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <ClockIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Version History</h3>
            <span className="text-sm text-gray-500">({versions.length} versions)</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`inline-flex items-center px-3 py-1.5 border text-sm font-medium rounded-md transition-colors ${
                showComparison
                  ? 'border-blue-500 text-blue-700 bg-blue-50'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <ChartBarIcon className="h-4 w-4 mr-1.5" />
              Compare
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Version List */}
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {versions.map((version, index) => {
            const isSelected = selectedVersions.includes(version.id);
            const previousVersion = versions[index + 1];
            
            return (
              <div
                key={version.id}
                className={`p-4 border rounded-lg transition-colors ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                } ${version.isActive ? 'ring-2 ring-green-200' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="flex items-center space-x-2">
                        <TagIcon className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-gray-900">{version.version}</span>
                        {version.isActive && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-3 w-3 mr-1" />
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">{version.description}</p>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <UserIcon className="h-3 w-3" />
                        <span>{version.author}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="h-3 w-3" />
                        <span>{formatDate(version.timestamp)}</span>
                      </div>
                    </div>

                    {/* Metrics */}
                    {version.metrics && (
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Accuracy</div>
                          <div className="font-medium text-gray-900">
                            {version.metrics.accuracy}%
                            {previousVersion?.metrics && (
                              <span className={`ml-1 text-xs ${
                                getMetricChange(version.metrics.accuracy, previousVersion.metrics.accuracy).isPositive
                                  ? 'text-green-600' : 'text-red-600'
                              }`}>
                                ({getMetricChange(version.metrics.accuracy, previousVersion.metrics.accuracy).isPositive ? '+' : ''}
                                {getMetricChange(version.metrics.accuracy, previousVersion.metrics.accuracy).percentage}%)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Confidence</div>
                          <div className="font-medium text-gray-900">
                            {version.metrics.avgConfidence.toFixed(2)}
                            {previousVersion?.metrics && (
                              <span className={`ml-1 text-xs ${
                                getMetricChange(version.metrics.avgConfidence, previousVersion.metrics.avgConfidence).isPositive
                                  ? 'text-green-600' : 'text-red-600'
                              }`}>
                                ({getMetricChange(version.metrics.avgConfidence, previousVersion.metrics.avgConfidence).isPositive ? '+' : ''}
                                {getMetricChange(version.metrics.avgConfidence, previousVersion.metrics.avgConfidence).value.toFixed(2)})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Sections</div>
                          <div className="font-medium text-gray-900">
                            {version.metrics.avgSections.toFixed(1)}
                            {previousVersion?.metrics && (
                              <span className={`ml-1 text-xs ${
                                getMetricChange(version.metrics.avgSections, previousVersion.metrics.avgSections).isPositive
                                  ? 'text-green-600' : 'text-red-600'
                              }`}>
                                ({getMetricChange(version.metrics.avgSections, previousVersion.metrics.avgSections).isPositive ? '+' : ''}
                                {getMetricChange(version.metrics.avgSections, previousVersion.metrics.avgSections).value.toFixed(1)})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    {showComparison && (
                      <button
                        onClick={() => handleVersionSelect(version.id)}
                        className={`p-1.5 rounded transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={isSelected ? 'Deselect for comparison' : 'Select for comparison'}
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => onLoadVersion(version)}
                      className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Load this version"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                    </button>
                    
                    {!version.isActive && (
                      <button
                        onClick={() => onDeleteVersion(version.id)}
                        className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete this version"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison View */}
        {showComparison && selectedVersions.length === 2 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Version Comparison</h4>
            <div className="grid grid-cols-2 gap-4">
              {selectedVersions.map(versionId => {
                const version = versions.find(v => v.id === versionId);
                if (!version) return null;

                return (
                  <div key={versionId} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-3">
                      <TagIcon className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-900">{version.version}</span>
                    </div>
                    
                    {version.metrics && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Accuracy:</span>
                          <span className="font-medium">{version.metrics.accuracy}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Confidence:</span>
                          <span className="font-medium">{version.metrics.avgConfidence.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Sections:</span>
                          <span className="font-medium">{version.metrics.avgSections.toFixed(1)}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-3 text-xs text-gray-500">
                      {version.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {versions.length === 0 && (
          <div className="text-center py-8">
            <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-2">No versions yet</h3>
            <p className="text-sm text-gray-500">
              Save your first prompt version to start tracking changes and improvements.
            </p>
          </div>
        )}

        {/* Instructions */}
        {showComparison && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-700">
              <strong>Comparison Mode:</strong> Select up to 2 versions to compare their metrics. 
              Click the checkmark icon to select versions for comparison.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
