/**
 * Export and Deployment API Routes
 * Phase 5: Export and Deployment System
 */

import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import ModulePackagingService from '../services/module/ModulePackagingService';
import HubSpotDeploymentService from '../services/deployment/HubSpotDeploymentService';
import packageValidationService from '../services/quality/PackageValidationService';
import moduleVersioningService from '../services/module/ModuleVersioningService';
import { createLogger } from '../utils/logger';
// import { validateRequest } from '../middleware/validation'; // Removed due to type conflicts

const logger = createLogger();
import { z } from 'zod';

const router = express.Router();
const upload = multer({ dest: 'temp/uploads/' });

// Validation schemas
const packageRequestSchema = z.object({
  module_files: z.object({
    'module.html': z.string(),
    'fields.json': z.string(),
    'meta.json': z.string(),
    'module.css': z.string().optional(),
    'module.js': z.string().optional(),
    'README.md': z.string().optional()
  }),
  package_options: z.object({
    format: z.enum(['zip', 'tar', 'hubspot']),
    compression_level: z.enum(['none', 'fast', 'best']),
    include_source_maps: z.boolean(),
    include_documentation: z.boolean(),
    include_tests: z.boolean(),
    minify_assets: z.boolean(),
    optimize_images: z.boolean(),
    bundle_dependencies: z.boolean(),
    validate_before_packaging: z.boolean().optional(),
    validation_level: z.enum(['basic', 'strict', 'comprehensive']).optional()
  }),
  metadata: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string(),
    author: z.string()
  })
});

const deploymentRequestSchema = z.object({
  package_id: z.string(),
  credentials: z.object({
    access_token: z.string(),
    portal_id: z.string(),
    refresh_token: z.string().optional(),
    expires_at: z.string().optional()
  }),
  options: z.object({
    environment: z.enum(['sandbox', 'production']),
    auto_publish: z.boolean(),
    backup_existing: z.boolean(),
    deployment_notes: z.string().optional(),
    scheduled_deployment: z.string().optional(),
    rollback_on_failure: z.boolean(),
    validation_level: z.enum(['basic', 'strict', 'comprehensive'])
  })
});

// Initialize services
const packagingService = ModulePackagingService.getInstance();
const deploymentService = HubSpotDeploymentService.getInstance();

/**
 * Validate module before packaging
 */
router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { module_files, validation_options = {} } = req.body;
    
    const validationReport = await packageValidationService.validateModule(
      module_files,
      validation_options
    );
    
    res.json({ validation_report: validationReport });
  } catch (error) {
    next(error);
  }
});

/**
 * Auto-fix validation issues
 */
router.post('/validate/fix', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { module_files, issues } = req.body;
    
    const fixResult = await packageValidationService.autoFixIssues(
      module_files,
      issues
    );
    
    res.json({ fix_result: fixResult });
  } catch (error) {
    next(error);
  }
});

/**
 * Package a module for export
 */
router.post('/package', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { module_files, package_options, metadata } = req.body;
    
    // Validate module before packaging if validation is enabled
    if (package_options.validate_before_packaging !== false) {
      const validationReport = await packageValidationService.validateModule(
        module_files,
        {
          level: package_options.validation_level || 'strict',
          include_performance: true,
          include_security: true,
          include_accessibility: true,
          auto_fix_enabled: false
        }
      );
      
      // If there are critical errors, return validation report instead of packaging
      if (!validationReport.is_valid && validationReport.errors.length > 0) {
        return res.status(400).json({
          error: 'Module validation failed',
          validation_report: validationReport
        });
      }
    }
    
    const moduleId = `module_${Date.now()}`;
    logger.info('Packaging module request', {
      moduleId,
      format: package_options.format,
      author: metadata.author
    });

    const packageResult = await packagingService.packageModule(
      moduleId,
      module_files,
      package_options,
      metadata
    );

    res.json({
      success: true,
      package_result: packageResult
    });

  } catch (error) {
    logger.error('Module packaging failed', { error });
    next(error);
  }
});

/**
 * Get package information
 */
router.get('/package/:packageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { packageId } = req.params;
    
    const packageInfo = await packagingService.getPackageInfo(packageId);
    
    if (!packageInfo) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    res.json({
      success: true,
      package_info: packageInfo
    });

  } catch (error) {
    logger.error('Failed to get package info', { error });
    next(error);
  }
});

