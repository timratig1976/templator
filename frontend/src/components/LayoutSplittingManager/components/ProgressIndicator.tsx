/**
 * Progress indicator component for LayoutSplittingManager workflow steps
 */

import React from 'react';
import { 
  BarChart3,
  Scissors,
  Zap,
  CheckCircle
} from 'lucide-react';
import type { ProgressIndicatorProps, StepType } from '../types';

const steps = [
  { step: 'analyze' as StepType, label: 'Analyze', icon: BarChart3 },
  { step: 'split' as StepType, label: 'Split', icon: Scissors },
  { step: 'process' as StepType, label: 'Process', icon: Zap },
  { step: 'complete' as StepType, label: 'Complete', icon: CheckCircle }
];

const stepOrder: StepType[] = ['analyze', 'split', 'process', 'complete'];

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ currentStep }) => {
  const currentStepIndex = stepOrder.indexOf(currentStep);

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex === currentStepIndex) {
      return 'current';
    } else if (stepIndex < currentStepIndex) {
      return 'completed';
    } else {
      return 'pending';
    }
  };

  const getStepClasses = (status: string) => {
    switch (status) {
      case 'current':
        return 'border-blue-500 bg-blue-500 text-white';
      case 'completed':
        return 'border-green-500 bg-green-500 text-white';
      case 'pending':
      default:
        return 'border-gray-300 bg-white text-gray-400';
    }
  };

  const getConnectorClasses = (stepIndex: number) => {
    return stepIndex < currentStepIndex ? 'bg-green-500' : 'bg-gray-300';
  };

  const getLabelClasses = (status: string) => {
    return status === 'current' ? 'text-blue-600' : 'text-gray-600';
  };

  return (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {steps.map(({ step, label, icon: Icon }, index) => {
          const status = getStepStatus(index);
          
          return (
            <div key={step} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${getStepClasses(status)}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`ml-2 text-sm font-medium ${getLabelClasses(status)}`}>
                {label}
              </span>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-4 ${getConnectorClasses(index)}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
