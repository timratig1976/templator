import React from 'react';
import { ArrowRight, ArrowLeft, Play, CheckCircle, AlertTriangle, Clock, Target, Eye } from 'lucide-react';
import { StepComponentProps } from '../types';

interface TestingStepProps extends StepComponentProps {
  onRunTests: () => void;
}

export default function TestingStep({ state, onStateChange, onStepChange, onRunTests }: TestingStepProps) {
  const hasStartedTesting = state.testExecution !== null;
  const isTestingComplete = state.testExecution?.status === 'completed';
  const isTestingFailed = state.testExecution?.status === 'failed';

  const getStatusIcon = () => {
    if (state.loading) return <Clock className="w-5 h-5 text-blue-600 animate-spin" />;
    if (isTestingComplete) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (isTestingFailed) return <AlertTriangle className="w-5 h-5 text-red-600" />;
    return <Target className="w-5 h-5 text-blue-600" />;
  };

  const getStatusText = () => {
    if (state.loading) return 'Running tests...';
    if (isTestingComplete) return 'All tests completed';
    if (isTestingFailed) return 'Some tests failed';
    return 'Ready to run tests';
  };

  const getStatusColor = () => {
    if (state.loading) return 'border-blue-200 bg-blue-50';
    if (isTestingComplete) return 'border-green-200 bg-green-50';
    if (isTestingFailed) return 'border-red-200 bg-red-50';
    return 'border-gray-200 bg-gray-50';
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Quality Testing</h3>

      <div className={`border rounded-lg p-4 ${getStatusColor()}`}>
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div className="flex-1">
            <div className="font-medium text-gray-900">{getStatusText()}</div>
            {state.testExecution && (
              <div className="text-sm text-gray-600 mt-1">
                Progress: {state.testExecution.progress_percentage || 0}%
              </div>
            )}
          </div>
        </div>
      </div>

      {!hasStartedTesting && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-800">
            <strong>Testing Suite:</strong> We'll run comprehensive tests including functionality, 
            accessibility, performance, and HubSpot compatibility checks.
          </div>
        </div>
      )}

      {state.testExecution && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold mb-1 text-green-600">
                {state.testExecution.passed_tests}
              </div>
              <div className="text-sm text-gray-600">Passed</div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold mb-1 text-red-600">
                {state.testExecution.failed_tests}
              </div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold mb-1 text-yellow-600">
                {state.testExecution.skipped_tests}
              </div>
              <div className="text-sm text-gray-600">Skipped</div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold mb-1 text-blue-600">
                {state.testExecution.total_tests}
              </div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Test Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Success Rate:</span>
                <span className="font-medium">
                  {state.testExecution.total_tests > 0 
                    ? Math.round((state.testExecution.passed_tests / state.testExecution.total_tests) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Execution Time:</span>
                <span className="font-medium">{state.testExecution.execution_time_ms}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="font-medium capitalize">{state.testExecution.status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => onStepChange('assembly')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Assembly</span>
        </button>

        <div className="flex space-x-3">
          {!hasStartedTesting && (
            <button
              onClick={onRunTests}
              disabled={state.loading || !state.assemblyResult}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>Run Tests</span>
            </button>
          )}

          {isTestingComplete && (
            <button
              onClick={() => onStepChange('review')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <Eye className="w-4 h-4" />
              <span>Request Review</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
