import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { createError } from './errorHandler';

export const validateZodRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
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
      throw error;
    }
  };
};
