/**
 * AI Pipeline Types
 * Centralized type definitions for the AI pipeline system
 */

export interface AIPhaseProgress {
  phaseId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  aiConfidence?: number;
  insights?: string[];
  estimatedTimeRemaining?: number;
}

export interface SplittingSuggestion {
  id: string;
  name: string;
  type: 'header' | 'hero' | 'content' | 'footer' | 'sidebar' | 'navigation';
  bounds: {
    x: number;      // X position as percentage (0-100)
    y: number;      // Y position as percentage (0-100)
    width: number;  // Width as percentage (0-100)
    height: number; // Height as percentage (0-100)
  };
  confidence: number;
  description: string;
  suggested: boolean;
}

export interface AIAnalysisResult {
  sections: AIDetectedSection[];
  confidence: number;
  quality: number;
  enhancedAnalysis?: {
    recommendations: {
      suggestedAdjustments: string[];
      qualityScore: number;
      improvementTips: string[];
    };
    detectionMetrics: {
      averageConfidence: number;
      processingTime: number;
    };
  };
}

export interface AIDetectedSection {
  id: string;
  name: string;
  type: 'header' | 'hero' | 'content' | 'footer' | 'sidebar' | 'navigation';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  html: string;
  editableFields: any[];
  aiConfidence: number;
}

export interface AIEnhancedPipelineResult {
  sections: AIDetectedSection[];
  qualityScore: number;
  metadata: any;
  aiInsights: {
    totalProcessingTime: number;
    aiModelsUsed: string[];
    confidenceScores: Record<string, number>;
    optimizations: string[];
    qualityImprovements: string[];
  };
}

export type PhaseProgressCallback = (phases: AIPhaseProgress[]) => void;

export interface PipelineExecutionOptions {
  onPhaseProgress?: PhaseProgressCallback;
  timeout?: number;
  retryAttempts?: number;
}
