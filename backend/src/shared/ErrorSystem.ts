import { createLogger } from '../utils/logger';

const logger = createLogger();

/**
 * Standardized error codes for the application
 */
export enum ErrorCode {
  // General errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',

  // Service-specific errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SERVICE_INITIALIZATION_FAILED = 'SERVICE_INITIALIZATION_FAILED',
  SERVICE_TIMEOUT = 'SERVICE_TIMEOUT',

  // AI/OpenAI errors
  AI_API_ERROR = 'AI_API_ERROR',
  AI_QUOTA_EXCEEDED = 'AI_QUOTA_EXCEEDED',
  AI_INVALID_PROMPT = 'AI_INVALID_PROMPT',
  AI_GENERATION_FAILED = 'AI_GENERATION_FAILED',

  // File/Storage errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  STORAGE_FULL = 'STORAGE_FULL',

  // Pipeline errors
  PIPELINE_PHASE_FAILED = 'PIPELINE_PHASE_FAILED',
  PIPELINE_VALIDATION_FAILED = 'PIPELINE_VALIDATION_FAILED',
  PIPELINE_TIMEOUT = 'PIPELINE_TIMEOUT',

  // HubSpot errors
  HUBSPOT_API_ERROR = 'HUBSPOT_API_ERROR',
  HUBSPOT_VALIDATION_FAILED = 'HUBSPOT_VALIDATION_FAILED',
  HUBSPOT_DEPLOYMENT_FAILED = 'HUBSPOT_DEPLOYMENT_FAILED',

  // Quality/Validation errors
  QUALITY_CHECK_FAILED = 'QUALITY_CHECK_FAILED',
  HTML_VALIDATION_FAILED = 'HTML_VALIDATION_FAILED',
  ACCESSIBILITY_VALIDATION_FAILED = 'ACCESSIBILITY_VALIDATION_FAILED'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Enhanced application error with standardized structure
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly severity: ErrorSeverity;
  public readonly context: Record<string, any>;
  public readonly suggestion?: string;
  public readonly retryable: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: Record<string, any> = {},
    suggestion?: string,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.severity = severity;
    this.context = context;
    this.suggestion = suggestion;
    this.retryable = retryable;
    this.timestamp = new Date();

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Record<string, any> {
    return {
      success: false,
      error: this.message,
      code: this.code,
      severity: this.severity,
      context: this.context,
      suggestion: this.suggestion,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString()
    };
  }

  /**
   * Create error for logging with full context
   */
  toLogEntry(): Record<string, any> {
    return {
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      severity: this.severity,
      context: this.context,
      suggestion: this.suggestion,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

/**
 * Error factory for creating standardized errors
 */
export class ErrorFactory {
  /**
   * Create validation error
   */
  static validation(message: string, context: Record<string, any> = {}): AppError {
    return new AppError(
      message,
      ErrorCode.VALIDATION_ERROR,
      400,
      ErrorSeverity.MEDIUM,
      context,
      'Please check your input and try again'
    );
  }

  /**
   * Create not found error
   */
  static notFound(resource: string, id?: string): AppError {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    return new AppError(
      message,
      ErrorCode.NOT_FOUND,
      404,
      ErrorSeverity.LOW,
      { resource, id }
    );
  }

  /**
   * Create service unavailable error
   */
  static serviceUnavailable(serviceName: string, reason?: string): AppError {
    const message = `${serviceName} is currently unavailable${reason ? `: ${reason}` : ''}`;
    return new AppError(
      message,
      ErrorCode.SERVICE_UNAVAILABLE,
      503,
      ErrorSeverity.HIGH,
      { serviceName, reason },
      'Please try again later',
      true
    );
  }

  /**
   * Create AI API error
   */
  static aiError(message: string, context: Record<string, any> = {}): AppError {
    return new AppError(
      `AI service error: ${message}`,
      ErrorCode.AI_API_ERROR,
      502,
      ErrorSeverity.HIGH,
      context,
      'The AI service may be temporarily unavailable. Please try again.',
      true
    );
  }

  /**
   * Create file operation error
   */
  static fileError(operation: string, filePath: string, originalError?: Error): AppError {
    return new AppError(
      `File ${operation} failed: ${filePath}`,
      ErrorCode.FILE_READ_ERROR,
      500,
      ErrorSeverity.MEDIUM,
      { operation, filePath, originalError: originalError?.message },
      'Please check file permissions and try again'
    );
  }

  /**
   * Create pipeline error
   */
  static pipelineError(phase: string, message: string, context: Record<string, any> = {}): AppError {
    return new AppError(
      `Pipeline ${phase} failed: ${message}`,
      ErrorCode.PIPELINE_PHASE_FAILED,
      500,
      ErrorSeverity.HIGH,
      { phase, ...context },
      'Please check the pipeline configuration and input data'
    );
  }

  /**
   * Create HubSpot error
   */
  static hubspotError(operation: string, message: string, context: Record<string, any> = {}): AppError {
    return new AppError(
      `HubSpot ${operation} error: ${message}`,
      ErrorCode.HUBSPOT_API_ERROR,
      502,
      ErrorSeverity.HIGH,
      { operation, ...context },
      'Please check your HubSpot configuration and try again',
      true
    );
  }

  /**
   * Create quality check error
   */
  static qualityError(checkType: string, issues: string[], context: Record<string, any> = {}): AppError {
    return new AppError(
      `Quality check failed: ${checkType}`,
      ErrorCode.QUALITY_CHECK_FAILED,
      422,
      ErrorSeverity.MEDIUM,
      { checkType, issues, ...context },
      'Please review and fix the quality issues before proceeding'
    );
  }
}

/**
 * Error handler utility for consistent error processing
 */
export class ErrorHandler {
  /**
   * Handle and log error with context
   */
  static handle(error: Error, context: Record<string, any> = {}): AppError {
    // If it's already an AppError, just add context and log
    if (error instanceof AppError) {
      const enhancedError = new AppError(
        error.message,
        error.code,
        error.statusCode,
        error.severity,
        { ...error.context, ...context },
        error.suggestion,
        error.retryable
      );
      
      logger.error('Application error occurred', enhancedError.toLogEntry());
      return enhancedError;
    }

    // Convert regular Error to AppError
    const appError = new AppError(
      error.message,
      ErrorCode.INTERNAL_ERROR,
      500,
      ErrorSeverity.HIGH,
      { originalError: error.name, stack: error.stack, ...context },
      'An unexpected error occurred. Please try again or contact support.'
    );

    logger.error('Unexpected error occurred', appError.toLogEntry());
    return appError;
  }

  /**
   * Handle async operation with error wrapping
   */
  static async handleAsync<T>(
    operation: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw ErrorHandler.handle(error as Error, context);
    }
  }

  /**
   * Create error response for Express middleware
   */
  static createErrorResponse(error: AppError): {
    statusCode: number;
    body: Record<string, any>;
  } {
    return {
      statusCode: error.statusCode,
      body: error.toJSON()
    };
  }
}

/**
 * Retry utility for handling retryable errors
 */
export class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
    backoffMultiplier: number = 2
  ): Promise<T> {
    let lastError: Error;
    let delay = delayMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if it's not a retryable error
        if (error instanceof AppError && !error.retryable) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        logger.warn(`Operation failed, retrying in ${delay}ms`, {
          attempt,
          maxRetries,
          error: (error as Error).message
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
      }
    }

    throw lastError!;
  }
}

/**
 * Circuit breaker for handling cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly timeoutMs: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = 'half-open';
      } else {
        throw ErrorFactory.serviceUnavailable('Circuit breaker', 'Service temporarily unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}
