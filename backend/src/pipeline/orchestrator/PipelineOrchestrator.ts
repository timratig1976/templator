import { PipelineContext, PhaseResult } from '../base/PhaseHandler';
import { InputProcessingPhase } from '../phases/InputProcessingPhase';
import { AIGenerationPhase } from '../phases/AIGenerationPhase';
import { QualityAssurancePhase } from '../phases/QualityAssurancePhase';
import { EnhancementPhase } from '../phases/EnhancementPhase';
import { ModulePackagingPhase } from '../phases/ModulePackagingPhase';
import { 
  DesignFile, 
  PipelineExecutionResult, 
  PipelineOptions
} from '../types/PipelineTypes';
import { ErrorResponse } from '../../../../shared/types';
import { createLogger } from '../../utils/logger';
import { createError } from '../../middleware/errorHandler';

const logger = createLogger();

/**
 * Pipeline Orchestrator - Coordinates the execution of all 5 phases
 * Provides centralized error handling, progress tracking, and result aggregation
 */
export class PipelineOrchestrator {
  private phases: {
    inputProcessing: InputProcessingPhase;
    aiGeneration: AIGenerationPhase;
    qualityAssurance: QualityAssurancePhase;
    enhancement: EnhancementPhase;
    modulePackaging: ModulePackagingPhase;
  };

  constructor() {
    this.phases = {
      inputProcessing: new InputProcessingPhase(),
      aiGeneration: new AIGenerationPhase(),
      qualityAssurance: new QualityAssurancePhase(),
      enhancement: new EnhancementPhase(),
      modulePackaging: new ModulePackagingPhase()
    };
  }

  /**
   * Execute the complete 5-phase pipeline
   */
  async executePipeline(
    designFile: DesignFile,
    options: PipelineOptions = this.getDefaultOptions()
  ): Promise<PipelineExecutionResult> {
    const pipelineId = this.generatePipelineId();
    const startTime = Date.now();
    const phaseTimes: Record<string, number> = {};

    logger.info('Starting pipeline execution', {
      pipelineId,
      fileName: designFile.originalname,
      fileSize: designFile.size,
      options
    });

    try {
      // Create pipeline context
      const context: PipelineContext = {
        pipelineId,
        timestamp: new Date().toISOString(),
        startTime,
        currentPhase: 'initialization',
        metadata: {
          fileName: designFile.originalname,
          fileSize: designFile.size,
          mimeType: designFile.mimetype
        },
        qualityThresholds: {
          minimum: options.qualityThreshold || 0.6,
          target: 0.8,
          excellent: 0.9
        },
        options: {
          enableEnhancement: options.enableEnhancement || true,
          maxIterations: options.maxIterations || 3,
          fallbackOnError: options.fallbackOnError || true
        }
      };

      // Phase 1: Input Processing & Upload
      const phase1Result = await this.executePhase(
        'inputProcessing',
        this.phases.inputProcessing,
        designFile,
        context,
        phaseTimes
      );

      // Phase 2: AI-Powered HTML Generation
      const phase2Result = await this.executePhase(
        'aiGeneration',
        this.phases.aiGeneration,
        phase1Result.data,
        context,
        phaseTimes
      );

      // Phase 3: Quality Assurance & Validation
      const phase3Result = await this.executePhase(
        'qualityAssurance',
        this.phases.qualityAssurance,
        phase2Result.data,
        context,
        phaseTimes
      );

      // Phase 4: Enhancement & Optimization (conditional)
      let phase4Result = phase3Result;
      if (options.enableEnhancement && (phase3Result.data as any).qualityMetrics.overall < options.qualityThreshold) {
        phase4Result = await this.executePhase(
          'enhancement',
          this.phases.enhancement,
          phase3Result.data,
          context,
          phaseTimes
        );
      } else {
        logger.info('Skipping enhancement phase - quality threshold met or enhancement disabled', {
          pipelineId,
          currentQuality: (phase3Result.data as any).qualityMetrics.overall,
          threshold: options.qualityThreshold,
          enhancementEnabled: options.enableEnhancement
        });
        
        // Convert validated sections to enhanced sections format
        phase4Result = {
          ...phase3Result,
          data: {
            sections: (phase3Result.data as any).sections.map((section: any) => ({
              ...section,
              enhancements: {
                applied: [],
                qualityImprovement: 0,
                iterationsUsed: 0
              },
              finalHtml: section.html,
              finalQuality: section.qualityScore
            })),
            enhancementsApplied: [],
            finalQuality: (phase3Result.data as any).qualityMetrics.overall,
            iterationsPerformed: 0
          }
        };
      }

      // Phase 5: Module Packaging & Export
      const phase5Result = await this.executePhase(
        'modulePackaging',
        this.phases.modulePackaging,
        phase4Result.data,
        context,
        phaseTimes
      );

      const totalProcessingTime = Date.now() - startTime;
      
      // Aggregate results
      const result: PipelineExecutionResult = {
        id: pipelineId,
        sections: (phase4Result.data as any).sections,
        qualityScore: (phase4Result.data as any).finalQuality,
        processingTime: totalProcessingTime,
        validationPassed: (phase3Result.data as any).overallValidation.isValid,
        enhancementsApplied: (phase4Result.data as any).enhancementsApplied || [],
        packagedModule: phase5Result.data as any,
        metadata: {
          phaseTimes,
          totalSections: (phase4Result.data as any).sections.length,
          averageQuality: (phase4Result.data as any).finalQuality,
          warningsCount: this.countTotalWarnings([phase1Result, phase2Result, phase3Result, phase4Result, phase5Result]),
          timestamp: new Date().toISOString()
        }
      };

      logger.info('Pipeline execution completed successfully', {
        pipelineId,
        totalTime: totalProcessingTime,
        finalQuality: result.qualityScore,
        sectionsGenerated: result.sections.length,
        validationPassed: result.validationPassed
      });

      return result;

    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;
      
      logger.error('Pipeline execution failed', {
        pipelineId,
        error: (error as Error).message,
        stack: (error as Error).stack,
        processingTime: totalProcessingTime,
        phaseTimes
      });

      // Create fallback result for failed pipeline
      return this.createFallbackResult(pipelineId, error as Error, totalProcessingTime, phaseTimes);
    }
  }

