/**
 * Type definitions for LayoutSplittingManager components
 */

import {
  LayoutSection,
  SplittingResult,
  ProcessingResult,
  ProcessedSection,
  SplittingOptions,
  ProcessingOptions,
  LayoutAnalysis
} from '../../services/layoutSplittingService';

export interface LayoutSplittingManagerProps {
  html: string;
  onComplete?: (result: ProcessingResult) => void;
  onSectionComplete?: (section: ProcessedSection) => void;
}

export type StepType = 'analyze' | 'split' | 'process' | 'complete';

export interface ProcessingProgress {
  currentBatch: number;
  totalBatches: number;
  currentSection: number;
  totalSections: number;
}

export interface LayoutSplittingState {
  currentStep: StepType;
  analysis: LayoutAnalysis | null;
  splittingResult: SplittingResult | null;
  processingResult: ProcessingResult | null;
  isProcessing: boolean;
  error: string | null;
  selectedSections: Set<string>;
  splittingOptions: SplittingOptions;
  processingOptions: ProcessingOptions;
  showAdvancedOptions: boolean;
  processingProgress: ProcessingProgress;
}

export interface StepComponentProps {
  state: LayoutSplittingState;
  onStateChange: (updates: Partial<LayoutSplittingState>) => void;
  onAnalyzeLayout: () => Promise<void>;
  onSplitLayout: () => Promise<void>;
  onProcessLayout: () => Promise<void>;
  onToggleSectionSelection: (sectionId: string) => void;
  onSelectAllSections: () => void;
  onDeselectAllSections: () => void;
  onDownloadResult: () => void;
}

export interface ProgressIndicatorProps {
  currentStep: StepType;
}

// Re-export service types for convenience
export type {
  LayoutSection,
  SplittingResult,
  ProcessingResult,
  ProcessedSection,
  SplittingOptions,
  ProcessingOptions,
  LayoutAnalysis
};
