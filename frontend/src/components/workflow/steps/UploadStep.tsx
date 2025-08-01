'use client';

import React from 'react';
import { Upload, Eye, Package, ArrowRight, Activity, Download, AlertCircle, Copy, Code, Sparkles, Zap, Target, Terminal, Folder } from 'lucide-react';
import DesignUpload from '@/components/DesignUpload';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { useWorkflowHandlers } from '@/hooks/useWorkflowHandlers';

export default function UploadStep() {
  const { error, setError, setCurrentStep } = useWorkflow();
  const { handleUploadSuccess, handleUploadError, handleHybridLayoutSelection } = useWorkflowHandlers();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Error Display */}
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

      {/* Upload Component */}
      <DesignUpload
        onUploadSuccess={handleUploadSuccess}
        onUploadError={handleUploadError}
        onHybridLayoutSelected={handleHybridLayoutSelection}
      />

      {/* Navigation */}
      <div className="mt-8 flex justify-between items-center">
        <button
          onClick={() => setCurrentStep('projects')}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <Folder className="w-4 h-4" />
          <span>View Projects</span>
        </button>
      </div>

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-8 mt-12">
        <div className="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Conversion</h3>
          <p className="text-gray-600 text-sm">
            Advanced GPT-4 Vision analyzes your designs and generates clean, semantic HTML with Tailwind CSS.
          </p>
        </div>

        <div className="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Target className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Section Detection</h3>
          <p className="text-gray-600 text-sm">
            Automatically identifies headers, content areas, and components, creating optimal HubSpot field mappings.
          </p>
        </div>

        <div className="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">HubSpot Ready</h3>
          <p className="text-gray-600 text-sm">
            Generates complete module files with HubL templates, field definitions, and responsive design.
          </p>
        </div>
      </div>
    </div>
  );
}
