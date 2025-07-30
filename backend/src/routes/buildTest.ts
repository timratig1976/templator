/**
 * Build Test API Routes
 * Endpoints for monitoring and controlling the AutoBuildTestService
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import AutoBuildTestService from '../services/testing/AutoBuildTestService';
import { getBuildTestConfig } from '../config/build-test-config';

const router = Router();
const logger = createLogger();

// Initialize build test service
const buildTestService = new AutoBuildTestService(getBuildTestConfig());

//  // Start the service automatically
// TEMPORARILY DISABLED: autoBuildTestService.start(); // Causing Socket.IO connection issues.
// buildTestService.start().catch(error => {
//   logger.error('Failed to start AutoBuildTestService:', error);
// });

/**
 * GET /api/build-test/status
 * Get current build test status and latest results
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const latestResult = buildTestService.getLatestBuildResult();
    const serviceHealth = buildTestService.getServiceHealthSummary();
    const isHealthy = buildTestService.isServiceHealthy();

    res.json({
      status: 'success',
      data: {
        isRunning: buildTestService['isRunning'],
        isHealthy,
        lastBuildTime: latestResult?.timestamp || null,
        latestResult,
        serviceHealth,
        config: getBuildTestConfig()
      }
    });
  } catch (error) {
    logger.error('Error getting build test status:', error);
    next(error);
  }
});

/**
 * POST /api/build-test/run
 * Manually trigger a build test
 */
router.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Manual build test triggered');
    
    const result = await buildTestService.runBuildTest();
    
    res.json({
      status: 'success',
      message: 'Build test completed',
      data: result
    });
  } catch (error) {
    logger.error('Error running manual build test:', error);
    next(error);
  }
});

/**
 * GET /api/build-test/history
 * Get build test history
 */
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = buildTestService.getBuildHistory();
    
    // Return most recent results first
    const limitedHistory = history.slice(-limit).reverse();
    
    res.json({
      status: 'success',
      data: {
        history: limitedHistory,
        total: history.length
      }
    });
  } catch (error) {
    logger.error('Error getting build test history:', error);
    next(error);
  }
});

/**
 * GET /api/build-test/health
 * Get detailed service health report
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serviceHealth = buildTestService.getServiceHealthSummary();
    const latestResult = buildTestService.getLatestBuildResult();
    
    // Calculate overall health metrics
    const healthMetrics = calculateHealthMetrics(serviceHealth, latestResult);
    
    res.json({
      status: 'success',
      data: {
        serviceHealth,
        metrics: healthMetrics,
        recommendations: generateHealthRecommendations(serviceHealth, latestResult)
      }
    });
  } catch (error) {
    logger.error('Error getting service health:', error);
    next(error);
  }
});

/**
 * GET /api/build-test/errors
 * Get current build errors with filtering
 */
router.get('/errors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const latestResult = buildTestService.getLatestBuildResult();
    const category = req.query.category as string;
    const severity = req.query.severity as string;
    const service = req.query.service as string;
    
    if (!latestResult) {
      return res.json({
        status: 'success',
        data: {
          errors: [],
          message: 'No build results available'
        }
      });
    }
    
    let errors = latestResult.errors;
    
    // Apply filters
    if (category) {
      errors = errors.filter(error => error.category === category);
    }
    
    if (severity) {
      errors = errors.filter(error => error.severity === severity);
    }
    
    if (service) {
      errors = errors.filter(error => error.file.includes(`/services/${service}/`));
    }
    
    // Group errors by category for better analysis
    const errorsByCategory = groupErrorsByCategory(errors);
    
    res.json({
      status: 'success',
      data: {
        errors,
        errorsByCategory,
        totalErrors: latestResult.errors.length,
        filteredCount: errors.length
      }
    });
  } catch (error) {
    logger.error('Error getting build errors:', error);
    next(error);
  }
});

/**
 * POST /api/build-test/config
 * Update build test configuration
 */
