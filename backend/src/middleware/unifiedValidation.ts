import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ZodSchema, ZodError } from 'zod';
import { createError } from './errorHandler';

/**
 * Unified Validation Middleware
 * Supports both Joi and Zod validation schemas for maximum flexibility
 * Consolidates validation.ts and zodValidation.ts into a single, maintainable solution
 */

// Type definitions for validation schemas
export type ValidationSchema = Joi.ObjectSchema | ZodSchema;

export interface ValidationOptions {
  source?: 'body' | 'params' | 'query';
  stripUnknown?: boolean;
  allowUnknown?: boolean;
}

/**
 * Unified validation middleware that works with both Joi and Zod schemas
 */
export const validateRequest = (
  schema: ValidationSchema,
  options: ValidationOptions = {}
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { source = 'body', stripUnknown = true, allowUnknown = false } = options;
    const dataToValidate = req[source];

    try {
      // Check if it's a Joi schema
      if (isJoiSchema(schema)) {
        const joiOptions = {
          stripUnknown,
          allowUnknown,
          abortEarly: false
        };

        const { error, value } = schema.validate(dataToValidate, joiOptions);
        
        if (error) {
          const details = error.details.map(detail => detail.message).join(', ');
          throw createError(
            'Invalid request data',
            400,
            'INPUT_INVALID',
            details,
            'Please check your input data and try again'
          );
        }

        // Update request with validated/transformed data
        if (stripUnknown) {
          req[source] = value;
        }
        
        next();
      }
      // Check if it's a Zod schema
      else if (isZodSchema(schema)) {
        const result = schema.parse(dataToValidate);
        
        // Update request with validated/transformed data
        req[source] = result;
        
        next();
      }
      else {
        throw createError(
          'Invalid validation schema',
          500,
          'INTERNAL_ERROR',
          'Schema must be either Joi or Zod schema',
          'Please contact support if this error persists'
        );
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        throw createError(
          'Invalid request data',
          400,
          'INPUT_INVALID',
          details,
          'Please check your input data and try again'
        );
      }
      
      // Re-throw if it's already a properly formatted error
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error;
      }
      
      // Handle unexpected errors
      throw createError(
        'Validation failed',
        500,
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown validation error'
      );
    }
  };
};

/**
 * Type guards to distinguish between Joi and Zod schemas
 */
function isJoiSchema(schema: ValidationSchema): schema is Joi.ObjectSchema {
  return schema && typeof schema === 'object' && 'validate' in schema && typeof schema.validate === 'function';
}

function isZodSchema(schema: ValidationSchema): schema is ZodSchema {
  return schema && typeof schema === 'object' && 'parse' in schema && typeof schema.parse === 'function';
}

/**
 * Legacy compatibility exports
 * Maintains backward compatibility with existing code
 */

// Legacy Joi validation function (for backward compatibility)
export const validateJoiRequest = (schema: Joi.ObjectSchema, options: ValidationOptions = {}) => {
  return validateRequest(schema, options);
};

// Legacy Zod validation function (for backward compatibility)
export const validateZodRequest = (schema: ZodSchema, options: ValidationOptions = {}) => {
  return validateRequest(schema, options);
};

// ===== VALIDATION SCHEMAS =====
// Consolidated schemas from both validation.ts and zodValidation.ts

// Legacy schemas from validation.ts
export const parseRequestSchema = Joi.object({
  source_type: Joi.string().valid('html', 'json_component').required(),
  payload: Joi.string().min(1).max(1048576).required(), // 1MB limit
});

export const moduleRequestSchema = Joi.object({
  html_normalized: Joi.string().min(1).required(),
  fields_config: Joi.array().items(
    Joi.object({
      id: Joi.string(),
      label: Joi.string(),
      type: Joi.string().valid('text', 'richtext', 'image', 'url', 'choice'),
      required: Joi.boolean(),
    })
  ).optional(),
});

export const previewRequestSchema = Joi.object({
  html_normalized: Joi.string().min(1).required(),
  sample_data: Joi.object().optional(),
});

// Common validation schemas for the unified backend
export const refineHTMLSchema = Joi.object({
  html: Joi.string().required().min(10).max(50000),
  requirements: Joi.string().optional().max(1000)
});

export const pipelineExecutionSchema = Joi.object({
  options: Joi.object({
    enableEnhancement: Joi.boolean().optional(),
    qualityThreshold: Joi.number().min(0).max(100).optional(),
    maxIterations: Joi.number().min(1).max(10).optional(),
    fallbackOnError: Joi.boolean().optional(),
    exportFormat: Joi.string().valid('hubspot', 'html', 'json').optional()
  }).optional()
});

export const sectionEnhancementSchema = Joi.object({
  enhancementType: Joi.string().valid('quality', 'accessibility', 'performance', 'seo').required(),
  options: Joi.object({
    targetQuality: Joi.number().min(0).max(100).optional(),
    focusAreas: Joi.array().items(Joi.string()).optional()
  }).optional()
});

export const htmlRegenerationSchema = Joi.object({
  sectionId: Joi.string().required(),
  originalImage: Joi.string().optional(),
  customPrompt: Joi.string().max(2000).optional()
});

// Project management schemas
export const saveProjectSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  description: Joi.string().optional().max(500),
  sections: Joi.array().items(Joi.object()).optional(),
  metadata: Joi.object().optional()
});

export const updateProjectSchema = Joi.object({
  name: Joi.string().optional().min(1).max(100),
  description: Joi.string().optional().max(500),
  sections: Joi.array().items(Joi.object()).optional(),
  metadata: Joi.object().optional()
});

/**
 * Validation helper functions
 */
export const createValidationError = (message: string, details?: string) => {
  return createError(
    message,
    400,
    'INPUT_INVALID',
    details,
    'Please check your input data and try again'
  );
};

export const createSchemaError = (schemaName: string, error: any) => {
  const details = error instanceof Error ? error.message : 'Unknown schema error';
  return createError(
    `Schema validation failed for ${schemaName}`,
    400,
    'INPUT_INVALID', // Use valid error code
    details,
    'Please ensure your request matches the expected schema'
  );
};

/**
 * Middleware factory for common validation patterns
 */
export const createFileUploadValidator = (
  allowedTypes: string[],
  maxSize: number = 10 * 1024 * 1024 // 10MB default
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      throw createValidationError('No file uploaded');
    }

    const { mimetype, size } = req.file;

    if (!allowedTypes.includes(mimetype)) {
      throw createValidationError(
        `Invalid file type: ${mimetype}`,
        `Allowed types: ${allowedTypes.join(', ')}`
      );
    }

    if (size > maxSize) {
      throw createValidationError(
        `File too large: ${size} bytes`,
        `Maximum size: ${maxSize} bytes`
      );
    }

    next();
  };
};

export const createPaginationValidator = () => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  });

  return validateRequest(schema, { source: 'query' });
};

export default validateRequest;
