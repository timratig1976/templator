# 🚀 Application Foundation Blueprint
## Error Handling, Logging, API Design & Configuration Management

*Comprehensive application foundation covering global error handling, structured logging, RESTful API design, and configuration management. Essential patterns for production-ready applications.*

---

## 🎯 **Foundation Principles**

### **Core Components**
- **Global Error Handling**: Centralized error management across all layers
- **Structured Logging**: Correlation IDs, log levels, and structured data
- **RESTful API Design**: Consistent endpoints, status codes, and documentation
- **Configuration Management**: Environment variables, secrets, and feature flags
- **Request/Response Patterns**: Validation, serialization, and standardization

### **Quality Standards**
- **Consistent Error Responses**: Standardized error format across all endpoints
- **Comprehensive Logging**: Request tracking, performance metrics, error details
- **API Documentation**: Auto-generated OpenAPI specs with examples
- **Type Safety**: Full TypeScript coverage for requests and responses
- **Security First**: Input validation, sanitization, and secure defaults

---

## 🚨 **Global Error Handling System**

### **Custom Error Classes**
```typescript
// src/shared/errors/BaseError.ts
export abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;
  abstract readonly errorCode: string;

  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      context: this.context,
      stack: this.stack
    };
  }
}

// Domain-specific error classes
export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly isOperational = true;
  readonly errorCode = 'VALIDATION_ERROR';

  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any
  ) {
    super(message, { field, value });
  }
}

export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly isOperational = true;
  readonly errorCode = 'NOT_FOUND';

  constructor(resource: string, id?: string) {
    super(`${resource} not found${id ? ` with id: ${id}` : ''}`);
  }
}

export class UnauthorizedError extends BaseError {
  readonly statusCode = 401;
  readonly isOperational = true;
  readonly errorCode = 'UNAUTHORIZED';

  constructor(message = 'Authentication required') {
    super(message);
  }
}

export class ForbiddenError extends BaseError {
  readonly statusCode = 403;
  readonly isOperational = true;
  readonly errorCode = 'FORBIDDEN';

  constructor(message = 'Insufficient permissions') {
    super(message);
  }
}

export class ConflictError extends BaseError {
  readonly statusCode = 409;
  readonly isOperational = true;
  readonly errorCode = 'CONFLICT';

  constructor(message: string, conflictingField?: string) {
    super(message, { conflictingField });
  }
}

export class RateLimitError extends BaseError {
  readonly statusCode = 429;
  readonly isOperational = true;
  readonly errorCode = 'RATE_LIMIT_EXCEEDED';

  constructor(public readonly retryAfter: number) {
    super('Rate limit exceeded');
  }
}

export class ExternalServiceError extends BaseError {
  readonly statusCode = 502;
  readonly isOperational = true;
  readonly errorCode = 'EXTERNAL_SERVICE_ERROR';

  constructor(
    service: string,
    originalError?: Error
  ) {
    super(`External service error: ${service}`);
    this.context = { service, originalError: originalError?.message };
  }
}
```

### **Global Error Handler Middleware**
```typescript
// src/middleware/errorHandler.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { BaseError } from '../shared/errors/BaseError';
import { Logger } from '../services/Logger.service';
import { v4 as uuidv4 } from 'uuid';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    requestId: string;
    timestamp: string;
  };
}

export class ErrorHandlerMiddleware {
  constructor(private readonly logger: Logger) {}

  handle = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    const timestamp = new Date().toISOString();

    // Log error with context
    this.logError(error, req, requestId);

    // Handle known application errors
    if (error instanceof BaseError) {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          details: error.context,
          requestId,
          timestamp
        }
      };

      // Add retry-after header for rate limiting
      if (error instanceof RateLimitError) {
        res.set('Retry-After', error.retryAfter.toString());
      }

      res.status(error.statusCode).json(response);
      return;
    }

    // Handle validation errors (Joi, Zod, etc.)
    if (error.name === 'ValidationError') {
      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: this.extractValidationDetails(error),
          requestId,
          timestamp
        }
      };

      res.status(400).json(response);
      return;
    }

    // Handle unexpected errors
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production' 
          ? 'An unexpected error occurred' 
          : error.message,
        requestId,
        timestamp
      }
    };

    res.status(500).json(response);
  };

  private logError(error: Error, req: Request, requestId: string): void {
    const errorContext = {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.id,
      body: req.method !== 'GET' ? req.body : undefined,
      query: req.query,
      params: req.params
    };

    if (error instanceof BaseError) {
      if (error.statusCode >= 500) {
        this.logger.error('Application error', {
          error: error.toJSON(),
          context: errorContext
        });
      } else {
        this.logger.warn('Client error', {
          error: error.toJSON(),
          context: errorContext
        });
      }
    } else {
      this.logger.error('Unexpected error', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context: errorContext
      });
    }
  }

  private extractValidationDetails(error: any): any {
    // Handle different validation library formats
    if (error.details) {
      // Joi validation error
      return error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
    }

    if (error.errors) {
      // Zod validation error
      return error.errors.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message,
        value: err.received
      }));
    }

    return error.message;
  }
}

// Usage in Express app
export const setupErrorHandling = (app: Express, logger: Logger) => {
  const errorHandler = new ErrorHandlerMiddleware(logger);
  
  // Catch 404 errors
  app.use('*', (req, res, next) => {
    next(new NotFoundError('Route', req.originalUrl));
  });

  // Global error handler (must be last)
  app.use(errorHandler.handle);
};
```

