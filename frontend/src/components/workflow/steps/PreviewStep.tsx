'use client';

import React from 'react';
import { ArrowLeft, ArrowRight, Eye, Sparkles } from 'lucide-react';
import HTMLPreview from '@/components/HTMLPreview';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { useWorkflowHandlers } from '@/hooks/useWorkflowHandlers';

export default function PreviewStep() {
  const { 
    designResult, 
    setCurrentStep, 
    originalFileName,
    uploadedImageFile
  } = useWorkflow();
  
  const { 
    handleHybridLayoutSelection 
  } = useWorkflowHandlers();

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

  const handleAIProcessing = () => {
    if (uploadedImageFile && originalFileName) {
      // Use AI-enhanced hybrid layout splitting
      handleHybridLayoutSelection(uploadedImageFile, originalFileName);
    } else {
      console.error('Missing required data for AI processing');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Preview & AI Processing</h2>
        <p className="text-gray-600">
          Your design has been analyzed. Continue with AI-enhanced layout processing for optimal results.
        </p>
      </div>

      {/* AI Processing Action */}
      <div className="mb-8">
        <div className="glass rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">AI-Enhanced Layout Processing</h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Our advanced GPT-4o Vision AI will analyze your design, detect sections intelligently, and provide you with precise layout boundaries that you can refine for perfect accuracy.
          </p>
          <div className="flex items-center justify-center space-x-6 mb-6 text-sm text-gray-500">
            <span className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Higher Accuracy</span>
            </span>
            <span className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>User Control</span>
            </span>
            <span className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span>AI Assisted</span>
            </span>
          </div>
          <button
            onClick={handleAIProcessing}
            className="inline-flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105"
          >
            <Sparkles className="w-5 h-5" />
            <span>Continue with AI Processing</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Preview Section */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Design Preview</h3>
        <div className="glass rounded-2xl p-6">
          <HTMLPreview 
            html={designResult.sections?.map(s => s.html).join('\n') || ''}
            sections={designResult.sections?.map(s => ({
              id: s.id,
              name: s.name,
              type: s.type as any,
              html: s.html,
              editableFields: s.editableFields || []
            })) || []}
            components={[]}
            description={`Generated ${designResult.sections?.length || 0} sections with quality score: ${designResult.qualityScore}`}
            fileName={originalFileName || 'Generated Design'}
            onCreateModule={() => setCurrentStep('module')}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setCurrentStep('upload')}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Upload</span>
        </button>
        
        <div className="text-sm text-gray-500">
          Choose a processing method above to continue
        </div>
      </div>
    </div>
  );
}
