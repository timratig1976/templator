import { TestSuiteExecution } from '../../services/testSuiteService';
import { AssemblyRequest, AssemblyResult, AssemblyStatus } from '../../services/assemblyEngineService';

export type ModuleBuilderStep = 'design' | 'components' | 'assembly' | 'testing' | 'review' | 'complete';

export interface VisualModuleBuilderProps {
  initialDesignData?: any;
  onModuleComplete?: (moduleData: any) => void;
  className?: string;
}

export interface ModuleBuilderState {
  currentStep: ModuleBuilderStep;
  selectedComponents: string[];
  assemblyRequest: Partial<AssemblyRequest>;
  assemblyResult: AssemblyResult | null;
  assemblyStatus: AssemblyStatus | null;
  testExecution: TestSuiteExecution | null;
  reviewRequest: string | null;
  loading: boolean;
  error: string | null;
}

export interface StepComponentProps {
  state: ModuleBuilderState;
  onStateChange: (updates: Partial<ModuleBuilderState>) => void;
  onStepChange: (step: ModuleBuilderStep) => void;
}

// Re-export service types for convenience
export type { AssemblyRequest, AssemblyResult, AssemblyStatus } from '@/services/assemblyEngineService';
export type { TestSuiteExecution } from '@/services/testSuiteService';
export type { ReviewRequest } from '@/services/expertReviewService';
export type { Component } from '@/services/componentLibraryService';