---

## 📊 **Structured Logging System**

### **Logger Service Implementation**
```typescript
// src/services/Logger.service.ts
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface LogContext {
  requestId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  duration?: number;
  [key: string]: any;
}

export class Logger {
  private winston: winston.Logger;

  constructor() {
    this.winston = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            ...meta
          });
        })
      ),
      defaultMeta: {
        service: process.env.SERVICE_NAME || 'templator-api',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      transports: [
        new winston.transports.Console({
          format: process.env.NODE_ENV === 'development'
            ? winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
              )
            : winston.format.json()
        })
      ]
    });

    // Add file transport in production
    if (process.env.NODE_ENV === 'production') {
      this.winston.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error'
      }));
      this.winston.add(new winston.transports.File({
        filename: 'logs/combined.log'
      }));
    }
  }

  info(message: string, context?: LogContext): void {
    this.winston.info(message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.winston.warn(message, context);
  }

  error(message: string, context?: LogContext): void {
    this.winston.error(message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.winston.debug(message, context);
  }

  // Specialized logging methods
  logRequest(req: any, res: any, duration: number): void {
    const context: LogContext = {
      requestId: req.headers['x-request-id'],
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    };

    if (res.statusCode >= 400) {
      this.warn('HTTP request completed with error', context);
    } else {
      this.info('HTTP request completed', context);
    }
  }

  logDatabaseQuery(query: string, duration: number, context?: LogContext): void {
    this.debug('Database query executed', {
      query: query.substring(0, 500), // Truncate long queries
      duration,
      ...context
    });
  }

  logExternalApiCall(
    service: string,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const logContext: LogContext = {
      service,
      endpoint,
      method,
      statusCode,
      duration,
      ...context
    };

    if (statusCode >= 400) {
      this.warn('External API call failed', logContext);
    } else {
      this.info('External API call completed', logContext);
    }
  }

  logBusinessEvent(event: string, context?: LogContext): void {
    this.info('Business event', {
      event,
      ...context
    });
  }

  logPerformanceMetric(metric: string, value: number, unit: string, context?: LogContext): void {
    this.info('Performance metric', {
      metric,
      value,
      unit,
      ...context
    });
  }
}

// Request correlation middleware
export const correlationMiddleware = (req: any, res: any, next: any) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  res.set('X-Request-ID', requestId);
  next();
};

// Request logging middleware
export const requestLoggingMiddleware = (logger: Logger) => {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.logRequest(req, res, duration);
    });

    next();
  };
};
```

---

## 📡 **RESTful API Design Patterns**

### **API Response Standardization**
```typescript
// src/shared/types/ApiResponse.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    version: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Response builder utility
export class ResponseBuilder {
  static success<T>(
    data: T,
    requestId: string,
    pagination?: ApiResponse['pagination']
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0.0'
      },
      pagination
    };
  }

  static error(
    code: string,
    message: string,
    requestId: string,
    details?: any
  ): ApiResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0.0'
      }
    };
  }

  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    requestId: string
  ): ApiResponse<T[]> {
    const totalPages = Math.ceil(total / limit);
    
    return {
      success: true,
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0.0'
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }
}
```

### **Input Validation with Zod**
```typescript
// src/shared/validation/schemas.ts
import { z } from 'zod';

// Common validation schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const IdParamSchema = z.object({
  id: z.string().min(1, 'ID is required')
});

// User validation schemas
export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number')
});

export const UpdateUserSchema = CreateUserSchema.partial();

// Project validation schemas
export const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  isPublic: z.boolean().default(false),
  templateId: z.string().optional()
});

// Validation middleware
export const validateBody = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError('Invalid request body');
        validationError.context = {
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            value: err.input
          }))
        };
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

export const validateQuery = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError('Invalid query parameters');
        validationError.context = {
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            value: err.input
          }))
        };
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

export const validateParams = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError('Invalid URL parameters');
        validationError.context = {
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            value: err.input
          }))
        };
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};
```

---

## ⚙️ **Configuration Management System**

