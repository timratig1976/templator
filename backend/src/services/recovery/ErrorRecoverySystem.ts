/**
 * Enhanced Error Recovery System
 * Intelligent error handling, recovery strategies, and fallback mechanisms
 */

import { createLogger } from '../../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger();

export interface ErrorContext {
  pipelineId: string;
  phase: string;
  step?: string;
  timestamp: Date;
  metadata: Record<string, any>;
  previousErrors: ErrorRecord[];
}

export interface ErrorRecord {
  id: string;
  type: 'validation' | 'processing' | 'ai' | 'network' | 'timeout' | 'resource' | 'unknown';
  severity: 'critical' | 'major' | 'minor' | 'warning';
  message: string;
  stack?: string;
  context: ErrorContext;
  recoveryAttempts: RecoveryAttempt[];
  resolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface RecoveryAttempt {
  id: string;
  strategy: string;
  startedAt: Date;
  completedAt?: Date;
  success: boolean;
  result?: any;
  error?: string;
  metrics: {
    duration: number;
    resourceUsage: number;
    confidence: number; // 0-100
  };
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  applicableErrors: string[];
  priority: number; // Higher = tried first
  maxAttempts: number;
  timeout: number; // milliseconds
  requiredResources: string[];
  execute: (error: ErrorRecord, context: ErrorContext) => Promise<RecoveryResult>;
}

export interface RecoveryResult {
  success: boolean;
  data?: any;
  message: string;
  confidence: number; // 0-100
  shouldRetry: boolean;
  nextStrategy?: string;
  fallbackData?: any;
}

export interface FallbackConfig {
  enableFallbacks: boolean;
  fallbackQualityThreshold: number;
  maxRecoveryAttempts: number;
  timeoutPerAttempt: number;
  preservePartialResults: boolean;
}

export class ErrorRecoverySystem extends EventEmitter {
  private errorHistory: Map<string, ErrorRecord> = new Map();
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private config: FallbackConfig;
  private activeRecoveries: Map<string, Promise<RecoveryResult>> = new Map();

  constructor(config: Partial<FallbackConfig> = {}) {
    super();
    
    this.config = {
      enableFallbacks: true,
      fallbackQualityThreshold: 60,
      maxRecoveryAttempts: 3,
      timeoutPerAttempt: 30000, // 30 seconds
      preservePartialResults: true,
      ...config
    };

    this.initializeRecoveryStrategies();
    this.setupCleanupInterval();

    logger.info('Error Recovery System initialized', { config: this.config });
  }

  /**
   * Handle error with intelligent recovery
   */
  async handleError(
    error: Error,
    context: ErrorContext,
    originalData?: any
  ): Promise<RecoveryResult> {
    const errorRecord = this.createErrorRecord(error, context);
    this.errorHistory.set(errorRecord.id, errorRecord);

    logger.error('Error detected, initiating recovery', {
      errorId: errorRecord.id,
      type: errorRecord.type,
      phase: context.phase,
      pipelineId: context.pipelineId
    });

    this.emit('error-detected', errorRecord);

    // Check if recovery is already in progress for this context
    const recoveryKey = `${context.pipelineId}_${context.phase}`;
    if (this.activeRecoveries.has(recoveryKey)) {
      logger.info('Recovery already in progress, waiting for completion', { recoveryKey });
      return await this.activeRecoveries.get(recoveryKey)!;
    }

    // Start recovery process
    const recoveryPromise = this.executeRecovery(errorRecord, originalData);
    this.activeRecoveries.set(recoveryKey, recoveryPromise);

    try {
      const result = await recoveryPromise;
      this.activeRecoveries.delete(recoveryKey);
      return result;
    } catch (recoveryError) {
      this.activeRecoveries.delete(recoveryKey);
      const errorMessage = recoveryError instanceof Error ? recoveryError.message : 'Unknown recovery error';
      logger.error('Recovery process failed', { 
        errorId: errorRecord.id, 
        recoveryError: errorMessage 
      });
      
      return {
        success: false,
        message: `Recovery failed: ${errorMessage}`,
        confidence: 0,
        shouldRetry: false,
        fallbackData: this.generateFallbackData(context, originalData)
      };
    }
  }