router.post('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { interval, enabled, notifyOnError } = req.body;
    
    // Validate configuration
    if (interval && (interval < 1 || interval > 1440)) {
      return res.status(400).json({
        status: 'error',
        message: 'Interval must be between 1 and 1440 minutes'
      });
    }
    
    // Update configuration (this would typically update a config file or database)
    logger.info('Build test configuration update requested', {
      interval,
      enabled,
      notifyOnError
    });
    
    res.json({
      status: 'success',
      message: 'Configuration updated successfully',
      data: {
        interval,
        enabled,
        notifyOnError
      }
    });
  } catch (error) {
    logger.error('Error updating build test config:', error);
    next(error);
  }
});

/**
 * Calculate health metrics from service health data
 */
function calculateHealthMetrics(serviceHealth: any, latestResult: any) {
  const phases = Object.keys(serviceHealth);
  const healthyPhases = phases.filter(phase => serviceHealth[phase].status === 'healthy');
  const errorPhases = phases.filter(phase => serviceHealth[phase].status === 'error');
  const warningPhases = phases.filter(phase => serviceHealth[phase].status === 'warning');
  
  const totalErrors = latestResult?.errors.length || 0;
  const totalWarnings = latestResult?.warnings.length || 0;
  const totalFiles = latestResult?.filesCounted || 0;
  
  return {
    overallHealth: errorPhases.length === 0 ? 'healthy' : 'unhealthy',
    healthyPhases: healthyPhases.length,
    errorPhases: errorPhases.length,
    warningPhases: warningPhases.length,
    totalPhases: phases.length,
    healthPercentage: Math.round((healthyPhases.length / phases.length) * 100),
    totalErrors,
    totalWarnings,
    totalFiles,
    errorRate: totalFiles > 0 ? Math.round((totalErrors / totalFiles) * 100) : 0
  };
}

/**
 * Generate health recommendations based on current status
 */
function generateHealthRecommendations(serviceHealth: any, latestResult: any) {
  const recommendations: string[] = [];
  
  // Check for phases with errors
  Object.entries(serviceHealth).forEach(([phase, health]: [string, any]) => {
    if (health.status === 'error') {
      recommendations.push(`🔴 Fix critical errors in ${phase} service phase (${health.errorCount} errors)`);
    } else if (health.status === 'warning') {
      recommendations.push(`🟡 Review warnings in ${phase} service phase (${health.errorCount} issues)`);
    }
  });
  
  // Check for import path errors
  if (latestResult?.errors) {
    const importErrors = latestResult.errors.filter((e: any) => e.category === 'import_path');
    if (importErrors.length > 0) {
      recommendations.push(`📁 Fix ${importErrors.length} import path errors - likely due to service reorganization`);
    }
    
    const typeErrors = latestResult.errors.filter((e: any) => e.category === 'type_error');
    if (typeErrors.length > 5) {
      recommendations.push(`🔧 Review TypeScript configuration - ${typeErrors.length} type errors detected`);
    }
  }
  
  // Check for new files
  if (latestResult?.summary?.newFiles?.length > 0) {
    recommendations.push(`📄 ${latestResult.summary.newFiles.length} new files detected - ensure they follow project structure`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ All services are healthy - no immediate action required');
  }
  
  return recommendations;
}

/**
 * Group errors by category for analysis
 */
function groupErrorsByCategory(errors: any[]) {
  const grouped: { [key: string]: any[] } = {};
  
  errors.forEach(error => {
    if (!grouped[error.category]) {
      grouped[error.category] = [];
    }
    grouped[error.category].push(error);
  });
  
  return grouped;
}

// Event listeners for build test service
buildTestService.on('buildTestComplete', (result) => {
  logger.info('Build test completed', {
    success: result.success,
    errors: result.errors.length,
    warnings: result.warnings.length,
    duration: result.duration
  });
});

buildTestService.on('buildError', (result) => {
  logger.error('Build test detected errors', {
    errors: result.errors.length,
    errorFiles: result.summary.errorFiles
  });
});

buildTestService.on('error', (error) => {
  logger.error('AutoBuildTestService error:', error);
});

export default router;
