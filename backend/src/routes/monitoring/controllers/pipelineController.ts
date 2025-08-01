/**
 * Pipeline Monitoring Controllers
 * Handles pipeline-related monitoring endpoints
 */

import { Request, Response } from 'express';
import { createLogger } from '../../../utils/logger';
import PipelineProgressTracker from '../../../services/pipeline/PipelineProgressTracker';
import { formatJsonResponse, getErrorMessage, sendErrorResponse } from '../utils/responseFormatter';

const logger = createLogger();
const progressTracker = new PipelineProgressTracker();

/**
 * GET /api/monitoring/pipelines/active
 * Get all active pipelines
 */
export const getActivePipelines = (req: Request, res: Response): void => {
  try {
    const activePipelines = progressTracker.getAllActiveProgresses();
    
    res.json({
      success: true,
      data: {
        pipelines: activePipelines,
        count: activePipelines.length,
        summary: {
          running: activePipelines.filter(p => p.status === 'running').length,
          completed: activePipelines.filter(p => p.status === 'completed').length,
          failed: activePipelines.filter(p => p.status === 'failed').length
        }
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve active pipelines', { error: getErrorMessage(error) });
    sendErrorResponse(res, 'Failed to retrieve active pipelines');
  }
};

/**
 * GET /api/monitoring/pipelines/:id/progress
 * Get detailed progress for a specific pipeline
 */
export const getPipelineProgress = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const progress = progressTracker.getProgress(id);
    
    if (!progress) {
      return sendErrorResponse(res, `Pipeline with ID ${id} not found`, 404);
    }

    res.json({
      success: true,
      data: {
        pipeline: progress,
        phases: progress.phases || [],
        estimatedCompletion: progress.estimatedCompletion,
        performance: progress.performance || {}
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve pipeline progress', { 
      error: getErrorMessage(error),
      pipelineId: req.params.id 
    });
    sendErrorResponse(res, 'Failed to retrieve pipeline progress');
  }
};

/**
 * POST /api/monitoring/pipelines/:id/cancel
 * Cancel a running pipeline
 */
export const cancelPipeline = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const cancelled = progressTracker.cancelPipeline(id);
    
    if (!cancelled) {
      return sendErrorResponse(res, `Pipeline with ID ${id} not found or cannot be cancelled`, 404);
    }

    logger.info('Pipeline cancelled successfully', { pipelineId: id });

    res.json({
      success: true,
      data: {
        pipelineId: id,
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to cancel pipeline', { 
      error: getErrorMessage(error),
      pipelineId: req.params.id 
    });
    sendErrorResponse(res, 'Failed to cancel pipeline');
  }
};