  /**
   * Execute a single phase with error handling and timing
   */
  private async executePhase<TInput, TOutput>(
    phaseName: string,
    phaseHandler: any,
    input: TInput,
    context: PipelineContext,
    phaseTimes: Record<string, number>
  ): Promise<PhaseResult<TOutput>> {
    const phaseStartTime = Date.now();
    
    try {
      logger.info(`Starting phase: ${phaseName}`, {
        pipelineId: context.pipelineId,
        phase: phaseName
      });

      const result = await phaseHandler.executePhase(input, context);
      const phaseTime = Date.now() - phaseStartTime;
      phaseTimes[phaseName] = phaseTime;

      logger.info(`Phase completed: ${phaseName}`, {
        pipelineId: context.pipelineId,
        phase: phaseName,
        success: result.success,
        quality: result.qualityScore,
        warnings: result.warnings.length,
        processingTime: phaseTime
      });

      return result;

    } catch (error) {
      const phaseTime = Date.now() - phaseStartTime;
      phaseTimes[phaseName] = phaseTime;

      logger.error(`Phase failed: ${phaseName}`, {
        pipelineId: context.pipelineId,
        phase: phaseName,
        error: (error as Error).message,
        processingTime: phaseTime
      });

      // Determine if we should use fallback or fail completely
      if (context.options?.fallbackOnError) {
        logger.warn(`Using fallback for failed phase: ${phaseName}`, {
          pipelineId: context.pipelineId
        });
        
        return phaseHandler.createFallbackPhaseResult(context);
      }

      // Re-throw with pipeline context
      throw this.createPipelineError(
        `Phase ${phaseName} failed: ${(error as Error).message}`,
        this.getPhaseErrorCode(phaseName),
        context.pipelineId,
        { phase: phaseName, originalError: (error as Error).message }
      );
    }
  }

