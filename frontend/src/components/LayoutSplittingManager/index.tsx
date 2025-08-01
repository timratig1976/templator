/**
 * Main LayoutSplittingManager component - orchestrates the layout splitting workflow
 */

import React from 'react';
import { XCircle } from 'lucide-react';
import { useLayoutSplitting } from './hooks/useLayoutSplitting';
import {
  ProgressIndicator,
  AnalysisStep,
  SplitStep,
  ProcessStep,
  CompleteStep
} from './components';
import type { LayoutSplittingManagerProps } from './types';

const LayoutSplittingManager: React.FC<LayoutSplittingManagerProps> = (props) => {
  const {
    state,
    updateState,
    analyzeLayout,
    splitLayout,
    processLayout,
    toggleSectionSelection,
    selectAllSections,
    deselectAllSections,
    downloadResult
  } = useLayoutSplitting(props);

  const stepProps = {
    state,
    onStateChange: updateState,
    onAnalyzeLayout: analyzeLayout,
    onSplitLayout: splitLayout,
    onProcessLayout: processLayout,
    onToggleSectionSelection: toggleSectionSelection,
    onSelectAllSections: selectAllSections,
    onDeselectAllSections: deselectAllSections,
    onDownloadResult: downloadResult
  };

  const renderCurrentStep = () => {
    switch (state.currentStep) {
      case 'analyze':
        return <AnalysisStep {...stepProps} />;
      case 'split':
        return <SplitStep {...stepProps} />;
      case 'process':
        return <ProcessStep {...stepProps} />;
      case 'complete':
        return <CompleteStep {...stepProps} />;
      default:
        return <AnalysisStep {...stepProps} />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Steps */}
      <ProgressIndicator currentStep={state.currentStep} />

      {/* Error Display */}
      {state.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
          <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-800">Error</h4>
            <p className="text-red-700">{state.error}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      {renderCurrentStep()}
    </div>
  );
};

export default LayoutSplittingManager;