### **Environment Configuration**
```typescript
// src/config/environment.ts
import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment validation schema
const EnvironmentSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_VERSION: z.string().default('1.0.0'),
  SERVICE_NAME: z.string().default('templator-api'),
  
  // Database
  DATABASE_URL: z.string().url('Invalid database URL'),
  DATABASE_POOL_SIZE: z.coerce.number().default(10),
  
  // Redis
  REDIS_URL: z.string().url('Invalid Redis URL'),
  REDIS_TTL: z.coerce.number().default(3600),
  
  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // External APIs
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  OPENAI_ORGANIZATION: z.string().optional(),
  
  // File Upload
  MAX_FILE_SIZE: z.coerce.number().default(50 * 1024 * 1024), // 50MB
  UPLOAD_DIR: z.string().default('./uploads'),
  
  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  
  // Security
  CORS_ORIGINS: z.string().transform(str => str.split(',')).default('http://localhost:3000'),
  RATE_LIMIT_WINDOW: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Feature Flags
  ENABLE_ANALYTICS: z.coerce.boolean().default(true),
  ENABLE_CACHING: z.coerce.boolean().default(true),
  ENABLE_RATE_LIMITING: z.coerce.boolean().default(true)
});

// Validate and export configuration
export const config = EnvironmentSchema.parse(process.env);

// Type-safe configuration access
export type Config = z.infer<typeof EnvironmentSchema>;

// Configuration validation on startup
export const validateConfiguration = (): void => {
  try {
    EnvironmentSchema.parse(process.env);
    console.log('✅ Configuration validation passed');
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Configuration validation failed:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};
```

### **Feature Flags System**
```typescript
// src/services/FeatureFlags.service.ts
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  conditions?: {
    userRole?: string[];
    environment?: string[];
    percentage?: number;
  };
}

export class FeatureFlagsService {
  private flags: Map<string, FeatureFlag> = new Map();

  constructor() {
    this.initializeFlags();
  }

  private initializeFlags(): void {
    // Initialize from environment or external service
    const flags: FeatureFlag[] = [
      {
        key: 'ENABLE_NEW_AI_MODEL',
        enabled: config.NODE_ENV === 'development',
        description: 'Enable new AI model for processing'
      },
      {
        key: 'ENABLE_ADVANCED_ANALYTICS',
        enabled: config.ENABLE_ANALYTICS,
        description: 'Enable advanced analytics tracking'
      },
      {
        key: 'ENABLE_BETA_FEATURES',
        enabled: false,
        description: 'Enable beta features for testing',
        conditions: {
          userRole: ['admin', 'beta_tester'],
          environment: ['development', 'staging']
        }
      }
    ];

    flags.forEach(flag => {
      this.flags.set(flag.key, flag);
    });
  }

  isEnabled(
    key: string, 
    context?: { 
      userRole?: string; 
      environment?: string; 
      userId?: string; 
    }
  ): boolean {
    const flag = this.flags.get(key);
    if (!flag) {
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Check conditions if they exist
    if (flag.conditions) {
      const { userRole, environment, percentage } = flag.conditions;

      if (userRole && context?.userRole && !userRole.includes(context.userRole)) {
        return false;
      }

      if (environment && context?.environment && !environment.includes(context.environment)) {
        return false;
      }

      if (percentage && context?.userId) {
        // Consistent percentage rollout based on user ID
        const hash = this.hashUserId(context.userId);
        if (hash > percentage) {
          return false;
        }
      }
    }

    return true;
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  updateFlag(key: string, enabled: boolean): void {
    const flag = this.flags.get(key);
    if (flag) {
      flag.enabled = enabled;
    }
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }
}

// Feature flag middleware
export const featureFlagMiddleware = (flagKey: string) => {
  return (req: any, res: any, next: any) => {
    const featureFlags = new FeatureFlagsService();
    const context = {
      userRole: req.user?.role,
      environment: config.NODE_ENV,
      userId: req.user?.id
    };

    if (!featureFlags.isEnabled(flagKey, context)) {
      return res.status(404).json(
        ResponseBuilder.error(
          'FEATURE_NOT_AVAILABLE',
          'This feature is not available',
          req.requestId
        )
      );
    }

    next();
  };
};
```

---

## 📋 **Application Foundation Checklist**

### **Error Handling Setup**
- [ ] Implement custom error classes for all domains
- [ ] Set up global error handler middleware
- [ ] Configure error logging with context
- [ ] Add error monitoring integration (Sentry, etc.)
- [ ] Create error response standardization

### **Logging Implementation**
- [ ] Configure structured logging with Winston
- [ ] Add request correlation IDs
- [ ] Implement performance logging
- [ ] Set up log rotation and retention
- [ ] Add business event logging

### **API Design Standards**
- [ ] Standardize response formats
- [ ] Implement input validation with Zod
- [ ] Create OpenAPI documentation
- [ ] Set up API versioning strategy
- [ ] Add request/response middleware

### **Configuration Management**
- [ ] Environment variable validation
- [ ] Secrets management setup
- [ ] Feature flags implementation
- [ ] Configuration documentation
- [ ] Environment-specific configs

---

*This application foundation blueprint provides the essential infrastructure for building robust, maintainable APIs. These patterns ensure consistent error handling, comprehensive logging, and reliable configuration management across your entire application.*
