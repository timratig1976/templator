'use client';

import React from 'react';
import { ArrowLeft, Package, Download, Copy, Eye } from 'lucide-react';
import HubSpotModuleEditor from '@/components/HubSpotModuleEditor';
import { useWorkflow } from '@/contexts/WorkflowContext';

export default function ModuleStep() {
  const { 
    designResult,
    downloadInfo,
    setCurrentStep,
    resetWorkflow
  } = useWorkflow();

  if (!designResult) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No design result available</p>
        <button
          onClick={() => setCurrentStep('upload')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Upload
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">HubSpot Module</h2>
        </div>
        <p className="text-gray-600">
          Your HubSpot module has been generated! Download the files or make final adjustments.
        </p>
      </div>

      {/* Success Message */}
      {downloadInfo && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 mb-2">🎉 Module Created Successfully!</h3>
              <p className="text-green-800 text-sm mb-4">
                Your HubSpot module has been generated with {designResult.sections?.length || 0} sections 
                and is ready for download.
              </p>
              <div className="flex items-center space-x-4">
                <a
                  href={downloadInfo.url}
                  download={downloadInfo.fileName}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Module</span>
                </a>
                <button
                  onClick={() => navigator.clipboard.writeText(downloadInfo.url)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HubSpot Module Editor */}
      <div className="mb-8">
        <HubSpotModuleEditor
          designResult={designResult}
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setCurrentStep('editor')}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Editor</span>
        </button>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={resetWorkflow}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Create Another Module
          </button>
          
          <button
            onClick={() => setCurrentStep('projects')}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>View Projects</span>
          </button>
        </div>
      </div>
    </div>
  );
}
