/**
 * Split step component for LayoutSplittingManager
 */

import React from 'react';
import { 
  Scissors,
  CheckCircle,
  XCircle,
  Eye,
  Play
} from 'lucide-react';
import layoutSplittingService from '../../../services/layoutSplittingService';
import type { StepComponentProps } from '../types';

export const SplitStep: React.FC<StepComponentProps> = ({
  state,
  onToggleSectionSelection,
  onSelectAllSections,
  onDeselectAllSections,
  onProcessLayout
}) => {
  const { splittingResult, selectedSections, isProcessing } = state;

  if (!splittingResult) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Scissors className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No splitting result available</p>
        </div>
      </div>
    );
  }

  const selectedCount = selectedSections.size;
  const totalCount = splittingResult.sections.length;

  return (
    <div className="space-y-6">
      {/* Split Results Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Scissors className="w-5 h-5 mr-2" />
          Split Results
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{totalCount}</div>
            <div className="text-sm text-gray-600">Total Sections</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{selectedCount}</div>
            <div className="text-sm text-gray-600">Selected</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {splittingResult.sections?.length || 0}
            </div>
            <div className="text-sm text-gray-600">Total Sections</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {selectedSections.size}
            </div>
            <div className="text-sm text-gray-600">Selected</div>
          </div>
        </div>

        {/* Selection Controls */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex space-x-2">
            <button
              onClick={onSelectAllSections}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Select All
            </button>
            <button
              onClick={onDeselectAllSections}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Deselect All
            </button>
          </div>
          <div className="text-sm text-gray-600">
            {selectedCount} of {totalCount} sections selected
          </div>
        </div>
      </div>

      {/* Sections List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-medium mb-4">Layout Sections</h4>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {splittingResult.sections.map((section, index) => {
            const isSelected = selectedSections.has(section.id);
            
            return (
              <div
                key={section.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => onToggleSectionSelection(section.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <div className="font-medium">
                        Section {index + 1}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Section {index + 1} • {section.type || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-600">
                        Section {index + 1} • {section.type || 'Unknown'}
                        {section.estimatedFields && (
                          <span> • {section.estimatedFields} fields</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Preview functionality would need to be implemented */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement preview functionality
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Preview section"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Content preview and issues would need to be implemented with actual LayoutSection properties */}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-between">
        <div className="text-sm text-gray-600">
          {selectedCount === 0 && (
            <div className="flex items-center text-yellow-600">
              <XCircle className="w-4 h-4 mr-2" />
              Please select at least one section to continue
            </div>
          )}
        </div>
        
        <button
          onClick={onProcessLayout}
          disabled={isProcessing || selectedCount === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Play className="w-4 h-4" />
          <span>{isProcessing ? 'Processing...' : `Process ${selectedCount} Section${selectedCount !== 1 ? 's' : ''}`}</span>
        </button>
      </div>
    </div>
  );
};