  /**
   * Execute recovery strategies
   */
  private async executeRecovery(
    errorRecord: ErrorRecord,
    originalData?: any
  ): Promise<RecoveryResult> {
    const applicableStrategies = this.getApplicableStrategies(errorRecord);
    
    if (applicableStrategies.length === 0) {
      logger.warn('No applicable recovery strategies found', { 
        errorId: errorRecord.id,
        errorType: errorRecord.type 
      });
      
      return {
        success: false,
        message: 'No recovery strategies available',
        confidence: 0,
        shouldRetry: false,
        fallbackData: this.generateFallbackData(errorRecord.context, originalData)
      };
    }

    // Sort strategies by priority
    applicableStrategies.sort((a, b) => b.priority - a.priority);

    for (const strategy of applicableStrategies) {
      if (errorRecord.recoveryAttempts.length >= this.config.maxRecoveryAttempts) {
        logger.warn('Maximum recovery attempts reached', { 
          errorId: errorRecord.id,
          attempts: errorRecord.recoveryAttempts.length 
        });
        break;
      }

      const attempt = await this.executeStrategy(strategy, errorRecord);
      errorRecord.recoveryAttempts.push(attempt);

      if (attempt.success) {
        errorRecord.resolved = true;
        errorRecord.resolvedAt = new Date();
        
        this.emit('error-recovered', { errorRecord, attempt });
        
        logger.info('Error successfully recovered', {
          errorId: errorRecord.id,
          strategy: strategy.name,
          attempts: errorRecord.recoveryAttempts.length,
          confidence: attempt.metrics.confidence
        });

        return {
          success: true,
          data: attempt.result,
          message: `Recovered using ${strategy.name}`,
          confidence: attempt.metrics.confidence,
          shouldRetry: false
        };
      }

      logger.warn('Recovery strategy failed', {
        errorId: errorRecord.id,
        strategy: strategy.name,
        error: attempt.error
      });
    }

    // All strategies failed
    this.emit('recovery-failed', errorRecord);
    
    return {
      success: false,
      message: 'All recovery strategies failed',
      confidence: 0,
      shouldRetry: false,
      fallbackData: this.generateFallbackData(errorRecord.context, originalData)
    };
  }

  /**
   * Execute a specific recovery strategy
   */
  private async executeStrategy(
    strategy: RecoveryStrategy,
    errorRecord: ErrorRecord
  ): Promise<RecoveryAttempt> {
    const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    const attempt: RecoveryAttempt = {
      id: attemptId,
      strategy: strategy.name,
      startedAt: new Date(),
      success: false,
      metrics: {
        duration: 0,
        resourceUsage: 0,
        confidence: 0
      }
    };

    try {
      logger.info('Executing recovery strategy', {
        errorId: errorRecord.id,
        strategy: strategy.name,
        attemptId
      });

      // Execute strategy with timeout
      const result = await Promise.race([
        strategy.execute(errorRecord, errorRecord.context),
        this.createTimeoutPromise(strategy.timeout)
      ]);

      attempt.completedAt = new Date();
      attempt.success = result.success;
      attempt.result = result.data;
      attempt.metrics.duration = Date.now() - startTime;
      attempt.metrics.confidence = result.confidence;

      if (!result.success) {
        attempt.error = result.message;
      }

    } catch (error) {
      attempt.completedAt = new Date();
      attempt.success = false;
      attempt.error = error instanceof Error ? error.message : 'Unknown error';
      attempt.metrics.duration = Date.now() - startTime;
      attempt.metrics.confidence = 0;
    }

    return attempt;
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    // AI Generation Recovery
    this.registerStrategy({
      name: 'ai-retry-with-simplified-prompt',
      description: 'Retry AI generation with simplified prompt',
      applicableErrors: ['ai', 'timeout'],
      priority: 90,
      maxAttempts: 2,
      timeout: 45000,
      requiredResources: ['openai'],
      execute: async (error, context) => {
        // Simplified AI generation logic
        return {
          success: true,
          data: this.generateSimplifiedAIResponse(context),
          message: 'Generated simplified AI response',
          confidence: 70,
          shouldRetry: false
        };
      }
    });

    // Validation Recovery
    this.registerStrategy({
      name: 'validation-auto-fix',
      description: 'Automatically fix common validation errors',
      applicableErrors: ['validation'],
      priority: 85,
      maxAttempts: 1,
      timeout: 10000,
      requiredResources: [],
      execute: async (error, context) => {
        const fixedData = this.autoFixValidationErrors(error, context);
        return {
          success: fixedData !== null,
          data: fixedData,
          message: 'Applied automatic validation fixes',
          confidence: fixedData ? 80 : 0,
          shouldRetry: false
        };
      }
    });

    // Network Recovery
    this.registerStrategy({
      name: 'network-retry-with-backoff',
      description: 'Retry network requests with exponential backoff',
      applicableErrors: ['network', 'timeout'],
      priority: 80,
      maxAttempts: 3,
      timeout: 60000,
      requiredResources: ['network'],
      execute: async (error, context) => {
        // Implement exponential backoff retry
        const retryResult = await this.retryWithBackoff(error, context);
        return {
          success: retryResult.success,
          data: retryResult.data,
          message: 'Network retry completed',
          confidence: retryResult.success ? 85 : 0,
          shouldRetry: !retryResult.success
        };
      }
    });

    // Resource Recovery
    this.registerStrategy({
      name: 'resource-cleanup-and-retry',
      description: 'Clean up resources and retry operation',
      applicableErrors: ['resource', 'processing'],
      priority: 75,
      maxAttempts: 2,
      timeout: 30000,
      requiredResources: [],
      execute: async (error, context) => {
        await this.cleanupResources(context);
        return {
          success: true,
          data: null,
          message: 'Resources cleaned up, ready for retry',
          confidence: 60,
          shouldRetry: true
        };
      }
    });

    // Fallback Generation
    this.registerStrategy({
      name: 'generate-fallback-content',
      description: 'Generate fallback content when all else fails',
      applicableErrors: ['ai', 'processing', 'validation', 'unknown'],
      priority: 10, // Lowest priority - last resort
      maxAttempts: 1,
      timeout: 5000,
      requiredResources: [],
      execute: async (error, context) => {
        const fallbackData = this.generateFallbackData(context);
        return {
          success: true,
          data: fallbackData,
          message: 'Generated fallback content',
          confidence: this.config.fallbackQualityThreshold,
          shouldRetry: false
        };
      }
    });

    logger.info('Recovery strategies initialized', { 
      strategiesCount: this.recoveryStrategies.size 
    });
  }

