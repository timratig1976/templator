'use client';

import React from 'react';
import { ArrowLeft, ArrowRight, Eye, Sparkles, Zap } from 'lucide-react';
import HTMLPreview from '@/components/HTMLPreview';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { useWorkflowHandlers } from '@/hooks/useWorkflowHandlers';

export default function PreviewStep() {
  const { 
    designResult, 
    setCurrentStep, 
    setShouldUseSplitting,
    originalFileName,
    uploadedImageFile
  } = useWorkflow();
  
  const { 
    handleTraditionalLayoutAnalysis,
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

  const handleProcessingChoice = (useHybrid: boolean) => {
    setShouldUseSplitting(useHybrid);
    
    if (useHybrid && uploadedImageFile && originalFileName) {
      // Use hybrid layout splitting
      handleHybridLayoutSelection(uploadedImageFile, originalFileName);
    } else {
      // Use traditional processing
      handleTraditionalLayoutAnalysis(designResult);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Preview & Choose Processing Method</h2>
        <p className="text-gray-600">
          Your design has been analyzed. Choose how you'd like to proceed with processing.
        </p>
      </div>

      {/* Processing Method Selection */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="glass rounded-2xl p-6 border-2 border-transparent hover:border-blue-200 transition-all cursor-pointer group"
             onClick={() => handleProcessingChoice(true)}>
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Hybrid AI + User Layout Splitting</h3>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-3">
                AI suggests section boundaries, you refine them for perfect accuracy. Best for complex layouts.
              </p>
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Higher Accuracy</span>
                </span>
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>User Control</span>
                </span>
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>AI Assisted</span>
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border-2 border-transparent hover:border-green-200 transition-all cursor-pointer group"
             onClick={() => handleProcessingChoice(false)}>
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">Traditional AI Pipeline</h3>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  Fast
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-3">
                Fully automated AI processing with smart section detection. Quick and efficient.
              </p>
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Fully Automated</span>
                </span>
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>Quick Processing</span>
                </span>
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>AI Optimized</span>
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <ArrowRight className="w-5 h-5 text-green-600 group-hover:translate-x-1 transition-transform" />
          </div>
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
