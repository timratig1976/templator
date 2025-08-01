'use client';

import React from 'react';
import { Upload, Eye, Package, ArrowRight, Activity, Download, AlertCircle, Copy, Code, Sparkles, Zap, Target, Terminal, Folder } from 'lucide-react';
import { useWorkflow } from '@/contexts/WorkflowContext';

interface StepConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
}

const stepConfigs: StepConfig[] = [
  {
    id: 'upload',
    title: 'Upload Design',
    description: 'Upload your PNG design mockup',
    icon: Upload
  },
  {
    id: 'preview',
    title: 'Preview & Choose',
    description: 'Preview results and choose processing method',
    icon: Eye
  },
  {
    id: 'hybrid-split',
    title: 'AI Layout Analysis',
    description: 'Review and adjust AI-detected sections',
    icon: Sparkles
  },
  {
    id: 'split',
    title: 'Split Layout',
    description: 'Split design into sections',
    icon: Target
  },
  {
    id: 'editor',
    title: 'Edit & Refine',
    description: 'Customize HTML and fields',
    icon: Code
  },
  {
    id: 'module',
    title: 'HubSpot Module',
    description: 'Download your module',
    icon: Package
  },
  {
    id: 'projects',
    title: 'Projects',
    description: 'Manage your projects',
    icon: Folder
  }
];

export default function WorkflowSteps() {
  const { currentStep } = useWorkflow();

  // Get steps to show based on current workflow
  const getVisibleSteps = () => {
    const baseSteps = ['upload', 'preview'];
    
    // Handle projects step separately
    if (currentStep === 'projects') {
      return ['projects'];
    }
    
    // Handle hybrid workflow
    if (currentStep === 'hybrid-split' || currentStep === 'editor' || currentStep === 'module') {
      return [...baseSteps, 'hybrid-split', 'editor', 'module'];
    }
    
    // Handle traditional split workflow
    if (currentStep === 'split') {
      return [...baseSteps, 'split', 'editor', 'module'];
    }
    
    // Default to base steps
    return baseSteps;
  };

  const visibleSteps = getVisibleSteps();
  const currentStepIndex = visibleSteps.indexOf(currentStep);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {visibleSteps.map((stepId, index) => {
          const config = stepConfigs.find(s => s.id === stepId);
          if (!config) return null;

          const Icon = config.icon;
          const isActive = stepId === currentStep;
          const isCompleted = index < currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <React.Fragment key={stepId}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-200
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-lg scale-110' 
                      : isCompleted 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-500'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <div
                    className={`
                      text-sm font-medium mb-1
                      ${isActive 
                        ? 'text-blue-600' 
                        : isCompleted 
                          ? 'text-green-600' 
                          : 'text-gray-500'
                      }
                    `}
                  >
                    {config.title}
                  </div>
                  <div className="text-xs text-gray-500 max-w-24 leading-tight">
                    {config.description}
                  </div>
                </div>
              </div>
              
              {index < visibleSteps.length - 1 && (
                <div className="flex-shrink-0 mx-4">
                  <ArrowRight
                    className={`
                      w-4 h-4 transition-colors
                      ${isCompleted 
                        ? 'text-green-500' 
                        : isActive 
                          ? 'text-blue-600' 
                          : 'text-gray-300'
                      }
                    `}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
