export class AppError extends Error {
  statusCode: number;
  context?: any;
  constructor(message: string, statusCode = 500, context?: any) {
    super(message);
    this.statusCode = statusCode;
    this.context = context;
  }
  toJSON() {
    return { message: this.message, statusCode: this.statusCode, context: this.context };
  }
}

export const ErrorHandler = {
  handle(error: Error, context?: any): AppError {
    if (error instanceof AppError) return error;
    const appError = new AppError(error.message || 'Unknown error', 500, context);
    return appError;
  }
};