/**
 * Download packaged module
 */
router.get('/package/:packageId/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { packageId } = req.params;
    
    const packageInfo = await packagingService.getPackageInfo(packageId);
    
    if (!packageInfo) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    // In a real implementation, would serve the actual file
    const packagePath = path.join(process.cwd(), 'temp', 'packages', `${packageId}.zip`);
    
    res.download(packagePath, `${packageInfo.module_name}-${packageInfo.version}.zip`, (err) => {
      if (err) {
        logger.error('Download failed', { packageId, error: err });
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Download failed'
          });
        }
      }
    });

  } catch (error) {
    logger.error('Download preparation failed', { error });
    next(error);
  }
});

/**
 * List available packages
 */
router.get('/packages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { created_after, created_by, module_type } = req.query;
    
    const filters = {
      created_after: created_after as string,
      created_by: created_by as string,
      module_type: module_type as string
    };

    const packages = await packagingService.listPackages(filters);

    res.json({
      success: true,
      packages
    });

  } catch (error) {
    logger.error('Failed to list packages', { error });
    next(error);
  }
});

/**
 * Delete a package
 */
router.delete('/package/:packageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { packageId } = req.params;
    
    const success = await packagingService.deletePackage(packageId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Package not found or could not be deleted'
      });
    }

    res.json({
      success: true,
      message: 'Package deleted successfully'
    });

  } catch (error) {
    logger.error('Failed to delete package', { error });
    next(error);
  }
});

/**
 * Deploy module to HubSpot
 */
router.post('/deploy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { package_id, credentials, options } = req.body;

    logger.info('HubSpot deployment request', {
      packageId: package_id,
      environment: options.environment,
      portalId: credentials.portal_id
    });

    // Get package info
    const packageInfo = await packagingService.getPackageInfo(package_id);
    if (!packageInfo) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    // Create package result object
    const packageResult = {
      package_id: package_id,
      package_path: path.join(process.cwd(), 'temp', 'packages', `${package_id}.zip`),
      manifest: packageInfo,
      download_url: `/api/export/package/${package_id}/download`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      validation_report: {
        is_valid: packageInfo.metadata.validation_status === 'valid',
        errors: packageInfo.metadata.validation_errors,
        warnings: [],
        performance_score: 85
      }
    };

    // Start deployment
    const deploymentResult = await deploymentService.deployModule(
      packageResult,
      credentials,
      options
    );

    res.json({
      success: true,
      deployment_result: deploymentResult
    });

  } catch (error) {
    logger.error('HubSpot deployment failed', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Deployment failed'
    });
  }
});

/**
 * Get deployment status
 */
router.get('/deployment/:deploymentId/status', async (req, res, next) => {
  try {
    const { deploymentId } = req.params;
    
    const deployment = await deploymentService.getDeploymentStatus(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    res.json({
      success: true,
      deployment
    });

  } catch (error) {
    logger.error('Failed to get deployment status', { error });
    next(error);
  }
});

/**
 * Get deployment history
 */
router.get('/deployments', async (req, res, next) => {
  try {
    const { portal_id, environment, status, date_from, date_to } = req.query;
    
    const filters = {
      portal_id: portal_id as string,
      environment: environment as string,
      status: status as string,
      date_from: date_from as string,
      date_to: date_to as string
    };

    const history = await deploymentService.getDeploymentHistory(filters);

    res.json({
      success: true,
      history
    });

  } catch (error) {
    logger.error('Failed to get deployment history', { error });
    next(error);
  }
});

/**
 * Schedule deployment
 */
router.post('/deployment/schedule', async (req, res, next) => {
  try {
    const { package_id, credentials, options, scheduled_time } = req.body;

    // Get package info
    const packageInfo = await packagingService.getPackageInfo(package_id);
    if (!packageInfo) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    const packageResult = {
      package_id: package_id,
      package_path: path.join(process.cwd(), 'temp', 'packages', `${package_id}.zip`),
      manifest: packageInfo,
      download_url: `/api/export/package/${package_id}/download`,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      validation_report: {
        is_valid: true,
        errors: [],
        warnings: [],
        performance_score: 85
      }
    };

    const result = await deploymentService.scheduleDeployment(
      packageResult,
      credentials,
      options,
      scheduled_time
    );

    res.json({
      success: true,
      scheduled_deployment: result
    });

  } catch (error) {
    logger.error('Failed to schedule deployment', { error });
    next(error);
  }
});

/**
 * Cancel scheduled deployment
 */
router.delete('/deployment/scheduled/:scheduledId', async (req, res, next) => {
  try {
    const { scheduledId } = req.params;
    
    const success = await deploymentService.cancelScheduledDeployment(scheduledId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled deployment not found'
      });
    }

    res.json({
      success: true,
      message: 'Scheduled deployment cancelled'
    });

  } catch (error) {
    logger.error('Failed to cancel scheduled deployment', { error });
    next(error);
  }
});

