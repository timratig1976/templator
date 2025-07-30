import { Server } from 'socket.io';
import { createLogger } from './logger';

let io: Server | null = null;
const logger = createLogger();

/**
 * Sets the Socket.IO server instance for frontend logging
 * @param socketServer Socket.IO server instance
 */
export const setSocketIO = (socketServer: Server): void => {
  io = socketServer;
  logger.debug('Socket.IO server instance set for frontend logging');
};

/**
 * Log a message to the frontend via Socket.IO
 * @param level Log level (info, warn, error, debug, success)
 * @param category Log category for filtering and grouping (e.g., validation, openai, design, etc.)
 * @param message User-friendly message to display
 * @param data Additional data to log (optional)
 * @param requestId Request ID for tracking (optional)
 */
export const logToFrontend = (
  level: 'info' | 'warn' | 'error' | 'debug' | 'success',
  category: string,
  message: string,
  data?: Record<string, any>,
  requestId?: string
): void => {
  // Log to backend console first
  logger.debug(`Frontend Log [${category}]: ${message}`, { level, data, requestId });

  // Skip if no Socket.IO instance
  if (!io) {
    return;
  }

  try {
    // Emit log event to frontend
    io.emit('log', {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      requestId,
    });
  } catch (error) {
    logger.error('Failed to send log to frontend', {
      error: error instanceof Error ? error.message : 'Unknown error',
      level,
      category,
      message,
    });
  }
};

/**
 * Log detailed OpenAI-related information to the frontend
 * @param type Type of OpenAI log (request, response, error, etc.)
 * @param data Detailed OpenAI data
 * @param requestId Request ID for tracking
 */
export const logOpenAIToFrontend = (
  type: 'request' | 'response' | 'error' | 'tokens' | 'cost' | 'prompt',
  data: Record<string, any>,
  requestId?: string
): void => {
  if (!io) {
    return;
  }

  try {
    // Emit OpenAI-specific log event
    io.emit('openai_log', {
      timestamp: new Date().toISOString(),
      type,
      data,
      requestId,
    });
  } catch (error) {
    logger.error('Failed to send OpenAI log to frontend', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type,
    });
  }
};

export default {
  setSocketIO,
  logToFrontend,
  logOpenAIToFrontend,
};
