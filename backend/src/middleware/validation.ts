import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { createError } from './errorHandler';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    
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
    
    next();
  };
};

// Validation schemas
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
