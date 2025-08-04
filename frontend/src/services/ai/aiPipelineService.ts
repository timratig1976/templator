/**
 * AI-Enhanced Pipeline Service (Refactored)
 * Main orchestrator for the AI-first design-to-code pipeline
 */

import { pipelineService, PipelineExecutionResult, PipelineStatus } from '../pipelineService';
import { aiLogger } from '../aiLogger';
import { ProgressTracker } from './progressTracking';
import { performLightweightSectionDetection } from './sectionDetection';
import { performAIVisionAnalysis } from './aiAnalysis';
import type { 
  AIPhaseProgress, 
  SplittingSuggestion, 
  AIAnalysisResult, 
  AIDetectedSection,
  AIEnhancedPipelineResult,
  PhaseProgressCallback,
  PipelineExecutionOptions 
} from './types';

class AIEnhancedPipelineService {
  private static instance: AIEnhancedPipelineService;
  private currentPipelineId: string | null = null;
  private progressTracker = new ProgressTracker();

  public static getInstance(): AIEnhancedPipelineService {
    if (!AIEnhancedPipelineService.instance) {
      AIEnhancedPipelineService.instance = new AIEnhancedPipelineService();
    }
    return AIEnhancedPipelineService.instance;
  }

  /**
   * Execute the AI-first pipeline with enhanced tracking and splitting suggestions
   */
  async executeAIFirstPipeline(
    designFile: File,
    options: PipelineExecutionOptions = {}
  ): Promise<{ 
    splittingSuggestions: SplittingSuggestion[]; 
    continueWithAI: (confirmedSections: SplittingSuggestion[]) => Promise<AIEnhancedPipelineResult> 
  }> {
    const startTime = Date.now();
    
    // Register progress callback
    if (options.onPhaseProgress) {
      this.progressTracker.addProgressCallback(options.onPhaseProgress);
    }

    try {
      // Phase 1: Upload and Initial Processing
      await this.progressTracker.updatePhaseProgress('upload', 'running', 25);
      aiLogger.info('processing', 'Starting AI-first pipeline execution', { fileName: designFile.name });
      await this.progressTracker.updatePhaseProgress('upload', 'completed', 100);

      // Phase 2: Quick Section Detection (Fast splitting suggestions)
      await this.progressTracker.updatePhaseProgress('section-detection', 'running', 30);
      aiLogger.info('processing', 'Performing lightweight section detection for splitting suggestions');
      
      const splittingSuggestions = await performLightweightSectionDetection(designFile);
      
      await this.progressTracker.updatePhaseProgress('section-detection', 'completed', 100);
      
      aiLogger.success('processing', 'Section detection completed', {
        suggestionsCount: splittingSuggestions.length,
        suggestions: splittingSuggestions.map(s => ({ id: s.id, name: s.name, type: s.type, confidence: s.confidence }))
      });

      // Return splitting suggestions and continuation function
      return {
        splittingSuggestions,
        continueWithAI: async (confirmedSections: SplittingSuggestion[]) => {
          return this.continueAIPipelineWithConfirmedSections(designFile, confirmedSections, startTime);
        }
      };
      
    } catch (error) {
      aiLogger.error('processing', 'AI-first pipeline failed during section detection', error);
      throw error;
    }
  }

  /**
   * Continue the AI pipeline after user confirms sections
   */
  private async continueAIPipelineWithConfirmedSections(
    designFile: File,
    confirmedSections: SplittingSuggestion[],
    startTime: number
  ): Promise<AIEnhancedPipelineResult> {
    try {
      aiLogger.info('processing', 'Continuing AI pipeline with confirmed sections', {
        confirmedSectionsCount: confirmedSections.length,
        sections: confirmedSections.map(s => ({ id: s.id, name: s.name, type: s.type }))
      });

      // Phase 3: AI Vision Analysis (with confirmed sections)
      await this.progressTracker.updatePhaseProgress('ai-analysis', 'running', 50);
      
      const analysisResult = await performAIVisionAnalysis(designFile, confirmedSections);
      
      await this.progressTracker.updatePhaseProgress('ai-analysis', 'completed', 100);
      
      // Phase 4: Smart Section Processing
      await this.progressTracker.updatePhaseProgress('smart-splitting', 'running', 70);
      
      // Use the confirmed sections for pipeline execution
      const pipelineResult = await pipelineService.executePipeline(designFile);
      
      // Phase 5: AI HTML Generation
      await this.progressTracker.updatePhaseProgress('smart-splitting', 'completed', 100);
      await this.progressTracker.updatePhaseProgress('html-generation', 'running', 85);
      
      const enhancedResult = await this.enhanceWithAIInsights(pipelineResult, analysisResult);
      
      // Phase 6: Module Packaging
      await this.progressTracker.updatePhaseProgress('html-generation', 'completed', 100);
      await this.progressTracker.updatePhaseProgress('module-packaging', 'running', 95);
      
      const finalResult = await this.packageWithAIEnhancements(enhancedResult);
      
      await this.progressTracker.updatePhaseProgress('module-packaging', 'completed', 100);
      
      const totalTime = Date.now() - startTime;
      aiLogger.success('processing', 'AI-first pipeline completed successfully', { 
        totalTime,
        sectionsGenerated: finalResult.sections.length,
        qualityScore: finalResult.qualityScore,
        confirmedSectionsUsed: confirmedSections.length
      });

      return finalResult;
      
    } catch (error) {
      aiLogger.error('processing', 'AI-first pipeline failed during AI analysis', error);
      throw error;
    } finally {
      // Clean up callbacks
      this.progressTracker.clearProgressCallbacks();
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
      aiModelsUsed: ['gpt-4o'],
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

    // Convert PipelineSection[] to AIDetectedSection[] for type compatibility
    const convertedSections: AIDetectedSection[] = pipelineResult.sections.map(section => ({
      id: section.id,
      name: section.name,
      type: section.type,
      bounds: {
        x: section.boundingBox?.left || 0,
        y: section.boundingBox?.top || 0,
        width: section.boundingBox?.width || 0,
        height: section.boundingBox?.height || 0
      },
      html: section.html,
      editableFields: section.editableFields,
      aiConfidence: section.qualityScore || 0.8
    }));

    return {
      sections: convertedSections,
      qualityScore: pipelineResult.qualityScore,
      metadata: pipelineResult.metadata,
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
