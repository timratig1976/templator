/**
 * Pipeline Monitoring Routes
 * Enhanced real-time monitoring, quality metrics, and error recovery endpoints
 */

import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import PipelineProgressTracker from '../services/pipeline/PipelineProgressTracker';
import QualityMetricsDashboard from '../services/quality/QualityMetricsDashboard';
import ErrorRecoverySystem from '../services/recovery/ErrorRecoverySystem';

const router = Router();
const logger = createLogger();

// Helper function to safely get error message
const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

// Initialize services
const progressTracker = new PipelineProgressTracker();
const qualityDashboard = new QualityMetricsDashboard();
const errorRecovery = new ErrorRecoverySystem();

/**
 * GET /api/monitoring/pipelines/active
 * Get all currently active pipeline progresses
 */
router.get('/pipelines/active', (req: Request, res: Response) => {
  try {
    const activePipelines = progressTracker.getAllActiveProgresses();
    
    res.json({
      success: true,
      data: {
        pipelines: activePipelines,
        count: activePipelines.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get active pipelines', { error: errorMessage });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active pipelines'
    });
  }
});

/**
 * GET /api/monitoring/pipelines/:id/progress
 * Get detailed progress for a specific pipeline
 */
router.get('/pipelines/:id/progress', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const progress = progressTracker.getProgress(id);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      });
    }

    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    logger.error('Failed to get pipeline progress', { 
      pipelineId: req.params.id, 
      error: getErrorMessage(error) 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pipeline progress'
    });
  }
});

/**
 * POST /api/monitoring/pipelines/:id/cancel
 * Cancel a running pipeline
 */
router.post('/pipelines/:id/cancel', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cancelled = progressTracker.cancelPipeline(id);
    
    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found or already completed'
      });
    }

    logger.info('Pipeline cancelled', { pipelineId: id });

    res.json({
      success: true,
      message: 'Pipeline cancelled successfully',
      data: { pipelineId: id, cancelledAt: new Date().toISOString() }
    });
  } catch (error) {
    logger.error('Failed to cancel pipeline', { 
      pipelineId: req.params.id, 
      error: getErrorMessage(error) 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to cancel pipeline'
    });
  }
});

/**
 * GET /api/monitoring/quality/metrics
 * Get current quality metrics
 */
router.get('/quality/metrics', (req: Request, res: Response) => {
  try {
    const metrics = qualityDashboard.getAllMetrics();
    
    res.json({
      success: true,
      data: {
        metrics,
        summary: {
          totalMetrics: metrics.length,
          averageScore: metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length,
          improving: metrics.filter(m => m.trend === 'improving').length,
          declining: metrics.filter(m => m.trend === 'declining').length,
          stable: metrics.filter(m => m.trend === 'stable').length
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get quality metrics', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quality metrics'
    });
  }
});

/**
 * GET /api/monitoring/quality/reports/recent
 * Get recent quality reports
 */
router.get('/quality/reports/recent', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const reports = qualityDashboard.getRecentReports(limit);
    
    res.json({
      success: true,
      data: {
        reports,
        count: reports.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get recent quality reports', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quality reports'
    });
  }
});

/**
 * GET /api/monitoring/quality/reports/:id
 * Get a specific quality report
 */
router.get('/quality/reports/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = qualityDashboard.getReport(id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Quality report not found'
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Failed to get quality report', { 
      reportId: req.params.id, 
      error: getErrorMessage(error) 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quality report'
    });
  }
});

/**
 * GET /api/monitoring/quality/trends
 * Get quality trends analysis
 */
router.get('/quality/trends', (req: Request, res: Response) => {
  try {
    const period = (req.query.period as '24h' | '7d' | '30d') || '24h';
    const trends = qualityDashboard.getQualityTrends(period);
    
    res.json({
      success: true,
      data: {
        trends,
        period,
        analysis: {
          improving: trends.filter(t => t.direction === 'up').length,
          declining: trends.filter(t => t.direction === 'down').length,
          stable: trends.filter(t => t.direction === 'stable').length,
          majorChanges: trends.filter(t => t.significance === 'major').length
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get quality trends', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quality trends'
    });
  }
});

/**
 * POST /api/monitoring/quality/reports/generate
 * Generate a new quality report for pipeline data
 */
router.post('/quality/reports/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pipelineId, sectionData, validationResults } = req.body;
    
    if (!pipelineId || !sectionData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: pipelineId, sectionData'
      });
    }

    const report = await qualityDashboard.generateQualityReport(
      pipelineId,
      sectionData,
      validationResults || []
    );

    logger.info('Quality report generated', {
      reportId: report.id,
      pipelineId,
      overallScore: report.overallScore
    });

    res.json({
      success: true,
      data: report,
      message: 'Quality report generated successfully'
    });
  } catch (error) {
    logger.error('Failed to generate quality report', { error: getErrorMessage(error) });
    next(error);
  }
});

