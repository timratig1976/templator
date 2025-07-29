import { createLogger } from '../../utils/logger';
import { createError } from '../../middleware/errorHandler';
import { ErrorResponse } from '../../../../shared/types';

const logger = createLogger();

/**
 * Pipeline execution context shared across all phases
 */
export interface PipelineContext {
  pipelineId: string;
  timestamp: string;
  startTime: number;
  currentPhase: string;
  metadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
  };
  qualityThresholds: {
    minimum: number;
    target: number;
    excellent: number;
  };
  options: {
    enableEnhancement: boolean;
    maxIterations: number;
    fallbackOnError: boolean;
  };
}

/**
 * Standard result wrapper for all phases
 */
export interface PhaseResult<T> {
  success: boolean;
  data: T;
  phase: string;
  processingTime: number;
  qualityScore?: number;
  warnings: string[];
  metadata: Record<string, any>;
}

/**
 * Abstract base class for all pipeline phase handlers
 * Provides consistent error handling, logging, and result formatting
 */
export abstract class PhaseHandler<TInput, TOutput> {
  protected readonly phaseName: string;
  
  constructor(phaseName: string) {
    this.phaseName = phaseName;
  }

  /**
   * Execute the phase with consistent error handling and logging
   */
  async executePhase(input: TInput, context: PipelineContext): Promise<PhaseResult<TOutput>> {
    const startTime = Date.now();
    context.currentPhase = this.phaseName;
    
    this.logPhaseStart(context);
    
    try {
      const result = await this.execute(input, context);
      const processingTime = Date.now() - startTime;
      
      const phaseResult: PhaseResult<TOutput> = {
        success: true,
        data: result,
        phase: this.phaseName,
        processingTime,
        qualityScore: this.calculateQualityScore?.(result),
        warnings: this.getWarnings?.(result) || [],
        metadata: this.getMetadata?.(result, context) || {}
      };
      
      this.logPhaseSuccess(phaseResult, context);
      return phaseResult;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      return this.handlePhaseError(error as Error, processingTime, context);
    }
  }

  /**
   * Abstract method to be implemented by each phase
   */
  protected abstract execute(input: TInput, context: PipelineContext): Promise<TOutput>;

  /**
   * Optional: Calculate quality score for this phase's output
   */
  protected calculateQualityScore?(output: TOutput): number;

  /**
   * Optional: Get warnings for this phase's output
   */
  protected getWarnings?(output: TOutput): string[];

  /**
   * Optional: Get metadata for this phase's output
   */
  protected getMetadata?(output: TOutput, context: PipelineContext): Record<string, any>;

  /**
   * Handle errors consistently across all phases
   */
  protected handlePhaseError(error: Error, processingTime: number, context: PipelineContext): PhaseResult<TOutput> {
    logger.error(`❌ ${this.phaseName} failed`, {
      pipelineId: context.pipelineId,
      phase: this.phaseName,
      error: error.message,
      stack: error.stack,
      processingTime,
      fileName: context.metadata.fileName
    });

    // Check if we should attempt fallback
    if (context.options.fallbackOnError && this.createFallbackResult) {
      try {
        const fallbackResult = this.createFallbackResult(context);
        logger.warn(`⚠️ ${this.phaseName} using fallback result`, {
          pipelineId: context.pipelineId,
          phase: this.phaseName
        });
        
        return {
          success: true,
          data: fallbackResult,
          phase: this.phaseName,
          processingTime,
          warnings: [`${this.phaseName} failed, using fallback result: ${error.message}`],
          metadata: { fallbackUsed: true, originalError: error.message }
        };
      } catch (fallbackError) {
        logger.error(`❌ ${this.phaseName} fallback also failed`, {
          pipelineId: context.pipelineId,
          phase: this.phaseName,
          fallbackError: (fallbackError as Error).message
        });
      }
    }

    // Return error result
    return {
      success: false,
      data: {} as TOutput,
      phase: this.phaseName,
      processingTime,
      warnings: [],
      metadata: { error: error.message, stack: error.stack }
    };
  }

  /**
   * Optional: Create fallback result when main execution fails
   */
  protected createFallbackResult?(context: PipelineContext): TOutput;

  /**
   * Log phase start
   */
  protected logPhaseStart(context: PipelineContext): void {
    logger.info(`🚀 ${this.phaseName} started`, {
      pipelineId: context.pipelineId,
      phase: this.phaseName,
      fileName: context.metadata.fileName,
      fileSize: context.metadata.fileSize
    });
  }

  /**
   * Log phase success
   */
  protected logPhaseSuccess(result: PhaseResult<TOutput>, context: PipelineContext): void {
    logger.info(`✅ ${this.phaseName} completed`, {
      pipelineId: context.pipelineId,
      phase: this.phaseName,
      processingTime: result.processingTime,
      qualityScore: result.qualityScore,
      warningsCount: result.warnings.length,
      success: result.success
    });
  }

  /**
   * Validate input before processing
   */
  protected validateInput(input: TInput, context: PipelineContext): void {
    if (!input) {
      throw createError(`${this.phaseName} received null or undefined input`, 400, 'INPUT_INVALID');
    }
  }

  /**
   * Create error with phase context
   */
  protected createPhaseError(message: string, code: ErrorResponse['code'] = 'INTERNAL_ERROR'): Error {
    return createError(`${this.phaseName}: ${message}`, 500, code);
  }
}
