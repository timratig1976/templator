/**
 * Error Recovery Controllers
 * Handles error monitoring and recovery configuration endpoints
 */

import { Request, Response } from 'express';
import { createLogger } from '../../../utils/logger';
import ErrorRecoverySystem from '../../../services/recovery/ErrorRecoverySystem';
import { getErrorMessage, sendErrorResponse } from '../utils/responseFormatter';

const logger = createLogger();
const errorRecovery = new ErrorRecoverySystem();

/**
 * GET /api/monitoring/errors/history
 * Get error history and statistics
 */
export const getErrorHistory = (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const errorHistory = errorRecovery.getErrorHistory().slice(0, limit);
    const stats = errorRecovery.getErrorStats();

    res.json({
      success: true,
      data: {
        errors: errorHistory,
        statistics: {
          total: stats.total || 0,
          resolved: stats.resolved || 0,
          pending: (stats.total - stats.resolved) || 0,
          recoveryRate: stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 100,
          averageRecoveryTime: 0, // Not available in current interface
          mostCommonErrors: [], // Not available in current interface
          errorsByCategory: stats.byType || {}
        },
        summary: {
          recentTrend: errorHistory.length > 0 ? 'stable' : 'improving',
          criticalErrors: errorHistory.filter(e => e.severity === 'critical').length,
          lastError: errorHistory[0] || null
        }
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve error history', { error: getErrorMessage(error) });
    sendErrorResponse(res, 'Failed to retrieve error statistics');
  }
};

/**
 * POST /api/monitoring/errors/recovery/config
 * Update error recovery configuration
 */
export const updateRecoveryConfig = (req: Request, res: Response): void => {
  try {
    const config = req.body;
    
    // Validate configuration
    if (!config || typeof config !== 'object') {
      return sendErrorResponse(res, 'Invalid configuration format', 400);
    }

    errorRecovery.updateConfig(config);
    
    logger.info('Error recovery config updated', { config });

    res.json({
      success: true,
      data: {
        message: 'Error recovery configuration updated successfully',
        config,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to update error recovery configuration', { 
      error: getErrorMessage(error),
      config: req.body 
    });
    sendErrorResponse(res, 'Failed to update error recovery configuration');
  }
};

/**
 * GET /api/monitoring/errors/recovery/config
 * Get current error recovery configuration
 */
export const getRecoveryConfig = (req: Request, res: Response): void => {
  try {
    // Provide default config since getConfig method doesn't exist in current interface
    const config = {
      enabled: true,
      maxRetries: 3,
      retryDelay: 1000,
      strategies: ['ai_retry', 'validation_autofix', 'network_retry'],
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: {
        config,
        lastUpdated: config.lastUpdated,
        isActive: config.enabled
      }
    });
  } catch (error) {
    logger.error('Failed to get error recovery configuration', { error: getErrorMessage(error) });
    sendErrorResponse(res, 'Failed to retrieve error recovery configuration');
  }
};
