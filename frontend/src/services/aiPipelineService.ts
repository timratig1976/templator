/**
 * AI-Enhanced Pipeline Service
 * Manages the unified AI-first design-to-code pipeline
 */

import { pipelineService, PipelineExecutionResult, PipelineStatus } from './pipelineService';
import { aiLogger } from './aiLogger';

export interface AIPhaseProgress {
  phaseId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  aiConfidence?: number;
  insights?: string[];
  estimatedTimeRemaining?: number;
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

export interface AIEnhancedPipelineResult extends PipelineExecutionResult {
  aiInsights: {
    totalProcessingTime: number;
    aiModelsUsed: string[];
    confidenceScores: Record<string, number>;
    optimizations: string[];
    qualityImprovements: string[];
  };
}

class AIEnhancedPipelineService {
  private static instance: AIEnhancedPipelineService;
  private currentPipelineId: string | null = null;
  private phaseProgressCallbacks: ((phases: AIPhaseProgress[]) => void)[] = [];

  public static getInstance(): AIEnhancedPipelineService {
    if (!AIEnhancedPipelineService.instance) {
      AIEnhancedPipelineService.instance = new AIEnhancedPipelineService();
    }
    return AIEnhancedPipelineService.instance;
  }

  /**
   * Execute the AI-first pipeline with enhanced tracking
   */
  async executeAIFirstPipeline(
    designFile: File,
    onPhaseProgress?: (phases: AIPhaseProgress[]) => void
  ): Promise<AIEnhancedPipelineResult> {
    const startTime = Date.now();
    
    // Register progress callback
    if (onPhaseProgress) {
      this.phaseProgressCallbacks.push(onPhaseProgress);
    }

    try {
      // Phase 1: Upload and Initial Processing
      await this.updatePhaseProgress('upload', 'running', 25);
      aiLogger.info('processing', 'Starting AI-first pipeline execution', { fileName: designFile.name });

      // Phase 2: AI Vision Analysis
      await this.updatePhaseProgress('upload', 'completed', 100);
      await this.updatePhaseProgress('ai-analysis', 'running', 30);
      
      const analysisResult = await this.performAIVisionAnalysis(designFile);
      
      await this.updatePhaseProgress('ai-analysis', 'completed', 100);
      
      // Phase 3: Smart Section Detection (handled by UI interaction)
      await this.updatePhaseProgress('smart-splitting', 'running', 50);
      
      // This phase will be completed when user confirms sections
      // For now, we'll simulate the pipeline execution
      const pipelineResult = await pipelineService.executePipeline(designFile);
      
      // Phase 4: AI HTML Generation
      await this.updatePhaseProgress('smart-splitting', 'completed', 100);
      await this.updatePhaseProgress('html-generation', 'running', 75);
      
      // Enhanced HTML generation with AI insights
      const enhancedResult = await this.enhanceWithAIInsights(pipelineResult, analysisResult);
      
      await this.updatePhaseProgress('html-generation', 'completed', 100);
      
      // Phase 5: Module Packaging
      await this.updatePhaseProgress('module-packaging', 'running', 90);
      
      // Add AI-enhanced module features
      const finalResult = await this.packageWithAIEnhancements(enhancedResult);
      
      await this.updatePhaseProgress('module-packaging', 'completed', 100);
      
      const totalTime = Date.now() - startTime;
      aiLogger.info('processing', 'AI-first pipeline completed successfully', { 
        totalTime,
        sectionsGenerated: finalResult.sections.length,
        qualityScore: finalResult.qualityScore
      });

      return finalResult;
      
    } catch (error) {
      aiLogger.error('processing', 'AI-first pipeline failed', error);
      throw error;
    } finally {
      // Clean up callbacks
      this.phaseProgressCallbacks = [];
    }
  }

