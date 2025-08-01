/**
 * Analysis step component for LayoutSplittingManager
 */

import React from 'react';
import { 
  FileText,
  Settings,
  Info,
  AlertTriangle,
  Play
} from 'lucide-react';
import layoutSplittingService from '../../../services/layoutSplittingService';
import type { StepComponentProps } from '../types';

export const AnalysisStep: React.FC<StepComponentProps> = ({
  state,
  onStateChange,
  onSplitLayout
}) => {
  const { analysis, splittingOptions, showAdvancedOptions, isProcessing } = state;

  const handleOptionChange = (key: string, value: any) => {
    onStateChange({
      splittingOptions: {
        ...splittingOptions,
        [key]: value
      }
    });
  };

  const toggleAdvancedOptions = () => {
    onStateChange({ showAdvancedOptions: !showAdvancedOptions });
  };

  if (!analysis) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Analyzing layout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analysis Results */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Layout Analysis
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{analysis.estimatedSections}</div>
            <div className="text-sm text-gray-600">Estimated Sections</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {layoutSplittingService.formatFileSize(analysis.fileSize)}
            </div>
            <div className="text-sm text-gray-600">File Size</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{analysis.complexity}</div>
            <div className="text-sm text-gray-600">Complexity</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(analysis.estimatedProcessingTime / 1000)}s
            </div>
            <div className="text-sm text-gray-600">Est. Time</div>
          </div>
        </div>

        {/* Recommendations */}
        {analysis.recommendation && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2 flex items-center">
              <Info className="w-4 h-4 mr-2 text-blue-500" />
              Recommendation
            </h4>
            <div className="text-sm text-gray-600">
              {analysis.recommendation}
            </div>
          </div>
        )}
      </div>

      {/* Splitting Options */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Splitting Options
          </h3>
          <button
            onClick={toggleAdvancedOptions}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Section Size (KB)
            </label>
            <input
              type="number"
              value={splittingOptions.maxSectionSize || 50}
              onChange={(e) => handleOptionChange('maxSectionSize', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="10"
              max="500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Section Size (KB)
            </label>
            <input
              type="number"
              value={splittingOptions.minSectionSize || 5}
              onChange={(e) => handleOptionChange('minSectionSize', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="1"
              max="100"
            />
          </div>

          {showAdvancedOptions && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Section Size
                </label>
                <input
                  type="range"
                  value={splittingOptions.minSectionSize || 100}
                  onChange={(e) => handleOptionChange('minSectionSize', parseInt(e.target.value))}
                  className="w-full"
                  min="50"
                  max="500"
                  step="25"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {splittingOptions.minSectionSize || 100} characters
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="preserveStructure"
                  checked={splittingOptions.preserveStructure !== false}
                  onChange={(e) => handleOptionChange('preserveStructure', e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="preserveStructure" className="text-sm text-gray-700">
                  Preserve HTML Structure
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="preserveStructure"
                  checked={splittingOptions.preserveStructure !== false}
                  onChange={(e) => handleOptionChange('preserveStructure', e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="preserveStructure" className="text-sm text-gray-700">
                  Preserve HTML Structure
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-end">
        <button
          onClick={onSplitLayout}
          disabled={isProcessing}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Play className="w-4 h-4" />
          <span>{isProcessing ? 'Splitting...' : 'Split Layout'}</span>
        </button>
      </div>
    </div>
  );
};
