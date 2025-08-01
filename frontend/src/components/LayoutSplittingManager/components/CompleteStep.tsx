/**
 * Complete step component for LayoutSplittingManager
 */

import React from 'react';
import { 
  CheckCircle,
  Download,
  Eye,
  BarChart3,
  Clock,
  FileText
} from 'lucide-react';
import layoutSplittingService from '../../../services/layoutSplittingService';
import type { StepComponentProps } from '../types';

export const CompleteStep: React.FC<StepComponentProps> = ({
  state,
  onDownloadResult
}) => {
  const { processingResult } = state;

  if (!processingResult) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No processing result available</p>
        </div>
      </div>
    );
  }

  const processedSections = processingResult.processedSections || [];
  const successfulSections = Array.isArray(processedSections) ? processedSections.filter(s => s.status === 'completed').length : 0;
  const totalSections = Array.isArray(processedSections) ? processedSections.length : 0;
  const successRate = totalSections > 0 ? Math.round((successfulSections / totalSections) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Completion Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
            Processing Complete
          </h3>
          <button
            onClick={onDownloadResult}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            <span>Download Module</span>
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{successfulSections}</div>
            <div className="text-sm text-gray-600">Successful</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">{totalSections}</div>
            <div className="text-sm text-gray-600">Total Sections</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{successRate}%</div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {layoutSplittingService.formatTime(processingResult.totalProcessingTime / 1000)}
            </div>
            <div className="text-sm text-gray-600">Total Time</div>
          </div>
        </div>

        {/* Module Information */}
        {processingResult.combinedModule && (
          <div className="border-t pt-6">
            <h4 className="font-medium mb-4 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Generated Module
            </h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Module Label</label>
                  <p className="text-lg font-semibold">
                    {processingResult.combinedModule.meta.label}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Total Fields</label>
                  <p className="text-lg font-semibold">
                    {processingResult.combinedModule.fields?.length || 0}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <p className="text-sm text-gray-600">
                    {processingResult.combinedModule.meta.description || 'No description available'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Content Types</label>
                  <p className="text-sm text-gray-600">
                    {processingResult.combinedModule.meta.content_types?.join(', ') || 'Not specified'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Processing Statistics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-medium mb-4 flex items-center">
          <BarChart3 className="w-4 h-4 mr-2" />
          Processing Statistics
        </h4>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Total Processing Time</span>
            <span className="font-medium">
              {layoutSplittingService.formatTime(processingResult.totalProcessingTime / 1000)}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Average Time per Section</span>
            <span className="font-medium">
              {totalSections > 0 
                ? layoutSplittingService.formatTime((processingResult.totalProcessingTime / totalSections) / 1000)
                : 'N/A'
              }
            </span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600">Success Rate</span>
            <span className={`font-medium ${successRate >= 90 ? 'text-green-600' : successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
              {successRate}%
            </span>
          </div>
          
          {processingResult.combinedModule && (
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Generated Fields</span>
              <span className="font-medium">
                {processingResult.combinedModule.fields?.length || 0}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Processed Sections Details */}
      {Array.isArray(processedSections) && processedSections.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-medium mb-4">Section Processing Results</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {processedSections.map((section, index) => (
              <div
                key={section.id}
                className={`border rounded-lg p-3 ${
                  section.status === 'completed' 
                    ? 'border-green-200 bg-green-50' 
                    : section.status === 'failed'
                    ? 'border-red-200 bg-red-50'
                    : 'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {section.status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : section.status === 'failed' ? (
                      <div className="w-4 h-4 rounded-full bg-red-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-500" />
                    )}
                    <div>
                      <div className="font-medium">Section {index + 1}</div>
                      <div className="text-sm text-gray-600">
                        {section.fieldsGenerated || 0} fields generated
                        {section.processingTime && (
                          <span> • {Math.round(section.processingTime / 1000)}s</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-sm font-medium capitalize ${
                      section.status === 'completed' ? 'text-green-600' :
                      section.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {section.status}
                    </div>
                  </div>
                </div>

                {/* Section Issues */}
                {section.issues && section.issues.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="text-xs text-gray-600 mb-1">Issues:</div>
                    <ul className="text-xs text-gray-700 space-y-1">
                      {section.issues.slice(0, 2).map((issue, issueIndex) => (
                        <li key={issueIndex} className="flex items-start">
                          <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                          {issue}
                        </li>
                      ))}
                      {section.issues.length > 2 && (
                        <li className="text-gray-500">
                          +{section.issues.length - 2} more issues
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Processing completed successfully. You can download the generated module or start a new process.
        </div>
        
        <div className="flex space-x-3">
          {/* Preview functionality would need to be implemented with actual preview URL generation */}
          
          <button
            onClick={onDownloadResult}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            <span>Download Module</span>
          </button>
        </div>
      </div>
    </div>
  );
};
