import React from 'react';
import { CheckCircle, Circle, Settings, Plus, Zap, Target, Eye, Download } from 'lucide-react';
import { ModuleBuilderStep } from '../types';

interface StepIndicatorProps {
  currentStep: ModuleBuilderStep;
  getStepStatus: (step: string) => 'completed' | 'current' | 'pending';
}

const steps = [
  { id: 'design', label: 'Design', icon: Settings },
  { id: 'components', label: 'Components', icon: Plus },
  { id: 'assembly', label: 'Assembly', icon: Zap },
  { id: 'testing', label: 'Testing', icon: Target },
  { id: 'review', label: 'Review', icon: Eye },
  { id: 'complete', label: 'Complete', icon: Download }
];

export default function StepIndicator({ currentStep, getStepStatus }: StepIndicatorProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;
          
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                  ${status === 'completed' 
                    ? 'bg-green-100 border-green-500 text-green-600' 
                    : status === 'current'
                    ? 'bg-blue-100 border-blue-500 text-blue-600'
                    : 'bg-gray-100 border-gray-300 text-gray-400'
                  }
                `}>
                  {status === 'completed' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className={`
                  mt-2 text-sm font-medium
                  ${status === 'current' ? 'text-blue-600' : 'text-gray-600'}
                `}>
                  {step.label}
                </div>
              </div>
              
              {index < steps.length - 1 && (
                <div className={`
                  flex-1 h-0.5 mx-4 transition-colors
                  ${getStepStatus(steps[index + 1].id) === 'completed' || 
                    (status === 'completed' && getStepStatus(steps[index + 1].id) === 'current')
                    ? 'bg-green-300' 
                    : 'bg-gray-300'
                  }
                `} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
