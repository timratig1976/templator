'use client';

import React from 'react';
import { ArrowLeft, ArrowRight, Code } from 'lucide-react';
import SectionStackEditor from '@/components/SectionStackEditor';
import { useWorkflow } from '@/contexts/WorkflowContext';
import { useWorkflowHandlers } from '@/hooks/useWorkflowHandlers';

export default function EditorStep() {
  const { 
    designResult,
    setCurrentStep,
    setDesignResult
  } = useWorkflow();
  
  const { handleCreateModule } = useWorkflowHandlers();

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

  const handleSectionsUpdated = (updatedSections: any[]) => {
    setDesignResult({
      ...designResult,
      sections: updatedSections
    });
  };

  const getPreviousStep = () => {
    // Determine previous step based on current workflow
    if (designResult.metadata?.aiModelsUsed?.some(model => model.includes('hybrid'))) {
      return 'hybrid-split';
    }
    return 'preview';
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
            <Code className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Edit & Refine</h2>
        </div>
        <p className="text-gray-600">
          Customize the generated HTML, edit field mappings, and refine your sections before creating the HubSpot module.
        </p>
      </div>

      {/* Section Stack Editor */}
      <div className="mb-8">
        <SectionStackEditor
          designResult={designResult}
          onSectionUpdate={(sectionId, updatedSection) => {
            const updatedSections = designResult.sections?.map(section => 
              section.id === sectionId ? updatedSection : section
            ) || [];
            handleSectionsUpdated(updatedSections);
          }}
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setCurrentStep(getPreviousStep() as any)}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        
        <button
          onClick={handleCreateModule}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
        >
          <span>Create HubSpot Module</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