  /**
   * Generate unique pipeline ID
   */
  private generatePipelineId(): string {
    return `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default pipeline options
   */
  private getDefaultOptions(): PipelineOptions {
    return {
      enableEnhancement: true,
      qualityThreshold: 75,
      maxIterations: 3,
      fallbackOnError: true,
      exportFormat: 'hubspot'
    };
  }

  /**
   * Count total warnings across all phase results
   */
  private countTotalWarnings(phaseResults: PhaseResult<any>[]): number {
    return phaseResults.reduce((total, result) => total + result.warnings.length, 0);
  }

  /**
   * Get appropriate error code for a phase
   */
  private getPhaseErrorCode(phaseName: string): ErrorResponse['code'] {
    const errorCodes: Record<string, ErrorResponse['code']> = {
      inputProcessing: 'PHASE1_ERROR',
      aiGeneration: 'PHASE2_ERROR',
      qualityAssurance: 'PHASE3_ERROR',
      enhancement: 'PHASE4_ERROR',
      modulePackaging: 'PHASE5_ERROR'
    };

    return errorCodes[phaseName] || 'INTERNAL_ERROR';
  }

  /**
   * Create pipeline-specific error
   */
  private createPipelineError(
    message: string,
    code: ErrorResponse['code'],
    pipelineId?: string,
    context?: Record<string, any>
  ): Error {
    const error = createError(message, 500, code);
    // Add pipeline-specific properties
    (error as any).pipelineId = pipelineId;
    (error as any).recoverable = code !== 'INTERNAL_ERROR';
    (error as any).context = context;
    return error;
  }

  /**
   * Create fallback result when pipeline fails completely
   */
  private createFallbackResult(
    pipelineId: string,
    error: Error,
    processingTime: number,
    phaseTimes: Record<string, number>
  ): PipelineExecutionResult {
    logger.warn('Creating fallback pipeline result', {
      pipelineId,
      error: error.message
    });

    return {
      id: pipelineId,
      sections: [{
        id: 'fallback_section',
        name: 'Fallback Section',
        type: 'content',
        html: this.getFallbackHTML(),
        editableFields: this.getFallbackFields(),
        qualityScore: 30,
        issues: [{
          type: 'error',
          category: 'html',
          message: `Pipeline failed: ${error.message}`,
          severity: 'critical',
          fixable: false
        }],
        validationResult: {
          isValid: false,
          errors: [],
          warnings: [],
          suggestions: ['Manual review required due to pipeline failure'],
          complianceScore: 0
        },
        qualityMetrics: {
          htmlStructure: 25,
          accessibility: 25,
          tailwindUsage: 25,
          hubspotCompliance: 25
        },
        enhancements: {
          applied: [],
          qualityImprovement: 0,
          iterationsUsed: 0
        },
        finalHtml: this.getFallbackHTML(),
        finalQuality: 30
      }],
      qualityScore: 30,
      processingTime,
      validationPassed: false,
      enhancementsApplied: [],
      packagedModule: {
        moduleId: `fallback_${pipelineId}`,
        packageResult: {
          package_id: `fallback_${pipelineId}`,
          success: false,
          message: 'Fallback packaging due to pipeline failure'
        },
        finalHTML: this.getFallbackHTML(),
        metadata: {
          name: `Fallback Module ${pipelineId}`,
          version: '1.0.0',
          description: 'Fallback module created due to pipeline failure',
          author: 'Templator AI Pipeline (Fallback)',
          created: new Date().toISOString(),
          totalSections: 1,
          averageQuality: 30,
          processingTime,
          aiModelsUsed: ['fallback']
        },
        exportFormat: 'hubspot'
      },
      metadata: {
        phaseTimes,
        totalSections: 1,
        averageQuality: 30,
        warningsCount: 1,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Get fallback HTML for failed pipeline
   */
  private getFallbackHTML(): string {
    return `
<section class="py-12 px-4 bg-gray-50">
  <div class="max-w-4xl mx-auto text-center">
    <h2 class="text-3xl font-bold text-gray-900 mb-6">{{ fallback_title }}</h2>
    <div class="prose max-w-none mx-auto">
      <p class="text-gray-600">{{ fallback_content }}</p>
    </div>
    <div class="mt-8">
      <a href="{{ fallback_cta_url }}" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
        {{ fallback_cta_text }}
      </a>
    </div>
  </div>
</section>
    `.trim();
  }

  /**
   * Get fallback editable fields
   */
  private getFallbackFields(): any[] {
    return [
      {
        id: 'fallback_title',
        name: 'Title',
        type: 'text',
        selector: 'h2',
        defaultValue: 'Fallback Content',
        required: true
      },
      {
        id: 'fallback_content',
        name: 'Content',
        type: 'rich_text',
        selector: '.prose p',
        defaultValue: 'This content was generated as a fallback due to processing errors.',
        required: false
      },
      {
        id: 'fallback_cta_text',
        name: 'CTA Text',
        type: 'text',
        selector: 'a',
        defaultValue: 'Learn More',
        required: false
      },
      {
        id: 'fallback_cta_url',
        name: 'CTA URL',
        type: 'url',
        selector: 'a',
        defaultValue: '#',
        required: false
      }
    ];
  }
}
