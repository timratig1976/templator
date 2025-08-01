/**
 * LayoutSplittingManager - Re-export from modular structure
 * 
 * This file has been refactored from a monolithic 647-line component
 * into a clean, modular architecture with the following structure:
 * 
 * - hooks/useLayoutSplitting.ts - Business logic and state management
 * - components/ProgressIndicator.tsx - Progress visualization
 * - components/AnalysisStep.tsx - Layout analysis step
 * - components/SplitStep.tsx - Section splitting step  
 * - components/ProcessStep.tsx - Processing step
 * - components/CompleteStep.tsx - Completion step
 * - index.tsx - Main orchestrator component
 * 
 * Benefits:
 * - Single responsibility principle
 * - Improved maintainability and testability
 * - Clear separation of concerns
 * - Reusable components
 */

// Re-export the modular LayoutSplittingManager
export { default } from './LayoutSplittingManager/index';

// Re-export types for external use
export type {
  LayoutSplittingManagerProps,
  StepType,
  ProcessingProgress,
  LayoutSplittingState
} from './LayoutSplittingManager/types';
