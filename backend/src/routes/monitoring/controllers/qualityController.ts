/**
 * Quality Metrics Controllers
 * Handles quality-related monitoring endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../../../utils/logger';
import QualityMetricsDashboard from '../../../services/quality/QualityMetricsDashboard';
import { formatJsonResponse, getErrorMessage, sendErrorResponse, formatSuccessResponse } from '../utils/responseFormatter';
import TestRunRepository from '../../../services/database/TestRunRepository';

const logger = createLogger();
const qualityDashboard = new QualityMetricsDashboard();
const testRunRepo = new TestRunRepository();

/**
 * GET /api/monitoring/quality/metrics
 * Get current quality metrics
 */
export const getQualityMetrics = (req: Request, res: Response): void => {
  try {
    const metrics = qualityDashboard.getAllMetrics();
    
    res.json({
      success: true,
      data: {
        metrics,
        summary: {
          overallScore: Array.isArray(metrics) && metrics.length > 0 ? (metrics[0] as any).score || 0 : 0,
          trend: 'stable',
          lastUpdated: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve quality metrics', { error: getErrorMessage(error) });
    sendErrorResponse(res, 'Failed to retrieve quality metrics');
  }
};

/**
 * GET /api/monitoring/quality/test-runs
 * List recent test runs by moduleId or designSplitId
 */
export const getTestRuns = async (req: Request, res: Response): Promise<void> => {
  try {
    const { moduleId, designSplitId, limit } = req.query as Record<string, string | undefined>;

    if (!moduleId && !designSplitId) {
      return sendErrorResponse(res, 'Provide moduleId or designSplitId', 400);
    }

    let runs;
    if (designSplitId) {
      runs = await testRunRepo.listRunsBySplit(designSplitId);
    } else {
      runs = await testRunRepo.listRunsByModule(moduleId as string, parseInt(limit || '20', 10) || 20);
    }

    res.json({
      success: true,
      data: { runs },
    });
  } catch (error) {
    logger.error('Failed to fetch test runs', { error: getErrorMessage(error), query: req.query });
    sendErrorResponse(res, 'Failed to fetch test runs');
  }
};

/**
 * GET /api/monitoring/quality/reports/recent
 * Get recent quality reports
 */
export const getRecentQualityReports = (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const reports = qualityDashboard.getRecentReports(limit);
    
    res.json({
      success: true,
      data: {
        reports,
        count: reports.length,
        summary: {
          averageScore: reports.length > 0 
            ? reports.reduce((sum, r) => sum + ((r as any).score || 0), 0) / reports.length 
            : 0,
          latestReport: reports[0] || null,
          timeRange: {
            from: reports.length > 0 ? (reports[reports.length - 1] as any).timestamp : null,
            to: reports.length > 0 ? (reports[0] as any).timestamp : null
          }
        }
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve quality reports', { 
      error: getErrorMessage(error),
      limit: req.query.limit 
    });
    sendErrorResponse(res, 'Failed to retrieve quality report');
  }
};

/**
 * GET /api/monitoring/quality/trends
 * Get quality trends analysis
 */
export const getQualityTrends = (req: Request, res: Response): void => {
  try {
    const period = (req.query.period as '24h' | '7d' | '30d') || '24h';
    const trends = qualityDashboard.getQualityTrends(period);
    
    res.json({
      success: true,
      data: {
        trends,
        period,
        analysis: {
          direction: (trends as any).direction || 'stable',
          changePercent: (trends as any).changePercent || 0,
          significantChanges: (trends as any).significantChanges || []
        }
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve quality trends', { 
      error: getErrorMessage(error),
      period: req.query.period 
    });
    sendErrorResponse(res, 'Failed to retrieve quality trends');
  }
};

/**
 * POST /api/monitoring/quality/reports/generate
 * Generate a new quality report for pipeline data
 */
export const generateQualityReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { pipelineId, sectionData, validationResults } = req.body;
    
    if (!pipelineId || !sectionData) {
      return sendErrorResponse(res, 'Missing required fields: pipelineId and sectionData', 400);
    }

    // Persist a TestRun for this quality report (best-effort)
    let runId: string | undefined;
    try {
      const run = await testRunRepo.createRun({
        designSplitId: undefined,
        artifactId: undefined,
        moduleId: pipelineId,
        type: 'quality',
        status: 'running',
        summary: { initiatedBy: 'qualityController', sections: Array.isArray(sectionData) ? sectionData.length : 1 },
      });
      runId = run.id;
    } catch (e) {
      logger.warn('Failed to create TestRun (non-blocking)', { error: getErrorMessage(e) });
    }

    // Generate real quality report via dashboard service
    const report = await qualityDashboard.generateQualityReport(
      pipelineId,
      Array.isArray(sectionData) ? sectionData : [sectionData],
      Array.isArray(validationResults) ? validationResults : []
    );

    logger.info('Quality report generated successfully', { 
      pipelineId, 
      reportId: report.id,
      score: report.overallScore 
    });

    // Append results to TestRun if available
    try {
      if (runId) {
        await testRunRepo.addResult(runId, {
          name: 'Quality Report Generation',
          status: 'passed',
          durationMs: 0,
          details: { score: report.overallScore, metrics: report.metrics, grade: report.grade },
        });

        if (Array.isArray(validationResults)) {
          for (const v of validationResults) {
            await testRunRepo.addResult(runId, {
              name: `Validation: ${v?.validator || 'unknown'}`,
              status: v?.status === 'passed' ? 'passed' : v?.status === 'warning' ? 'flaky' : 'failed',
              durationMs: v?.metrics?.durationMs || 0,
              details: v || {},
            });
          }
        }

        const passed = Array.isArray(validationResults)
          ? validationResults.filter((v: any) => v?.status === 'passed').length
          : 1;
        const failed = Array.isArray(validationResults)
          ? validationResults.filter((v: any) => v?.status === 'failed').length
          : 0;

        await testRunRepo.completeRun(runId, failed > 0 ? 'partial' : 'passed', {
          reportId: report.id,
          score: report.overallScore,
          total: (Array.isArray(validationResults) ? validationResults.length : 0) + 1,
          passed: passed + 1,
          failed,
        });
      }
    } catch (e) {
      logger.warn('Failed to persist TestRun results (non-blocking)', { error: getErrorMessage(e), runId });
    }

    res.json({
      success: true,
      data: {
        report,
        testRun: runId ? { id: runId } : null,
        summary: {
          reportId: report.id,
          score: report.overallScore,
          generatedAt: report.generatedAt,
          sectionsAnalyzed: report.sectionBreakdown.length,
          testRunId: runId || undefined,
        }
      }
    });
  } catch (error) {
    logger.error('Failed to generate quality report', { 
      error: getErrorMessage(error),
      pipelineId: req.body.pipelineId 
    });
    next(error);
  }
};
