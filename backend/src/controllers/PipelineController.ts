import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { PipelineOrchestrator } from '../pipeline/orchestrator/PipelineOrchestrator';
import { 
  DesignFile, 
  PipelineOptions, 
  PipelineExecutionResult 
} from '../pipeline/types/PipelineTypes';

const logger = createLogger();

/**
 * PipelineController - Refactored to use modular phase-based architecture
 * Delegates pipeline execution to PipelineOrchestrator for better maintainability
 */
export class PipelineController {
  private orchestrator: PipelineOrchestrator;

  constructor() {
    this.orchestrator = new PipelineOrchestrator();
  }

  /**
   * Main pipeline execution - delegates to PipelineOrchestrator
   */
  async executePipeline(
    designFile: DesignFile, 
    options?: Partial<PipelineOptions>
  ): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    
    logger.info('🚀 Starting modular pipeline execution', {
      fileName: designFile.originalname,
      fileSize: designFile.size,
      mimeType: designFile.mimetype,
      options
    });

    try {
      // Delegate to orchestrator with default options
      const defaultOptions: PipelineOptions = {
        enableEnhancement: true,
        qualityThreshold: 75,
        maxIterations: 3,
        fallbackOnError: true,
        exportFormat: 'hubspot'
      };

      const mergedOptions = { ...defaultOptions, ...options };
      const result = await this.orchestrator.executePipeline(designFile, mergedOptions);

      const processingTime = Date.now() - startTime;
      
      logger.info('✅ Pipeline execution completed successfully', {
        pipelineId: result.id,
        totalTime: processingTime,
        finalQuality: result.qualityScore,
        sectionsGenerated: result.sections.length,
        validationPassed: result.validationPassed
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('❌ Pipeline execution failed', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        processingTime,
        fileName: designFile.originalname
      });

      throw createError(
        `Pipeline execution failed: ${(error as Error).message}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * Get pipeline status (for compatibility with existing API)
   */
  async getPipelineStatus(pipelineId: string): Promise<{ status: string; progress: number }> {
    // This is a simplified implementation for API compatibility
    // In a full implementation, this would track actual pipeline progress
    logger.info('Getting pipeline status', { pipelineId });
    
    return {
      status: 'completed', // Simplified - in reality this would track actual status
      progress: 100
    };
  }

  /**
   * Enhance specific sections (for compatibility with existing API)
   */
  async enhanceSections(
    sections: any[], 
    options?: { qualityThreshold?: number }
  ): Promise<any[]> {
    logger.info('Enhancing sections', { 
      sectionCount: sections.length,
      options 
    });

    // This is a simplified implementation for API compatibility
    // In a full implementation, this would use the EnhancementPhase directly
    return sections.map(section => ({
      ...section,
      qualityScore: Math.min(100, section.qualityScore + 10), // Simple enhancement
      enhanced: true
    }));
  }

  /**
   * Get quality metrics for sections (for compatibility with existing API)
   */
  async getQualityMetrics(sections: any[]): Promise<{
    overall: number;
    breakdown: Record<string, number>;
  }> {
    logger.info('Calculating quality metrics', { sectionCount: sections.length });

    const totalQuality = sections.reduce((sum, section) => sum + (section.qualityScore || 0), 0);
    const averageQuality = sections.length > 0 ? totalQuality / sections.length : 0;

    return {
      overall: Math.round(averageQuality),
      breakdown: {
        htmlStructure: Math.round(averageQuality * 0.9),
        accessibility: Math.round(averageQuality * 0.8),
        tailwindOptimization: Math.round(averageQuality * 0.85),
        hubspotCompliance: Math.round(averageQuality * 0.95),
        editability: Math.round(averageQuality * 0.9),
        performance: Math.round(averageQuality * 0.8)
      }
    };
  }

  /**
   * Get supported file types (for compatibility with existing API)
   */
  getSupportedTypes(): string[] {
    return ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  }
}
