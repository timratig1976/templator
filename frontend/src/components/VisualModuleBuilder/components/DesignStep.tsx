import React from 'react';
import { ArrowRight, Upload, FileText, Palette } from 'lucide-react';
import { StepComponentProps } from '../types';

export default function DesignStep({ state, onStateChange, onStepChange }: StepComponentProps) {
  const handleDesignRequirementsChange = (value: string) => {
    onStateChange({
      assemblyRequest: {
        ...state.assemblyRequest,
        design_requirements: value
      }
    });
  };

  const handleModuleTypeChange = (value: string) => {
    onStateChange({
      assemblyRequest: {
        ...state.assemblyRequest,
        target_module_type: value
      }
    });
  };

  const handleComplexityChange = (value: string) => {
    onStateChange({
      assemblyRequest: {
        ...state.assemblyRequest,
        component_preferences: {
          ...state.assemblyRequest.component_preferences,
          complexity_preference: value as "simple" | "moderate" | "complex"
        }
      }
    });
  };

  const canProceed = state.assemblyRequest.design_requirements && 
                    state.assemblyRequest.design_requirements.trim().length > 0;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Design Requirements</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Module Type
            </label>
            <select
              value={state.assemblyRequest.target_module_type || 'content'}
              onChange={(e) => handleModuleTypeChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="content">Content Module</option>
              <option value="form">Form Module</option>
              <option value="navigation">Navigation Module</option>
              <option value="hero">Hero Section</option>
              <option value="testimonial">Testimonial</option>
              <option value="pricing">Pricing Table</option>
              <option value="gallery">Image Gallery</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Complexity Preference
            </label>
            <select
              value={state.assemblyRequest.component_preferences?.complexity_preference || 'moderate'}
              onChange={(e) => handleComplexityChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="simple">Simple - Basic functionality</option>
              <option value="moderate">Moderate - Standard features</option>
              <option value="complex">Complex - Advanced features</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Design Requirements *
            </label>
            <textarea
              value={state.assemblyRequest.design_requirements || ''}
              onChange={(e) => handleDesignRequirementsChange(e.target.value)}
              placeholder="Describe your module requirements, design preferences, functionality needs, and any specific features you want to include..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            <div className="mt-1 text-sm text-gray-500">
              {state.assemblyRequest.design_requirements?.length || 0} characters
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <div className="font-medium text-blue-900 mb-1">Design Tips</div>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Be specific about colors, fonts, and layout preferences</li>
              <li>• Mention any branding requirements or style guidelines</li>
              <li>• Include functionality requirements (forms, interactions, etc.)</li>
              <li>• Specify responsive behavior for different screen sizes</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <div></div>
        <button
          onClick={() => onStepChange('components')}
          disabled={!canProceed}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <span>Continue to Components</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
