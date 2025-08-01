'use client';

import React from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import HybridLayoutSplitter from '@/components/HybridLayoutSplitter';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { useWorkflowHandlers } from '@/hooks/useWorkflowHandlers';

export default function HybridSplitStep() {
  const { 
    hybridAnalysisResult,
    uploadedImageFile,
    setCurrentStep,
    error
  } = useWorkflow();
  
  const { 
    handleHybridSectionsConfirmed,
    submitHybridFeedback 
  } = useWorkflowHandlers();

  if (!hybridAnalysisResult || !uploadedImageFile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No hybrid analysis result available</p>
        <button
          onClick={() => setCurrentStep('preview')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Preview
        </button>
      </div>
    );
  }

  const handleSectionsConfirmed = (confirmedSections: any[]) => {
    // Submit feedback for AI improvement
    if (hybridAnalysisResult.sections) {
      submitHybridFeedback(hybridAnalysisResult.sections, confirmedSections);
    }
    
    // Process the confirmed sections
    handleHybridSectionsConfirmed(confirmedSections);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">AI Layout Analysis</h2>
        </div>
        
        {hybridAnalysisResult.confidence && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-blue-900">🧠 AI Layout Analysis Complete</h3>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-blue-700">
                  AI Confidence: <strong>{Math.round(hybridAnalysisResult.confidence * 100)}%</strong>
                </span>
                {hybridAnalysisResult.quality && (
                  <span className="text-blue-700">
                    Quality Score: <strong>{Math.round(hybridAnalysisResult.quality * 100)}%</strong>
                  </span>
                )}
              </div>
            </div>
            <p className="text-blue-800 text-sm">
              Our AI has detected <strong>{hybridAnalysisResult.sections?.length || 0} sections</strong> in your design. 
              Review and adjust the sections below, then confirm to generate HTML.
            </p>
          </div>
        )}
      </div>

      {/* Hybrid Layout Splitter */}
      <div className="mb-8">
        <HybridLayoutSplitter
          imageFile={uploadedImageFile}
          aiDetectedSections={hybridAnalysisResult.sections || []}
          onSectionsConfirmed={handleSectionsConfirmed}
          onBack={() => setCurrentStep('preview')}
          enhancedAnalysis={hybridAnalysisResult.enhancedAnalysis}
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setCurrentStep('preview')}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Preview</span>
        </button>
        
        <div className="text-sm text-gray-500">
          Adjust sections above and click "Confirm Sections" to continue
        </div>
      </div>
    </div>
  );
}
