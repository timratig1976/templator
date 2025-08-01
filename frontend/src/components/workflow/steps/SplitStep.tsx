'use client';

import React from 'react';
import { ArrowLeft, Target } from 'lucide-react';
import LayoutSplittingManager from '@/components/LayoutSplittingManager';
import { useWorkflow } from '@/contexts/WorkflowContext';

export default function SplitStep() {
  const { 
    designResult,
    splittingResult,
    setSplittingResult,
    setCurrentStep,
    setDesignResult
  } = useWorkflow();

  if (!designResult) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No design result available</p>
        <button
          onClick={() => setCurrentStep('preview')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Preview
        </button>
      </div>
    );
  }

  const handleSplittingComplete = (result: any) => {
    setSplittingResult(result);
    
    // Update design result with split sections
    if (result.sections) {
      setDesignResult({
        ...designResult,
        sections: result.sections
      });
    }
    
    setCurrentStep('editor');
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Split Layout</h2>
        </div>
        <p className="text-gray-600">
          Split your design into logical sections for better HTML generation and HubSpot field mapping.
        </p>
      </div>

      {/* Layout Splitting Manager */}
      <div className="mb-8">
        <LayoutSplittingManager
          html={designResult.sections?.map(s => s.html).join('\n') || ''}
          onComplete={handleSplittingComplete}
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
          Split your design above to continue
        </div>
      </div>
    </div>
  );
}
