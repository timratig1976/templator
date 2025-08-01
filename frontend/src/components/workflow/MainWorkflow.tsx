'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useWorkflow } from '@/contexts/WorkflowContext';
import WorkflowSteps from './WorkflowSteps';
import UploadStep from './steps/UploadStep';
import PreviewStep from './steps/PreviewStep';
import HybridSplitStep from './steps/HybridSplitStep';
import SplitStep from './steps/SplitStep';
import EditorStep from './steps/EditorStep';
import ModuleStep from './steps/ModuleStep';
import ProjectsStep from './steps/ProjectsStep';
import AILogViewer from '@/components/AILogViewer';
import SaveStatusIndicator from '@/components/SaveStatusIndicator';

export default function MainWorkflow() {
  const { 
    currentStep, 
    error, 
    setError,
    showAILogs, 
    setShowAILogs,
    isLogStreamConnected 
  } = useWorkflow();

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'upload':
        return <UploadStep />;
      case 'preview':
        return <PreviewStep />;
      case 'hybrid-split':
        return <HybridSplitStep />;
      case 'split':
        return <SplitStep />;
      case 'editor':
        return <EditorStep />;
      case 'module':
        return <ModuleStep />;
      case 'projects':
        return <ProjectsStep />;
      default:
        return <UploadStep />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="glass border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Templator</h1>
                <p className="text-xs text-gray-500">AI-Powered HubSpot Module Generator</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <SaveStatusIndicator 
                saveStatus="idle"
                isSaving={false}
                lastSaved={null}
                error={null}
                autoSaveEnabled={true}
                onToggleAutoSave={() => {}}
              />
              
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isLogStreamConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-500">
                  {isLogStreamConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              <button
                onClick={() => setShowAILogs(!showAILogs)}
                className={`
                  px-4 py-2 rounded-lg font-medium transition-colors
                  ${showAILogs 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }
                `}  
              >
                {showAILogs ? 'Hide Logs' : 'Show Logs'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workflow Steps */}
        {currentStep !== 'projects' && <WorkflowSteps />}

        {/* Global Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* AI Logs Section */}
        {showAILogs && (
          <div className="mb-8 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">🔍 Real-time AI Process Monitoring</h3>
              <p className="text-sm text-blue-800 mb-3">
                This log viewer shows real-time information about OpenAI API calls, upload progress, 
                and processing stages. Use it to identify issues and monitor performance.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span>Info & Progress</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span>Success</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <span>Warnings</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span>Errors</span>
                </div>
              </div>
            </div>
            
            <AILogViewer 
              className="max-w-full"
              maxHeight="500px"
              showFilters={true}
              autoScroll={true}
            />
          </div>
        )}

        {/* Current Step Content */}
        {renderCurrentStep()}
      </main>
    </div>
  );
}
