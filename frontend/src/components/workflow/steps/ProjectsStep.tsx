'use client';

import React from 'react';
import { ArrowLeft, Folder } from 'lucide-react';
import ProjectManager from '@/components/ProjectManager';
import { useWorkflow } from '@/contexts/WorkflowContext';

export default function ProjectsStep() {
  const { setCurrentStep } = useWorkflow();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Folder className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        </div>
        <p className="text-gray-600">
          Manage your saved projects, view previous designs, and continue working on existing modules.
        </p>
      </div>

      {/* Project Manager */}
      <div className="mb-8">
        <ProjectManager 
          onLoadProject={() => {}} 
          onCreateNew={() => setCurrentStep('upload')}
        />
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
          Select a project above to continue working on it
        </div>
      </div>
    </div>
  );
}
