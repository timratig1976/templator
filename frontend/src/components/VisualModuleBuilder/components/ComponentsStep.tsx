import React from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import ComponentLibraryBrowser from '../../ComponentLibraryBrowser';
import { StepComponentProps } from '../types';

export default function ComponentsStep({ state, onStateChange, onStepChange }: StepComponentProps) {
  const handleComponentSelect = (component: any) => {
    const isSelected = state.selectedComponents.includes(component.id);
    const newSelectedComponents = isSelected
      ? state.selectedComponents.filter(id => id !== component.id)
      : [...state.selectedComponents, component.id];

    onStateChange({
      selectedComponents: newSelectedComponents,
      assemblyRequest: {
        ...state.assemblyRequest,
        component_preferences: {
          ...state.assemblyRequest.component_preferences,
          preferred_components: newSelectedComponents
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Select Components</h3>
        <div className="text-sm text-gray-600">
          {state.selectedComponents.length} component{state.selectedComponents.length !== 1 ? 's' : ''} selected
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="text-sm text-blue-800">
          <strong>Optional:</strong> Select specific components you'd like to include in your module. 
          If none are selected, our AI will automatically choose the best components based on your design requirements.
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg">
        <ComponentLibraryBrowser
          onComponentSelect={handleComponentSelect}
          selectedComponents={state.selectedComponents}
          filterByType={state.assemblyRequest.target_module_type}
        />
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => onStepChange('design')}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Design</span>
        </button>
        <button
          onClick={() => onStepChange('assembly')}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <span>Continue to Assembly</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