  /**
   * Perform AI Vision Analysis using OpenAI Vision API
   */
  private async performAIVisionAnalysis(designFile: File): Promise<AIAnalysisResult> {
    try {
      aiLogger.info('processing', 'Starting AI vision analysis', { fileName: designFile.name });
      
      // Convert file to base64 for OpenAI Vision API
      const base64Image = await this.fileToBase64(designFile);
      
      // Call backend AI analysis endpoint
      const response = await fetch('/api/ai-enhancement/analyze-layout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          analysisType: 'comprehensive',
          includeConfidence: true,
          includeRecommendations: true
        }),
      });

      if (!response.ok) {
        // Try to get detailed error information from the response
        let errorMessage = `AI analysis failed: ${response.statusText}`;
        let errorDetails = '';
        let errorCode = '';
        
        try {
          const errorResponse = await response.json();
          if (errorResponse.error) {
            errorMessage = errorResponse.error;
          }
          if (errorResponse.details) {
            errorDetails = errorResponse.details;
          }
          if (errorResponse.code) {
            errorCode = errorResponse.code;
          }
          
          // Create a more informative error message
          const fullErrorMessage = errorDetails 
            ? `${errorMessage}: ${errorDetails}`
            : errorMessage;
            
          throw new Error(fullErrorMessage);
        } catch (parseError) {
          // If we can't parse the error response, fall back to generic message
          throw new Error(errorMessage);
        }
      }

      const result = await response.json();
      
      aiLogger.info('processing', 'AI vision analysis completed', {
        sectionsDetected: result.sections?.length || 0,
        confidence: result.confidence,
        processingTime: result.enhancedAnalysis?.detectionMetrics?.processingTime
      });

