/**
 * Custom hook for LayoutSplittingManager business logic and state management
 */

import { useState, useEffect, useCallback } from 'react';
import layoutSplittingService from '../../../services/layoutSplittingService';
import type {
  LayoutSplittingState,
  LayoutSplittingManagerProps,
  ProcessingProgress
} from '../types';

const initialProgress: ProcessingProgress = {
  currentBatch: 0,
  totalBatches: 0,
  currentSection: 0,
  totalSections: 0
};

const initialState: LayoutSplittingState = {
  currentStep: 'analyze',
  analysis: null,
  splittingResult: null,
  processingResult: null,
  isProcessing: false,
  error: null,
  selectedSections: new Set(),
  splittingOptions: {},
  processingOptions: {},
  showAdvancedOptions: false,
  processingProgress: initialProgress
};

export const useLayoutSplitting = (props: LayoutSplittingManagerProps) => {
  const { html, onComplete, onSectionComplete } = props;
  const [state, setState] = useState<LayoutSplittingState>(initialState);

  // Update state helper
  const updateState = useCallback((updates: Partial<LayoutSplittingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Initialize analysis when HTML changes
  useEffect(() => {
    if (html) {
      analyzeLayout();
    }
  }, [html]);

  const analyzeLayout = useCallback(async () => {
    try {
      updateState({ error: null });
      const fileSize = layoutSplittingService.estimateFileSize(html);
      const analysisResult = await layoutSplittingService.analyzeLayout(fileSize);
      
      // Set recommended options
      const recommended = layoutSplittingService.getRecommendedConfiguration(fileSize);
      
      updateState({
        analysis: analysisResult,
        splittingOptions: recommended.splitting,
        processingOptions: recommended.processing
      });
    } catch (err) {
      updateState({
        error: err instanceof Error ? err.message : 'Failed to analyze layout'
      });
    }
  }, [html, updateState]);

  const splitLayout = useCallback(async () => {
    try {
      updateState({ error: null, isProcessing: true });
      
      const result = await layoutSplittingService.splitLayout(html, state.splittingOptions);
      
      // Select all sections by default
      const allSectionIds = new Set(result.sections.map(s => s.id));
      
      updateState({
        splittingResult: result,
        selectedSections: allSectionIds,
        currentStep: 'split',
        isProcessing: false
      });
    } catch (err) {
      updateState({
        error: err instanceof Error ? err.message : 'Failed to split layout',
        isProcessing: false
      });
    }
  }, [html, state.splittingOptions, updateState]);

  const processLayout = useCallback(async () => {
    if (!state.splittingResult) return;

    try {
      updateState({ 
        error: null, 
        isProcessing: true, 
        currentStep: 'process' 
      });
      
      // Filter selected sections
      const filteredResult = {
        ...state.splittingResult,
        sections: state.splittingResult.sections.filter(s => state.selectedSections.has(s.id)),
        totalSections: state.selectedSections.size
      };

      const result = await layoutSplittingService.processSections(filteredResult, state.processingOptions);
      
      updateState({
        processingResult: result,
        currentStep: 'complete',
        isProcessing: false
      });
      
      if (onComplete) {
        onComplete(result);
      }
    } catch (err) {
      updateState({
        error: err instanceof Error ? err.message : 'Failed to process sections',
        isProcessing: false
      });
    }
  }, [state.splittingResult, state.selectedSections, state.processingOptions, onComplete, updateState]);

  const toggleSectionSelection = useCallback((sectionId: string) => {
    const newSelection = new Set(state.selectedSections);
    if (newSelection.has(sectionId)) {
      newSelection.delete(sectionId);
    } else {
      newSelection.add(sectionId);
    }
    updateState({ selectedSections: newSelection });
  }, [state.selectedSections, updateState]);

  const selectAllSections = useCallback(() => {
    if (state.splittingResult) {
      const allSectionIds = new Set(state.splittingResult.sections.map(s => s.id));
      updateState({ selectedSections: allSectionIds });
    }
  }, [state.splittingResult, updateState]);

  const deselectAllSections = useCallback(() => {
    updateState({ selectedSections: new Set() });
  }, [updateState]);

  const downloadResult = useCallback(() => {
    if (!state.processingResult?.combinedModule) return;

    const dataStr = JSON.stringify(state.processingResult.combinedModule, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `layout-module-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [state.processingResult]);

  return {
    state,
    updateState,
    analyzeLayout,
    splitLayout,
    processLayout,
    toggleSectionSelection,
    selectAllSections,
    deselectAllSections,
    downloadResult
  };
};