/**
 * GET /api/monitoring/errors/history
 * Get error history and statistics
 */
router.get('/errors/history', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const errorHistory = errorRecovery.getErrorHistory().slice(0, limit);
    const stats = errorRecovery.getErrorStats();
    
    res.json({
      success: true,
      data: {
        errors: errorHistory,
        statistics: stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get error history', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error history'
    });
  }
});

/**
 * GET /api/monitoring/errors/stats
 * Get error statistics summary
 */
router.get('/errors/stats', (req: Request, res: Response) => {
  try {
    const stats = errorRecovery.getErrorStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        recoveryRate: stats.total > 0 ? (stats.resolved / stats.total * 100).toFixed(1) : '0',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get error stats', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve error statistics'
    });
  }
});

/**
 * POST /api/monitoring/errors/recovery/config
 * Update error recovery configuration
 */
router.post('/errors/recovery/config', (req: Request, res: Response) => {
  try {
    const config = req.body;
    errorRecovery.updateConfig(config);
    
    logger.info('Error recovery config updated', { config });

    res.json({
      success: true,
      message: 'Error recovery configuration updated',
      data: { updatedAt: new Date().toISOString() }
    });
  } catch (error) {
    logger.error('Failed to update error recovery config', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to update error recovery configuration'
    });
  }
});

/**
 * GET /api/monitoring/system/health
 * Get overall system health status
 */
router.get('/system/health', (req: Request, res: Response) => {
  try {
    const activePipelines = progressTracker.getAllActiveProgresses();
    const metrics = qualityDashboard.getAllMetrics();
    const errorStats = errorRecovery.getErrorStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      pipelines: {
        active: activePipelines.length,
        running: activePipelines.filter(p => p.status === 'running').length,
        completed: activePipelines.filter(p => p.status === 'completed').length,
        failed: activePipelines.filter(p => p.status === 'failed').length
      },
      quality: {
        averageScore: metrics.length > 0 ? 
          Math.round(metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length) : 0,
        trending: {
          improving: metrics.filter(m => m.trend === 'improving').length,
          declining: metrics.filter(m => m.trend === 'declining').length,
          stable: metrics.filter(m => m.trend === 'stable').length
        }
      },
      errors: {
        total: errorStats.total,
        resolved: errorStats.resolved,
        recoveryRate: errorStats.total > 0 ? 
          Math.round((errorStats.resolved / errorStats.total) * 100) : 100,
        recentCritical: 0 // Would be calculated from recent errors
      },
      system: {
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        uptime: Math.round(process.uptime()), // seconds
        nodeVersion: process.version
      }
    };

    // Determine overall health status
    if (health.errors.recoveryRate < 80 || health.quality.averageScore < 60) {
      health.status = 'degraded';
    }
    if (health.errors.recoveryRate < 50 || health.quality.averageScore < 40) {
      health.status = 'unhealthy';
    }

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Failed to get system health', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system health',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/monitoring/dashboard
 * Get comprehensive dashboard data
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const activePipelines = progressTracker.getAllActiveProgresses();
    const metrics = qualityDashboard.getAllMetrics();
    const recentReports = qualityDashboard.getRecentReports(5);
    const errorStats = errorRecovery.getErrorStats();
    const trends = qualityDashboard.getQualityTrends('24h');

    const dashboard = {
      overview: {
        activePipelines: activePipelines.length,
        averageQuality: metrics.length > 0 ? 
          Math.round(metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length) : 0,
        errorRecoveryRate: errorStats.total > 0 ? 
          Math.round((errorStats.resolved / errorStats.total) * 100) : 100,
        systemHealth: 'healthy' // Would be calculated
      },
      pipelines: {
        active: activePipelines.slice(0, 10), // Latest 10
        summary: {
          running: activePipelines.filter(p => p.status === 'running').length,
          completed: activePipelines.filter(p => p.status === 'completed').length,
          failed: activePipelines.filter(p => p.status === 'failed').length
        }
      },
      quality: {
        metrics: metrics.slice(0, 8), // Top 8 metrics
        recentReports: recentReports.slice(0, 5),
        trends: trends.slice(0, 6)
      },
      errors: {
        statistics: errorStats,
        recentErrors: errorRecovery.getErrorHistory().slice(0, 10)
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Failed to get dashboard data', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data'
    });
  }
});

// Export the services for use in other parts of the application
export { progressTracker, qualityDashboard, errorRecovery };
export default router;
