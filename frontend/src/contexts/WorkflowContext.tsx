'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PipelineExecutionResult } from '@/services/pipelineService';
import { useProjectManager } from '@/hooks/useProjectManager';
import { aiLogger } from '@/services/aiLogger';
import { socketClient } from '@/services/socketClient';

export type WorkflowStep = 'upload' | 'preview' | 'hybrid-split' | 'editor' | 'module' | 'projects';

// Planned generation item for Phase 2 generator step
export interface GenerationPlanItem {
  id: string;
  label: string;
  type: 'header' | 'hero' | 'content' | 'footer' | 'sidebar' | 'navigation' | 'form' | 'gallery' | 'testimonial' | 'cta' | 'other';
  generateHtml: boolean;
  generateModule: boolean;
  moduleName?: string;
  notes?: string;
}

export interface Section {
  id: string;
  name: string;
  type: 'header' | 'hero' | 'content' | 'footer' | 'sidebar' | 'navigation';
  html: string;
  editableFields: EditableField[];
}

export interface EditableField {
  id: string;
  name: string;
  type: 'text' | 'rich_text' | 'image' | 'url' | 'boolean';
  selector: string;
  defaultValue: string;
  required: boolean;
}

export interface Component {
  id: string;
  name: string;
  type: 'text' | 'image' | 'button' | 'link' | 'form' | 'list';
  selector: string;
  defaultValue: string;
}

interface WorkflowContextType {
  // Current state
  currentStep: WorkflowStep;
  setCurrentStep: (step: WorkflowStep) => void;
  
  // Results and data
  designResult: PipelineExecutionResult | null;
  setDesignResult: (result: PipelineExecutionResult | null) => void;
  
  // Error handling
  error: string | null;
  setError: (error: string | null) => void;
  
  // UI state
  showAILogs: boolean;
  setShowAILogs: (show: boolean) => void;
  
  // Download info
  downloadInfo: {url: string, fileName: string} | null;
  setDownloadInfo: (info: {url: string, fileName: string} | null) => void;
  
  // Connection status
  isLogStreamConnected: boolean;
  

  
  // File info
  originalFileName: string;
  setOriginalFileName: (fileName: string) => void;
  
  // Hybrid layout
  hybridAnalysisResult: any;
  setHybridAnalysisResult: (result: any) => void;
  uploadedImageFile: File | null;
  setUploadedImageFile: (file: File | null) => void;

  // Phase 2: generation planning
  generationPlan: GenerationPlanItem[];
  setGenerationPlan: (plan: GenerationPlanItem[]) => void;
  
  // Project management
  projectManager: ReturnType<typeof useProjectManager>;
  
  // Utility functions
  resetWorkflow: () => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  // State management
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [designResult, setDesignResult] = useState<PipelineExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAILogs, setShowAILogs] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState<{url: string, fileName: string} | null>(null);
  const [isLogStreamConnected, setIsLogStreamConnected] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string>('');
  const [hybridAnalysisResult, setHybridAnalysisResult] = useState<any>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [generationPlan, setGenerationPlan] = useState<GenerationPlanItem[]>([]);

  // Project management
  const projectManager = useProjectManager();

  // Initialize logging and connection monitoring
  useEffect(() => {
    // Initialize logging system
    aiLogger.logFlowStep('app-init', 'Templator Started', 'start');

    // Check log stream connection status
    const checkConnection = () => {
      const status = socketClient.getConnectionStatus();
      setIsLogStreamConnected(status.connected);
    };

    // Check connection status every 5 seconds
    const connectionInterval = setInterval(checkConnection, 5000);
    checkConnection(); // Initial check

    return () => {
      clearInterval(connectionInterval);
    };
  }, []);

  // Reset workflow function
  const resetWorkflow = () => {
    setCurrentStep('upload');
    setDesignResult(null);
    setError(null);
    setDownloadInfo(null);
    setOriginalFileName('');
    setHybridAnalysisResult(null);
    setUploadedImageFile(null);
    setGenerationPlan([]);
    setShowAILogs(false);
    
    aiLogger.logFlowStep('workflow-reset', 'Workflow Reset', 'complete');
  };

  const contextValue: WorkflowContextType = {
    // Current state
    currentStep,
    setCurrentStep,
    
    // Results and data
    designResult,
    setDesignResult,
    
    // Error handling
    error,
    setError,
    
    // UI state
    showAILogs,
    setShowAILogs,
    
    // Download info
    downloadInfo,
    setDownloadInfo,
    
    // Connection status
    isLogStreamConnected,
    
    // File info
    originalFileName,
    setOriginalFileName,
    
    // Hybrid layout
    hybridAnalysisResult,
    setHybridAnalysisResult,
    uploadedImageFile,
    setUploadedImageFile,

    // Phase 2: generation planning
    generationPlan,
    setGenerationPlan,
    
    // Project management
    projectManager,
    
    // Utility functions
    resetWorkflow,
  };

  return (
    <WorkflowContext.Provider value={contextValue}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}
