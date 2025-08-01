import React from 'react';
import { ArrowRight, ArrowLeft, Play, CheckCircle, AlertTriangle, Clock, Code, Eye } from 'lucide-react';
import { StepComponentProps } from '../types';

interface AssemblyStepProps extends StepComponentProps {
  onStartAssembly: () => void;
}

export default function AssemblyStep({ state, onStateChange, onStepChange, onStartAssembly }: AssemblyStepProps) {
  const hasStartedAssembly = state.assemblyResult !== null;
  const isAssemblyComplete = state.assemblyResult?.status === 'success';
  const isAssemblyFailed = state.assemblyResult?.status === 'failed';

  const getStatusIcon = () => {
    if (state.loading) return <Clock className="w-5 h-5 text-blue-600 animate-spin" />;
    if (isAssemblyComplete) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (isAssemblyFailed) return <AlertTriangle className="w-5 h-5 text-red-600" />;
    return <Play className="w-5 h-5 text-blue-600" />;
  };

  const getStatusText = () => {
    if (state.loading) return 'Assembling components...';
    if (isAssemblyComplete) return 'Assembly completed successfully';
    if (isAssemblyFailed) return 'Assembly failed';
    return 'Ready to start assembly';
  };

  const getStatusColor = () => {
    if (state.loading) return 'border-blue-200 bg-blue-50';
    if (isAssemblyComplete) return 'border-green-200 bg-green-50';
    if (isAssemblyFailed) return 'border-red-200 bg-red-50';
    return 'border-gray-200 bg-gray-50';
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Component Assembly</h3>

      <div className={`border rounded-lg p-4 ${getStatusColor()}`}>
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div className="flex-1">
            <div className="font-medium text-gray-900">{getStatusText()}</div>
            {state.assemblyStatus && (
              <div className="text-sm text-gray-600 mt-1">
                Progress: {state.assemblyStatus.progress_percentage || 0}%
              </div>
            )}
          </div>
        </div>
      </div>

      {!hasStartedAssembly && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-800">
            <strong>Assembly Process:</strong> Our AI will analyze your design requirements and selected components 
            to create a custom HubSpot module. This process typically takes 30-60 seconds.
          </div>
        </div>
      )}

      {state.assemblyResult && (
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Assembly Results</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Assembly Strategy</div>
                <div className="font-medium">{state.assemblyResult.assembled_module?.component_manifest?.assembly_strategy || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-gray-600">Components Used</div>
                <div className="font-medium">{state.assemblyResult.assembled_module?.component_manifest?.components_used?.length || 0}</div>
              </div>
              <div>
                <div className="text-gray-600">File Size</div>
                <div className="font-medium">
                  {state.assemblyResult.assembled_module?.component_manifest?.performance_metrics?.bundle_size_kb 
                    ? `${state.assemblyResult.assembled_module.component_manifest.performance_metrics.bundle_size_kb}KB`
                    : 'Unknown'
                  }
                </div>
              </div>
              <div>
                <div className="text-gray-600">Overall Quality</div>
                <div className="font-medium">
                  {state.assemblyResult.quality_metrics?.overall_score 
                    ? `${Math.round(state.assemblyResult.quality_metrics.overall_score * 100)}%`
                    : 'Pending'
                  }
                </div>
              </div>
            </div>
          </div>

          {state.assemblyResult.assembled_module?.component_manifest?.components_used && state.assemblyResult.assembled_module.component_manifest.components_used.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Components Used</h4>
              <div className="space-y-2">
                {state.assemblyResult.assembled_module.component_manifest.components_used.map((component: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      <Code className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">{component.name || `Component ${index + 1}`}</span>
                    </div>
                    <span className="text-xs text-gray-500">{component.type || 'Unknown'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}


        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => onStepChange('components')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Components</span>
        </button>

        <div className="flex space-x-3">
          {!hasStartedAssembly && (
            <button
              onClick={onStartAssembly}
              disabled={state.loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>Start Assembly</span>
            </button>
          )}

          {isAssemblyComplete && (
            <button
              onClick={() => onStepChange('testing')}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
            >
              <span>Continue to Testing</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