      return result;
      
    } catch (error) {
      aiLogger.error('processing', 'AI vision analysis failed', error);
      throw error;
    }
  }

  /**
   * Enhance pipeline result with AI insights
   */
  private async enhanceWithAIInsights(
    pipelineResult: PipelineExecutionResult,
    analysisResult: AIAnalysisResult
  ): Promise<AIEnhancedPipelineResult> {
    
    const aiInsights = {
      totalProcessingTime: analysisResult.enhancedAnalysis?.detectionMetrics?.processingTime || 0,
      aiModelsUsed: ['gpt-4-vision-preview', 'gpt-4'],
      confidenceScores: {
        layoutDetection: analysisResult.confidence,
        sectionClassification: analysisResult.enhancedAnalysis?.detectionMetrics?.averageConfidence || 0,
        htmlGeneration: pipelineResult.qualityScore
      },
      optimizations: [
        'AI-powered semantic HTML structure',
        'Intelligent section boundary detection',
        'Automated accessibility improvements',
        'Responsive design optimization'
      ],
      qualityImprovements: analysisResult.enhancedAnalysis?.recommendations?.improvementTips || []
    };

    return {
      ...pipelineResult,
      aiInsights
    };
  }

  /**
   * Package result with AI enhancements
   */
  private async packageWithAIEnhancements(
    enhancedResult: AIEnhancedPipelineResult
  ): Promise<AIEnhancedPipelineResult> {
    
    // Add AI-enhanced metadata to the packaged module
    const aiEnhancedMetadata = {
      ...enhancedResult.metadata,
      aiEnhancements: {
        visionAnalysisUsed: true,
        smartSectionDetection: true,
        qualityOptimizations: enhancedResult.aiInsights.optimizations,
        confidenceScores: enhancedResult.aiInsights.confidenceScores
      }
    };

    return {
      ...enhancedResult,
      metadata: aiEnhancedMetadata
    };
  }

  /**
   * Update phase progress and notify callbacks
   */
  private async updatePhaseProgress(
    phaseId: string,
    status: 'pending' | 'running' | 'completed' | 'failed',
    progress: number,
    insights?: string[]
  ) {
    const phases: AIPhaseProgress[] = [
      {
        phaseId: 'upload',
        name: 'Design Upload',
        status: phaseId === 'upload' ? status : (this.isPhaseCompleted('upload', phaseId) ? 'completed' : 'pending'),
        progress: phaseId === 'upload' ? progress : (this.isPhaseCompleted('upload', phaseId) ? 100 : 0)
      },
      {
        phaseId: 'ai-analysis',
        name: 'AI Vision Analysis',
        status: phaseId === 'ai-analysis' ? status : (this.isPhaseCompleted('ai-analysis', phaseId) ? 'completed' : 'pending'),
        progress: phaseId === 'ai-analysis' ? progress : (this.isPhaseCompleted('ai-analysis', phaseId) ? 100 : 0),
        insights: phaseId === 'ai-analysis' ? insights : undefined
      },
      {
        phaseId: 'smart-splitting',
        name: 'Smart Section Splitting',
        status: phaseId === 'smart-splitting' ? status : (this.isPhaseCompleted('smart-splitting', phaseId) ? 'completed' : 'pending'),
        progress: phaseId === 'smart-splitting' ? progress : (this.isPhaseCompleted('smart-splitting', phaseId) ? 100 : 0)
      },
      {
        phaseId: 'html-generation',
        name: 'AI HTML Generation',
        status: phaseId === 'html-generation' ? status : (this.isPhaseCompleted('html-generation', phaseId) ? 'completed' : 'pending'),
        progress: phaseId === 'html-generation' ? progress : (this.isPhaseCompleted('html-generation', phaseId) ? 100 : 0)
      },
      {
        phaseId: 'module-packaging',
        name: 'HubSpot Module Packaging',
        status: phaseId === 'module-packaging' ? status : 'pending',
        progress: phaseId === 'module-packaging' ? progress : 0
      }
    ];

    // Notify all registered callbacks
    this.phaseProgressCallbacks.forEach(callback => {
      try {
        callback(phases);
      } catch (error) {
        console.error('Error in phase progress callback:', error);
      }
    });

    // Small delay to allow UI updates
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Check if a phase is completed relative to current phase
   */
  private isPhaseCompleted(checkPhase: string, currentPhase: string): boolean {
    const phaseOrder = ['upload', 'ai-analysis', 'smart-splitting', 'html-generation', 'module-packaging'];
    const checkIndex = phaseOrder.indexOf(checkPhase);
    const currentIndex = phaseOrder.indexOf(currentPhase);
    return checkIndex < currentIndex;
  }

  /**
   * Convert file to base64 data URL string
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Return the complete data URL including prefix (data:image/png;base64,...)
        resolve(result);
      };
      reader.onerror = error => reject(error);
    });
  }

  /**
   * Submit feedback for AI improvement
   */
  async submitAIFeedback(
    originalSections: AIDetectedSection[],
    userAdjustedSections: AIDetectedSection[]
  ): Promise<void> {
    try {
      aiLogger.info('processing', 'Submitting AI feedback for improvement', {
        originalSections: originalSections.length,
        adjustedSections: userAdjustedSections.length
      });

      await fetch('/api/ai-enhancement/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalSections,
          userAdjustedSections,
          timestamp: new Date().toISOString()
        }),
      });

    } catch (error) {
      aiLogger.error('processing', 'Failed to submit AI feedback', error);
      // Don't throw error as this is non-critical
    }
  }

  /**
   * Get AI pipeline status
   */
  async getAIPipelineStatus(pipelineId: string): Promise<PipelineStatus> {
    return pipelineService.getPipelineStatus(pipelineId);
  }

  /**
   * Cancel AI pipeline execution
   */
  async cancelAIPipeline(pipelineId: string): Promise<void> {
    // Implementation would depend on backend support
    aiLogger.info('processing', 'AI pipeline cancellation requested', { pipelineId });
  }
}

// Export singleton instance
export const aiPipelineService = AIEnhancedPipelineService.getInstance();
export default aiPipelineService;
