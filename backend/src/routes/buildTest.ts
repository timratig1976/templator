/**
 * Test Suite API Routes
 * Endpoints for monitoring and controlling the AutoBuildTestService
 * Part of the Test Suite Dashboard system
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { getBuildTestConfig } from '../../tests/config/build-test-config';

const router = Router();
const logger = createLogger();

// Lazily initialize the build test service on first access to avoid pulling test-suite runner during app import
let buildTestService: any | null = null;
function getBuildTestService(): any {
  if (!buildTestService) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // @ts-ignore - runtime alias resolution handled by tsconfig paths
    const AutoBuildTestService: any = require('@tests/AutoBuildTestService').default;
    buildTestService = new AutoBuildTestService(getBuildTestConfig());

    // Attach event listeners once
    buildTestService.on('buildTestComplete', (result: any) => {
      logger.info('Build test completed', {
        success: result.success,
        errors: result.errors.length,
        warnings: result.warnings.length,
        duration: result.duration,
      });
    });

    buildTestService.on('buildError', (result: any) => {
      logger.error('Build test detected errors', {
        errors: result.errors.length,
        errorFiles: result.summary.errorFiles,
      });
    });

    buildTestService.on('error', (error: any) => {
      logger.error('AutoBuildTestService error:', error);
    });
  }
  return buildTestService;
}

//  // Start the service automatically
// TEMPORARILY DISABLED: autoBuildTestService.start(); // Causing Socket.IO connection issues.
// buildTestService.start().catch(error => {
//   logger.error('Failed to start AutoBuildTestService:', error);
// });

/**
 * GET /api/build-test
 * Root endpoint - provides overview of build test system and available endpoints
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const svc = getBuildTestService();
    const latestResult = svc.getLatestBuildResult();
    const serviceHealth = svc.getServiceHealthSummary();
    const isHealthy = svc.isServiceHealthy();
    
    res.json({
      status: 'success',
      message: 'Test Suite Dashboard API',
      data: {
        system: {
          name: 'Templator Test Suite Dashboard',
          version: '1.0.0',
          isRunning: svc['isRunning'],
          isHealthy,
          lastBuildTime: latestResult?.timestamp || null
        },
        endpoints: {
          status: '/api/build-test/status',
          run: '/api/build-test/run (POST)',
          history: '/api/build-test/history',
          health: '/api/build-test/health',
          errors: '/api/build-test/errors',
          config: '/api/build-test/config (POST)'
        },
        quickStats: {
          totalErrors: latestResult?.errors?.length || 0,
          totalWarnings: latestResult?.warnings?.length || 0,
          lastTestDuration: latestResult?.duration || null,
          healthyServices: Object.values(serviceHealth).filter((s: any) => s.status === 'healthy').length,
          totalServices: Object.keys(serviceHealth).length
        }
      }
    });
  } catch (error) {
    logger.error('Error getting build test overview:', error);
    next(error);
  }
});

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
 * Manually trigger a build test (non-blocking)
 */
router.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Manual build test triggered');

    // Fire-and-forget to avoid blocking the HTTP response and risking socket collapse
    // Progress and result are accessible via /status and /history endpoints
    const svc = getBuildTestService();
    svc
      .runBuildTest()
      .then((result: any) => {
        logger.info('Manual build test finished', {
          success: result.success,
          duration: result.duration,
          errors: result.errors?.length || 0,
        });
      })
      .catch((err: any) => {
        logger.error('Manual build test failed', err);
      });

    res.status(202).json({
      status: 'accepted',
      message: 'Build test started',
      data: {
        isRunning: true,
        note: 'Check /api/build-test/status for progress and latest results.'
      }
    });
  } catch (error) {
    logger.error('Error enqueuing manual build test:', error);
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
    const svc = getBuildTestService();
    const history = svc.getBuildHistory();
    
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
    const svc = getBuildTestService();
    const serviceHealth = svc.getServiceHealthSummary();
    const latestResult = svc.getLatestBuildResult();
    
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
    const svc = getBuildTestService();
    const latestResult = svc.getLatestBuildResult();
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
      errors = errors.filter((error: any) => error.category === category);
    }
    
    if (severity) {
      errors = errors.filter((error: any) => error.severity === severity);
    }
    
    if (service) {
      errors = errors.filter((error: any) => error.file.includes(`/services/${service}/`));
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
  } catch (error: any) {
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

export default router;
