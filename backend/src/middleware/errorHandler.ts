import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { ErrorResponse } from '../../../shared/types';

const logger = createLogger();

export interface AppError extends Error {
  statusCode?: number;
  code?: ErrorResponse['code'];
  details?: string;
  suggestion?: string;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error details
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    correlationId: req.headers['x-correlation-id'],
  });

  // Default error response
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';
  
  const errorResponse = {
    success: false,
    message: err.message || 'Internal Server Error',
    error: err.message || 'Internal Server Error',
    code: errorCode,
    details: process.env.NODE_ENV === 'development' ? err.details : undefined,
    suggestion: err.suggestion,
  };

  res.status(statusCode).json(errorResponse);
};

export const createError = (
  message: string,
  statusCode: number = 500,
  code: ErrorResponse['code'] = 'INTERNAL_ERROR',
  details?: string,
  suggestion?: string
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  error.suggestion = suggestion;
  return error;
};
