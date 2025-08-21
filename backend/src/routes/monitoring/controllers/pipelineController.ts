/**
 * Pipeline Monitoring Controllers
 * Handles pipeline-related monitoring endpoints
 */

import { Request, Response } from 'express';
import { createLogger } from '../../../utils/logger';
import PipelineProgressTracker from '../../../services/pipeline/PipelineProgressTracker';
import { getErrorMessage, sendErrorResponse } from '../utils/responseFormatter';
import prisma from '../../../services/database/prismaClient';

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
 * GET /api/monitoring/pipelines/runs/:id
 * Get a single pipeline run with basic step run details
 */
export const getPipelineRunDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: 'Missing run id' });
      return;
    }

    const run = await prisma.pipelineRun.findUnique({
      where: { id },
      include: {
        _count: { select: { stepRuns: true } },
        stepRuns: {
          orderBy: { startedAt: 'asc' },
          select: {
            id: true,
            nodeKey: true,
            status: true,
            startedAt: true,
            completedAt: true,
            error: true,
          },
        },
      },
    });

    if (!run) {
      res.status(404).json({ success: false, error: 'Pipeline run not found' });
      return;
    }

    res.json({ success: true, data: run });
  } catch (error) {
    logger.error('Failed to retrieve pipeline run details', { error: getErrorMessage(error) });
    sendErrorResponse(res, 'Failed to retrieve pipeline run details');
  }
};

/**
 * GET /api/monitoring/pipelines/runs/recent
 * Get recent pipeline runs with optional filtering
 * Query params:
 *  - limit: number (default 20, max 100)
 *  - offset: number (default 0)
 *  - status: string (optional)
 *  - origin: string (optional)
 */
export const getRecentPipelineRuns = async (req: Request, res: Response): Promise<void> => {
  try {
    const limitParam = parseInt(String(req.query.limit || ''), 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;
    const offsetParam = parseInt(String(req.query.offset || ''), 10);
    const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;
    const status = req.query.status ? String(req.query.status) : undefined;
    const origin = req.query.origin ? String(req.query.origin) : undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (origin) where.origin = origin;

    const [total, runs] = await Promise.all([
      prisma.pipelineRun.count({ where }),
      prisma.pipelineRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { stepRuns: true } },
        },
      }),
    ]);

    const summary: Record<string, number> = {};
    runs.forEach((r: (typeof runs)[number]) => {
      const key = String(r.status);
      summary[key] = (summary[key] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        runs,
        count: runs.length,
        total,
        offset,
        limit,
        summary: { byStatus: summary },
      },
    });
  } catch (error) {
    logger.error('Failed to retrieve recent pipeline runs', { error: getErrorMessage(error) });
    sendErrorResponse(res, 'Failed to retrieve recent pipeline runs');
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