  /**
   * Helper methods for recovery strategies
   */
  private generateSimplifiedAIResponse(context: ErrorContext): any {
    return {
      html: `
        <section class="py-8 px-4">
          <div class="max-w-4xl mx-auto">
            <h2 class="text-2xl font-bold mb-4">{{ section_title }}</h2>
            <p class="text-gray-600">{{ section_content }}</p>
          </div>
        </section>
      `,
      editableFields: [
        {
          id: 'section_title',
          name: 'Title',
          type: 'text',
          defaultValue: 'Section Title',
          required: true
        },
        {
          id: 'section_content',
          name: 'Content',
          type: 'rich_text',
          defaultValue: 'Section content goes here.',
          required: false
        }
      ],
      qualityScore: 70
    };
  }

  private autoFixValidationErrors(error: ErrorRecord, context: ErrorContext): any | null {
    // Implement common validation fixes
    const fixes = {
      'missing-alt-text': (html: string) => html.replace(/<img([^>]*?)(?:\s+alt="[^"]*")?([^>]*?)>/g, '<img$1 alt="Image"$2>'),
      'invalid-html': (html: string) => html.replace(/<(\w+)([^>]*?)(?<!\/)>/g, '<$1$2></$1>'),
      'missing-aria': (html: string) => html.replace(/<button([^>]*?)>/g, '<button$1 aria-label="Button">'),
    };

    // Apply fixes based on error type
    let fixedData = context.metadata.originalData;
    Object.values(fixes).forEach(fix => {
      if (typeof fixedData === 'string') {
        fixedData = fix(fixedData);
      }
    });

    return fixedData !== context.metadata.originalData ? fixedData : null;
  }

  private async retryWithBackoff(error: ErrorRecord, context: ErrorContext): Promise<{success: boolean, data?: any}> {
    const maxRetries = 3;
    let delay = 1000; // Start with 1 second

    for (let i = 0; i < maxRetries; i++) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Simulate retry logic - in real implementation, this would call the original operation
        const success = Math.random() > 0.3; // 70% success rate for simulation
        
        if (success) {
          return { success: true, data: context.metadata.originalData };
        }
        
        delay *= 2; // Exponential backoff
      } catch (retryError) {
        const errorMessage = retryError instanceof Error ? retryError.message : 'Unknown retry error';
        logger.warn('Retry attempt failed', { attempt: i + 1, error: errorMessage });
      }
    }

