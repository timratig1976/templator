/**
 * Process step component for LayoutSplittingManager
 */

import React from 'react';
import { 
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  Pause
} from 'lucide-react';
import layoutSplittingService from '../../../services/layoutSplittingService';
import type { StepComponentProps } from '../types';

export const ProcessStep: React.FC<StepComponentProps> = ({
  state
}) => {
  const { processingProgress, selectedSections, isProcessing } = state;

  const progressPercentage = processingProgress.totalSections > 0 
    ? Math.round((processingProgress.currentSection / processingProgress.totalSections) * 100)
    : 0;

  const batchProgressPercentage = processingProgress.totalBatches > 0
    ? Math.round((processingProgress.currentBatch / processingProgress.totalBatches) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Processing Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Zap className="w-5 h-5 mr-2" />
          Processing Sections
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{selectedSections.size}</div>
            <div className="text-sm text-gray-600">Total Sections</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {processingProgress.currentSection}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {processingProgress.currentBatch}
            </div>
            <div className="text-sm text-gray-600">Current Batch</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{progressPercentage}%</div>
            <div className="text-sm text-gray-600">Progress</div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Overall Progress</span>
            <span>{processingProgress.currentSection} / {processingProgress.totalSections}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Batch Progress Bar */}
        {processingProgress.totalBatches > 1 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Batch Progress</span>
              <span>{processingProgress.currentBatch} / {processingProgress.totalBatches}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${batchProgressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Processing Status */}
        <div className="flex items-center justify-center py-6">
          {isProcessing ? (
            <div className="flex items-center space-x-3 text-blue-600">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="font-medium">Processing sections...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-3 text-green-600">
              <CheckCircle className="w-6 h-6" />
              <span className="font-medium">Processing complete</span>
            </div>
          )}
        </div>
      </div>

      {/* Processing Details */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-medium mb-4 flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          Processing Details
        </h4>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Status:</span>
            <span className={`font-medium ${isProcessing ? 'text-blue-600' : 'text-green-600'}`}>
              {isProcessing ? 'In Progress' : 'Completed'}
            </span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Current Section:</span>
            <span className="font-medium">
              {processingProgress.currentSection} of {processingProgress.totalSections}
            </span>
          </div>
          
          {processingProgress.totalBatches > 1 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current Batch:</span>
              <span className="font-medium">
                {processingProgress.currentBatch} of {processingProgress.totalBatches}
              </span>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progress:</span>
            <span className="font-medium">{progressPercentage}%</span>
          </div>
        </div>

        {/* Processing Steps */}
        <div className="mt-6 pt-4 border-t">
          <h5 className="text-sm font-medium text-gray-700 mb-3">Processing Steps</h5>
          <div className="space-y-2">
            {[
              { step: 'Analyzing sections', completed: true },
              { step: 'Generating HubSpot fields', completed: processingProgress.currentSection > 0 },
              { step: 'Optimizing layouts', completed: processingProgress.currentSection > processingProgress.totalSections * 0.5 },
              { step: 'Combining modules', completed: processingProgress.currentSection >= processingProgress.totalSections },
              { step: 'Finalizing output', completed: !isProcessing && processingProgress.currentSection >= processingProgress.totalSections }
            ].map((item, index) => (
              <div key={index} className="flex items-center space-x-3">
                {item.completed ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
                )}
                <span className={`text-sm ${item.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                  {item.step}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Updates */}
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="animate-pulse">
              <Zap className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h4 className="font-medium text-blue-800">Processing in progress</h4>
              <p className="text-sm text-blue-600 mt-1">
                The system is currently processing your selected sections. This may take a few minutes 
                depending on the complexity and size of your layout.
              </p>
              <div className="mt-2 text-xs text-blue-500">
                You can safely leave this page - processing will continue in the background.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {!isProcessing && processingProgress.currentSection === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <XCircle className="w-5 h-5 text-red-500" />
            <div>
              <h4 className="font-medium text-red-800">Processing failed</h4>
              <p className="text-sm text-red-600 mt-1">
                There was an error processing your sections. Please try again or contact support.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
