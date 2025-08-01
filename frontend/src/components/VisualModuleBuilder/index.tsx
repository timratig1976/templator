'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { VisualModuleBuilderProps } from './types';
import { useModuleBuilder } from './hooks/useModuleBuilder';
import StepIndicator from './components/StepIndicator';
import DesignStep from './components/DesignStep';
import ComponentsStep from './components/ComponentsStep';
import AssemblyStep from './components/AssemblyStep';
import TestingStep from './components/TestingStep';
import ReviewStep from './components/ReviewStep';
import CompleteStep from './components/CompleteStep';

export default function VisualModuleBuilder({
  initialDesignData,
  onModuleComplete,
  className = ''
}: VisualModuleBuilderProps) {
  const {
    state,
    updateState,
    setStep,
    handleComponentSelect,
    handleStartAssembly,
    handleRunTests,
    handleRequestReview,
    handleCompleteModule,
    getStepStatus
  } = useModuleBuilder(initialDesignData);

  const renderCurrentStep = () => {
    const stepProps = {
      state,
      onStateChange: updateState,
      onStepChange: setStep
    };

    switch (state.currentStep) {
      case 'design':
        return <DesignStep {...stepProps} />;
      
      case 'components':
        return <ComponentsStep {...stepProps} />;
      
      case 'assembly':
        return (
          <AssemblyStep 
            {...stepProps} 
            onStartAssembly={handleStartAssembly}
          />
        );
      
      case 'testing':
        return (
          <TestingStep 
            {...stepProps} 
            onRunTests={handleRunTests}
          />
        );
      
      case 'review':
        return (
          <ReviewStep 
            {...stepProps} 
            onRequestReview={handleRequestReview}
            onCompleteModule={handleCompleteModule}
          />
        );
      
      case 'complete':
        return (
          <CompleteStep 
            {...stepProps} 
            onModuleComplete={onModuleComplete}
          />
        );
      
      default:
        return <DesignStep {...stepProps} />;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6">
        <StepIndicator 
          currentStep={state.currentStep} 
          getStepStatus={getStepStatus} 
        />

        {state.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-red-800">{state.error}</span>
            </div>
          </div>
        )}

        {renderCurrentStep()}
      </div>
    </div>
  );
}
