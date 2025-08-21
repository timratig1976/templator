/**
 * Refactored Pipeline Monitoring Routes
 * Clean, modular route definitions with separated concerns
 */

import { Router } from 'express';

// Import controllers
import {
  getActivePipelines,
  getPipelineProgress,
  cancelPipeline,
  getRecentPipelineRuns,
  getPipelineRunDetails
} from './controllers/pipelineController';

import {
  getQualityMetrics,
  getRecentQualityReports,
  getQualityTrends,
  generateQualityReport,
  getTestRuns,
} from './controllers/qualityController';

import {
  getSystemHealth,
  getDashboardData,
  getDetailedPerformance,
  getDetailedSecurity
} from './controllers/systemController';

import {
  getErrorHistory,
  updateRecoveryConfig,
  getRecoveryConfig
} from './controllers/errorController';

import {
  getRawCodeQuality,
  getRawTestCoverage,
  getRawPerformance,
  getRawSecurity,
  getRawTrends
} from './controllers/rawDataController';

// Import services for export
import PipelineProgressTracker from '../../services/pipeline/PipelineProgressTracker';
import QualityMetricsDashboard from '../../services/quality/QualityMetricsDashboard';
import ErrorRecoverySystem from '../../services/recovery/ErrorRecoverySystem';
import { getPromptsSummary, getPromptDetail } from './controllers/promptController';
import { getDeadCodeReport, runDeadCodeScan } from './controllers/deadCodeController';

const router = Router();

// Initialize services
const progressTracker = new PipelineProgressTracker();
const qualityDashboard = new QualityMetricsDashboard();
const errorRecovery = new ErrorRecoverySystem();

// ========================================
// PIPELINE MONITORING ROUTES
// ========================================

/**
 * Pipeline Management Endpoints
 */
router.get('/pipelines/active', getActivePipelines);
router.get('/pipelines/runs/recent', getRecentPipelineRuns);
router.get('/pipelines/runs/:id', getPipelineRunDetails);
router.get('/pipelines/:id/progress', getPipelineProgress);
router.post('/pipelines/:id/cancel', cancelPipeline);

// ========================================
// QUALITY METRICS ROUTES
// ========================================

/**
 * Quality Analysis Endpoints
 */
router.get('/quality/metrics', getQualityMetrics);
router.get('/quality/reports/recent', getRecentQualityReports);
router.get('/quality/trends', getQualityTrends);
router.post('/quality/reports/generate', generateQualityReport);
router.get('/quality/test-runs', getTestRuns);

// ========================================
// SYSTEM HEALTH ROUTES
// ========================================

/**
 * System Health and Dashboard Endpoints
 */
router.get('/system/health', getSystemHealth);
router.get('/dashboard', getDashboardData);
router.get('/performance/detailed', getDetailedPerformance);
router.get('/security/detailed', getDetailedSecurity);

// ========================================
// ERROR RECOVERY ROUTES
// ========================================

/**
 * Error Management Endpoints
 */
router.get('/errors/history', getErrorHistory);
router.get('/errors/recovery/config', getRecoveryConfig);
router.post('/errors/recovery/config', updateRecoveryConfig);

// ========================================
// RAW DATA ROUTES
// ========================================

/**
 * Raw Data Endpoints for Verification and Auditing
 */
router.get('/code-quality/raw', getRawCodeQuality);
router.get('/test-coverage/raw', getRawTestCoverage);
router.get('/performance/raw', getRawPerformance);
router.get('/security/raw', getRawSecurity);
router.get('/trends/raw', getRawTrends);

// ========================================
// DEAD CODE ROUTES (Scaffold)
// ========================================

/**
 * Dead Code Monitoring Endpoints (non-destructive)
 */
router.get('/dead-code/report', getDeadCodeReport);
router.post('/dead-code/scan', runDeadCodeScan);

// ========================================
// HEALTH CHECK ROUTE
// ========================================

/**
 * Simple health check endpoint
 */
router.get('/health/comprehensive', getSystemHealth);

// ========================================
// PROMPT MONITORING ROUTES
// ========================================

/**
 * Prompt Monitoring Endpoints
 */
router.get('/prompts/summary', getPromptsSummary);
router.get('/prompts/:id', getPromptDetail);

// Export services for use in other parts of the application
export { progressTracker, qualityDashboard, errorRecovery };
export default router;