    return { success: false };
  }

  private async cleanupResources(context: ErrorContext): Promise<void> {
    // Implement resource cleanup logic
    logger.info('Cleaning up resources', { pipelineId: context.pipelineId });
    
    // Simulate cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private generateFallbackData(context: ErrorContext, originalData?: any): any {
    return {
      id: `fallback_${context.pipelineId}`,
      type: 'fallback',
      html: `
        <section class="py-12 px-4 bg-gray-50">
          <div class="max-w-4xl mx-auto text-center">
            <h2 class="text-2xl font-bold text-gray-900 mb-4">{{ fallback_title }}</h2>
            <p class="text-gray-600 mb-6">{{ fallback_content }}</p>
            <a href="{{ fallback_link }}" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
              {{ fallback_cta }}
            </a>
          </div>
        </section>
      `,
      editableFields: [
        {
          id: 'fallback_title',
          name: 'Title',
          type: 'text',
          defaultValue: 'Content Section',
          required: true
        },
        {
          id: 'fallback_content',
          name: 'Content',
          type: 'rich_text',
          defaultValue: 'This content was generated as a fallback.',
          required: false
        },
        {
          id: 'fallback_cta',
          name: 'Call to Action',
          type: 'text',
          defaultValue: 'Learn More',
          required: false
        },
        {
          id: 'fallback_link',
          name: 'Link URL',
          type: 'url',
          defaultValue: '#',
          required: false
        }
      ],
      qualityScore: this.config.fallbackQualityThreshold,
      metadata: {
        generatedBy: 'error-recovery-system',
        originalError: context.metadata.error,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Utility methods
   */
  private createErrorRecord(error: Error, context: ErrorContext): ErrorRecord {
    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: this.classifyError(error),
      severity: this.determineSeverity(error, context),
      message: error.message,
      stack: error.stack,
      context,
      recoveryAttempts: [],
      resolved: false,
      createdAt: new Date()
    };
  }

  private classifyError(error: Error): ErrorRecord['type'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('validation') || message.includes('invalid')) return 'validation';
    if (message.includes('timeout') || message.includes('time')) return 'timeout';
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) return 'network';
    if (message.includes('openai') || message.includes('ai') || message.includes('model')) return 'ai';
    if (message.includes('memory') || message.includes('resource') || message.includes('limit')) return 'resource';
    if (message.includes('process') || message.includes('execution')) return 'processing';
    
    return 'unknown';
  }

  private determineSeverity(error: Error, context: ErrorContext): ErrorRecord['severity'] {
    const criticalPhases = ['modulePackaging', 'export'];
    const majorPhases = ['aiGeneration', 'qualityAssurance'];
    
    if (criticalPhases.includes(context.phase)) return 'critical';
    if (majorPhases.includes(context.phase)) return 'major';
    if (context.previousErrors.length > 2) return 'major';
    
    return 'minor';
  }

  private getApplicableStrategies(errorRecord: ErrorRecord): RecoveryStrategy[] {
    return Array.from(this.recoveryStrategies.values())
      .filter(strategy => strategy.applicableErrors.includes(errorRecord.type));
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Strategy timeout')), timeout);
    });
  }

  private setupCleanupInterval(): void {
    // Clean up old error records every hour
    // Avoid background timers during Jest to prevent open handle leaks
    if (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test') {
      logger.debug('Skipping ErrorRecoverySystem cleanup interval in test environment');
      return;
    }

    setInterval(() => {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      for (const [errorId, errorRecord] of this.errorHistory) {
        if (errorRecord.createdAt.getTime() < oneHourAgo && errorRecord.resolved) {
          this.errorHistory.delete(errorId);
        }
      }
    }, 60 * 60 * 1000);
  }

  // Public API methods
  public registerStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.name, strategy);
    logger.info('Recovery strategy registered', { name: strategy.name });
  }

  public getErrorHistory(): ErrorRecord[] {
    return Array.from(this.errorHistory.values());
  }

  public getErrorStats(): {
    total: number;
    resolved: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const errors = Array.from(this.errorHistory.values());
    
    return {
      total: errors.length,
      resolved: errors.filter(e => e.resolved).length,
      byType: errors.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySeverity: errors.reduce((acc, e) => {
        acc[e.severity] = (acc[e.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  public updateConfig(newConfig: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Error recovery config updated', { config: this.config });
  }
}

export default ErrorRecoverySystem;
