import React from 'react';
import { CheckCircle, Download, RotateCcw } from 'lucide-react';
import { StepComponentProps } from '../types';

interface CompleteStepProps extends StepComponentProps {
  onModuleComplete?: (moduleData: any) => void;
}

export default function CompleteStep({ state, onModuleComplete }: CompleteStepProps) {
  const handleDownload = () => {
    // TODO: Implement actual download functionality
    console.log('Download module:', state.assemblyResult);
  };

  const handleCreateAnother = () => {
    window.location.reload();
  };

  const handleComplete = () => {
    if (onModuleComplete && state.assemblyResult) {
      onModuleComplete(state.assemblyResult);
    }
  };

  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Module Complete!</h3>
        <p className="text-gray-600">
          Your HubSpot module has been successfully created, tested, and submitted for review.
        </p>
      </div>

      {state.assemblyResult && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left max-w-md mx-auto">
          <h4 className="font-medium text-gray-900 mb-2">Module Summary</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Strategy: {state.assemblyResult.assembled_module?.component_manifest?.assembly_strategy || 'Unknown'}</div>
            <div>Components: {state.assemblyResult.assembled_module?.component_manifest?.components_used?.length || 0}</div>
            <div>
              Size: {state.assemblyResult.assembled_module?.component_manifest?.performance_metrics?.bundle_size_kb 
                ? `${state.assemblyResult.assembled_module.component_manifest.performance_metrics.bundle_size_kb}KB`
                : 'Unknown'
              }
            </div>
            {state.testExecution && (
              <div>
                Test Score: {state.testExecution.total_tests > 0 
                  ? `${Math.round((state.testExecution.passed_tests / state.testExecution.total_tests) * 100)}%`
                  : 'N/A'
                }
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="flex justify-center space-x-4">
        <button
          onClick={handleCreateAnother}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Create Another Module</span>
        </button>
        
        <button
          onClick={handleDownload}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Download Module</span>
        </button>

        {onModuleComplete && (
          <button
            onClick={handleComplete}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Complete
          </button>
        )}
      </div>
    </div>
  );
}