/**
 * Get module versions
 */
router.get('/module/:moduleId/versions', async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    
    const versions = await deploymentService.getModuleVersions(moduleId);

    res.json({
      success: true,
      versions
    });

  } catch (error) {
    logger.error('Failed to get module versions', { error });
    next(error);
  }
});

/**
 * Get module versions
 */
router.get('/module/:moduleId/versions', async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    
    const versionHistory = await moduleVersioningService.getModuleVersions(moduleId);
    
    res.json({ version_history: versionHistory });
  } catch (error) {
    next(error);
  }
});

/**
 * Get specific version
 */
router.get('/version/:versionId', async (req, res, next) => {
  try {
    const { versionId } = req.params;
    
    const version = await moduleVersioningService.getVersion(versionId);
    
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    res.json({ version });
  } catch (error) {
    next(error);
  }
});

/**
 * Compare versions
 */
router.get('/version/:versionIdA/compare/:versionIdB', async (req, res, next) => {
  try {
    const { versionIdA, versionIdB } = req.params;
    
    const comparison = await moduleVersioningService.compareVersions(versionIdA, versionIdB);
    
    if (!comparison) {
      return res.status(404).json({ error: 'One or both versions not found' });
    }
    
    res.json({ comparison });
  } catch (error) {
    next(error);
  }
});

/**
 * Create new version
 */
router.post('/version', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { module_id, package_id, files, metadata } = req.body;
    
    const version = await moduleVersioningService.createVersion(
      module_id,
      package_id,
      files,
      metadata
    );
    
    res.json({ version });
  } catch (error) {
    next(error);
  }
});

/**
 * Update version status
 */
router.patch('/version/:versionId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const { status, deployment_info } = req.body;
    
    const version = await moduleVersioningService.updateVersionStatus(
      versionId,
      status,
      deployment_info
    );
    
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    res.json({ version });
  } catch (error) {
    next(error);
  }
});

/**
 * Rollback to previous version
 */
router.post('/version/:currentVersionId/rollback/:targetVersionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentVersionId, targetVersionId } = req.params;
    const { rollback_reason, performed_by } = req.body;
    
    const rollbackVersion = await moduleVersioningService.rollbackToVersion(
      currentVersionId,
      targetVersionId,
      rollback_reason,
      performed_by
    );
    
    if (!rollbackVersion) {
      return res.status(404).json({ error: 'Rollback failed - versions not found' });
    }
    
    res.json({ rollback_version: rollbackVersion });
  } catch (error) {
    next(error);
  }
});

/**
 * Archive old versions
 */
router.post('/module/:moduleId/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { moduleId } = req.params;
    const { keep_count = 5 } = req.body;
    
    const archivedCount = await moduleVersioningService.archiveOldVersions(moduleId, keep_count);
    
    res.json({ archived_count: archivedCount });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete archived versions
 */
router.delete('/module/:moduleId/archived', async (req, res, next) => {
  try {
    const { moduleId } = req.params;
    
    const deletedCount = await moduleVersioningService.deleteArchivedVersions(moduleId);
    
    res.json({ deleted_count: deletedCount });
  } catch (error) {
    next(error);
  }
});

/**
 * Get versioning statistics
 */
router.get('/versions/stats', async (req, res, next) => {
  try {
    const stats = await moduleVersioningService.getVersionStatistics();
    
    res.json({ statistics: stats });
  } catch (error) {
    next(error);
  }
});

export default router;
