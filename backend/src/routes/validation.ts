/**
 * Pre-delivery Validation Endpoints
 * API endpoints for validating modules before delivery
 * Ensures modules meet HubSpot's requirements and standards
 */

import express from 'express';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { HTMLValidator } from '../services/quality/validation/HTMLValidator';
import { ModuleBuilder } from '../services/hubspot/modules/ModuleBuilder';
import { schemaUpdateService } from '../services/schema/SchemaUpdateService';
import { schemaDiffDetector } from '../services/schema/SchemaDiffDetector';

// Legacy compatibility - using HTMLValidator for validation
const HubSpotValidationService = HTMLValidator;
type ValidationResult = any;

const router = express.Router();
const logger = createLogger();
const validationService = HubSpotValidationService.getInstance();

export interface ValidationRequest {
  module: {
    fields: any[];
    meta: any;
    template: string;
  };
  validation_level: 'basic' | 'standard' | 'comprehensive';
  include_performance: boolean;
  include_accessibility: boolean;
  schema_version?: string;
}

export interface ValidationResponse {
  validation_id: string;
  status: 'passed' | 'failed' | 'warning';
  overall_score: number;
  validation_result: ValidationResult;
  schema_compatibility: {
    compatible: boolean;
    schema_version: string;
    issues: string[];
  };
  recommendations: string[];
  estimated_fix_time: number;
  next_steps: string[];
}

export interface BatchValidationRequest {
  modules: Array<{
    module_id: string;
    module: ValidationRequest['module'];
  }>;
  validation_options: {
    validation_level: 'basic' | 'standard' | 'comprehensive';
    include_performance: boolean;
    include_accessibility: boolean;
    fail_fast: boolean;
  };
}

export interface BatchValidationResponse {
  batch_id: string;
  total_modules: number;
  validated_modules: number;
  passed_modules: number;
  failed_modules: number;
  warning_modules: number;
  overall_batch_score: number;
  results: Array<{
    module_id: string;
    validation_response: ValidationResponse;
  }>;
  batch_summary: {
    common_issues: string[];
    recommendations: string[];
    estimated_total_fix_time: number;
  };
}

/**
 * Validate a single module before delivery
 */
router.post('/validate', async (req, res, next) => {
  try {
    const requestBody = req.body;
    const validationId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Handle different request body structures
    let moduleData;
    let validationLevel = 'standard';
    
    if (requestBody.module) {
      // Standard structure: { module: {...}, validation_level: '...' }
      moduleData = requestBody.module;
      validationLevel = requestBody.validation_level || 'standard';
    } else if (requestBody.fields || requestBody.meta || requestBody.template) {
      // Direct structure: { fields: [...], meta: {...}, template: '...' }
      moduleData = {
        fields: requestBody.fields || [],
        meta: requestBody.meta || {},
        template: requestBody.template || ''
      };
      validationLevel = requestBody.validation_level || 'standard';
    } else {
      throw createError(
        'Invalid validation request: missing module data',
        400,
        'INPUT_INVALID',
        'Request must include module data (fields, meta, template)',
        'Provide module data either in module object or directly in request body'
      );
    }
    
    logger.info('Starting module validation', {
      validationId,
      validationLevel,
      fieldsCount: moduleData.fields?.length || 0,
      hasFields: !!moduleData.fields,
      hasMeta: !!moduleData.meta,
      hasTemplate: !!moduleData.template
    });

    // Validate module structure
    if (!moduleData.fields && !moduleData.meta && !moduleData.template) {
      throw createError(
        'Invalid validation request: missing required module components',
        400,
        'INPUT_INVALID',
        'Module must include at least one of: fields, meta, or template',
        'Ensure module data is properly structured'
      );
    }
    
    const validationRequest: ValidationRequest = {
      module: {
        fields: moduleData.fields || [],
        meta: moduleData.meta || {},
        template: moduleData.template || ''
      },
      validation_level: validationLevel as 'basic' | 'standard' | 'comprehensive',
      include_performance: requestBody.include_performance || false,
      include_accessibility: requestBody.include_accessibility || false,
      schema_version: requestBody.schema_version
    };

    // Get current schema for compatibility check
    const currentSchema = schemaUpdateService.getCurrentSchema();
    const targetSchemaVersion = validationRequest.schema_version || currentSchema?.version || 'latest';

    // Perform validation
    const validationResult = await validationService.validateModule({
      fields: validationRequest.module.fields,
      meta: validationRequest.module.meta,
      template: validationRequest.module.template
    });

    // Check schema compatibility
    const schemaCompatibility = await checkSchemaCompatibility(
      validationRequest.module,
      targetSchemaVersion,
      currentSchema
    );

    // Generate recommendations
    const recommendations = generateRecommendations(validationResult, schemaCompatibility);

    // Calculate estimated fix time
    const estimatedFixTime = calculateEstimatedFixTime(validationResult);

    // Determine overall status
    const status = determineValidationStatus(validationResult, schemaCompatibility);

    // Generate next steps
    const nextSteps = generateNextSteps(status, validationResult, recommendations);

    const response: ValidationResponse = {
      validation_id: validationId,
      status,
      overall_score: validationResult.score,
      validation_result: validationResult,
      schema_compatibility: schemaCompatibility,
      recommendations,
      estimated_fix_time: estimatedFixTime,
      next_steps: nextSteps
    };

    logger.info('Module validation completed', {
      validationId,
      status,
      score: validationResult.score,
      errorsCount: validationResult.errors.length,
      warningsCount: validationResult.warnings.length
    });

    res.json(response);

  } catch (error) {
    logger.error('Module validation failed', { error });
    next(error);
  }
});

/**
 * Validate multiple modules in batch
 */
router.post('/validate-batch', async (req, res, next) => {
  try {
    const batchRequest: BatchValidationRequest = req.body;
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Starting batch validation', {
      batchId,
      totalModules: batchRequest.modules.length,
      validationLevel: batchRequest.validation_options.validation_level
    });

    if (!batchRequest.modules || batchRequest.modules.length === 0) {
      throw createError(
        'Invalid batch validation request: no modules provided',
        400,
        'INPUT_INVALID',
        'At least one module must be provided for batch validation',
        'Include modules array with at least one module'
      );
    }

    const results: BatchValidationResponse['results'] = [];
    let passedCount = 0;
    let failedCount = 0;
    let warningCount = 0;
    const allIssues: string[] = [];
    let totalFixTime = 0;

    // Process each module
    for (const moduleRequest of batchRequest.modules) {
      try {
        // Create individual validation request
        const individualRequest: ValidationRequest = {
          module: moduleRequest.module,
          validation_level: batchRequest.validation_options.validation_level,
          include_performance: batchRequest.validation_options.include_performance,
          include_accessibility: batchRequest.validation_options.include_accessibility
        };

        // Validate module (reuse logic from single validation)
        const validationResult = await validationService.validateModule(moduleRequest.module);
        const currentSchema = schemaUpdateService.getCurrentSchema();
        const schemaCompatibility = await checkSchemaCompatibility(
          moduleRequest.module,
          currentSchema?.version || 'latest',
          currentSchema
        );

        const recommendations = generateRecommendations(validationResult, schemaCompatibility);
        const estimatedFixTime = calculateEstimatedFixTime(validationResult);
        const status = determineValidationStatus(validationResult, schemaCompatibility);
        const nextSteps = generateNextSteps(status, validationResult, recommendations);

        const moduleResponse: ValidationResponse = {
          validation_id: `${batchId}_${moduleRequest.module_id}`,
          status,
          overall_score: validationResult.score,
          validation_result: validationResult,
          schema_compatibility: schemaCompatibility,
          recommendations,
          estimated_fix_time: estimatedFixTime,
          next_steps: nextSteps
        };

        results.push({
          module_id: moduleRequest.module_id,
          validation_response: moduleResponse
        });

        // Update counters
        if (status === 'passed') passedCount++;
        else if (status === 'failed') failedCount++;
        else warningCount++;

        // Collect issues for batch summary
        allIssues.push(...validationResult.errors.map(e => e.message));
        allIssues.push(...validationResult.warnings.map(w => w.message));
        totalFixTime += estimatedFixTime;

        // Fail fast if enabled and module failed
        if (batchRequest.validation_options.fail_fast && status === 'failed') {
          logger.info('Batch validation stopped due to fail-fast mode', {
            batchId,
            failedModuleId: moduleRequest.module_id
          });
          break;
        }

      } catch (error) {
        logger.error('Module validation failed in batch', {
          batchId,
          moduleId: moduleRequest.module_id,
          error
        });

        // Add error result
        results.push({
          module_id: moduleRequest.module_id,
          validation_response: {
            validation_id: `${batchId}_${moduleRequest.module_id}`,
            status: 'failed',
            overall_score: 0,
            validation_result: {
              valid: false,
              score: 0,
              errors: [{
                type: 'CRITICAL' as any,
                category: 'SYNTAX' as any,
                code: 'VALIDATION_ERROR',
                message: (error as Error).message,
                fix: 'Check module structure and fix errors'
              }],
              warnings: [],
              suggestions: [],
              metrics: {
                complexity_score: 0,
                accessibility_score: 0,
                performance_score: 0,
                maintainability_score: 0
              }
            },
            schema_compatibility: {
              compatible: false,
              schema_version: 'unknown',
              issues: ['Validation failed']
            },
            recommendations: ['Fix validation errors and retry'],
            estimated_fix_time: 2,
            next_steps: ['Review error details', 'Fix issues', 'Retry validation']
          }
        });

        failedCount++;
      }
    }

    // Generate batch summary
    const commonIssues = findCommonIssues(allIssues);
    const batchRecommendations = generateBatchRecommendations(results);
    const overallBatchScore = results.reduce((sum, r) => sum + r.validation_response.overall_score, 0) / results.length;

    const batchResponse: BatchValidationResponse = {
      batch_id: batchId,
      total_modules: batchRequest.modules.length,
      validated_modules: results.length,
      passed_modules: passedCount,
      failed_modules: failedCount,
      warning_modules: warningCount,
      overall_batch_score: overallBatchScore,
      results,
      batch_summary: {
        common_issues: commonIssues,
        recommendations: batchRecommendations,
        estimated_total_fix_time: totalFixTime
      }
    };

    logger.info('Batch validation completed', {
      batchId,
      totalModules: batchRequest.modules.length,
      validatedModules: results.length,
      passedModules: passedCount,
      failedModules: failedCount,
      overallScore: overallBatchScore
    });

    res.json(batchResponse);

  } catch (error) {
    logger.error('Batch validation failed', { error });
    next(error);
  }
});

/**
 * Get validation status for a specific validation
 */
router.get('/status/:validationId', async (req, res, next) => {
  try {
    const { validationId } = req.params;
    
    // In a real implementation, this would query a database for validation status
    // For now, return a mock response
    res.json({
      validation_id: validationId,
      status: 'completed',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      result_available: true
    });

  } catch (error) {
    logger.error('Failed to get validation status', { error });
    next(error);
  }
});

/**
 * Get current schema information
 */
router.get('/schema', async (req, res, next) => {
  try {
    const currentSchema = schemaUpdateService.getCurrentSchema();
    
    if (!currentSchema) {
      throw createError(
        'No schema available',
        404,
        'INTERNAL_ERROR',
        'Schema has not been loaded or updated',
        'Run schema update to load the latest schema'
      );
    }

    res.json({
      version: currentSchema.version,
      last_updated: currentSchema.lastUpdated,
      field_types: currentSchema.fieldTypes.map(ft => ({
        type: ft.type,
        label: ft.label,
        deprecated: ft.deprecated
      })),
      content_types: currentSchema.contentTypes,
      module_requirements: currentSchema.moduleRequirements
    });

  } catch (error) {
    logger.error('Failed to get schema information', { error });
    next(error);
  }
});

/**
 * Check schema compatibility for a module
 */
async function checkSchemaCompatibility(module: any, targetVersion: string, currentSchema: any) {
  const issues: string[] = [];
  
  if (!currentSchema) {
    issues.push('No schema available for compatibility check');
    return {
      compatible: false,
      schema_version: targetVersion,
      issues
    };
  }

  // Check field types compatibility
  const validFieldTypes = new Set(currentSchema.fieldTypes.map((ft: any) => ft.type));
  for (const field of module.fields) {
    if (!validFieldTypes.has(field.type)) {
      issues.push(`Unknown field type: ${field.type}`);
    }
  }

  // Check content types compatibility
  if (module.meta.content_types) {
    const validContentTypes = new Set(currentSchema.contentTypes);
    for (const contentType of module.meta.content_types) {
      if (!validContentTypes.has(contentType)) {
        issues.push(`Unknown content type: ${contentType}`);
      }
    }
  }

  return {
    compatible: issues.length === 0,
    schema_version: currentSchema.version,
    issues
  };
}

/**
 * Generate recommendations based on validation results
 */
function generateRecommendations(validationResult: ValidationResult, schemaCompatibility: any): string[] {
  const recommendations: string[] = [];

  if (validationResult.errors.length > 0) {
    recommendations.push('Fix critical errors before deployment');
  }

  if (validationResult.warnings.length > 0) {
    recommendations.push('Address warnings to improve module quality');
  }

  if (validationResult.score < 80) {
    recommendations.push('Improve module quality to achieve higher score');
  }

  if (!schemaCompatibility.compatible) {
    recommendations.push('Update module to be compatible with current schema');
  }

  if (validationResult.metrics.accessibility_score < 80) {
    recommendations.push('Improve accessibility features');
  }

  if (validationResult.metrics.performance_score < 80) {
    recommendations.push('Optimize for better performance');
  }

  return recommendations;
}

/**
 * Calculate estimated time to fix issues
 */
function calculateEstimatedFixTime(validationResult: ValidationResult): number {
  let estimatedHours = 0;

  // Critical errors: 2 hours each
  estimatedHours += validationResult.errors.filter(e => e.type === 'CRITICAL').length * 2;
  
  // High priority errors: 1 hour each
  estimatedHours += validationResult.errors.filter(e => e.type === 'HIGH').length * 1;
  
  // Medium warnings: 0.5 hours each
  estimatedHours += validationResult.warnings.filter(w => w.type === 'MEDIUM').length * 0.5;
  
  // Low priority items: 0.25 hours each
  estimatedHours += validationResult.warnings.filter(w => w.type === 'LOW').length * 0.25;

  return Math.max(0.5, estimatedHours); // Minimum 30 minutes
}

/**
 * Determine overall validation status
 */
function determineValidationStatus(validationResult: ValidationResult, schemaCompatibility: any): 'passed' | 'failed' | 'warning' {
  if (validationResult.errors.length > 0 || !schemaCompatibility.compatible) {
    return 'failed';
  }
  
  if (validationResult.warnings.length > 0 || validationResult.score < 90) {
    return 'warning';
  }
  
  return 'passed';
}

/**
 * Generate next steps based on validation status
 */
function generateNextSteps(status: string, validationResult: ValidationResult, recommendations: string[]): string[] {
  const steps: string[] = [];

  if (status === 'failed') {
    steps.push('Review and fix all critical errors');
    steps.push('Address schema compatibility issues');
    steps.push('Re-run validation after fixes');
  } else if (status === 'warning') {
    steps.push('Review warnings and recommendations');
    steps.push('Consider implementing suggested improvements');
    steps.push('Module is ready for deployment with current quality level');
  } else {
    steps.push('Module passed all validations');
    steps.push('Ready for deployment');
    steps.push('Consider monitoring performance after deployment');
  }

  return steps;
}

/**
 * Find common issues across multiple modules
 */
function findCommonIssues(allIssues: string[]): string[] {
  const issueCounts = new Map<string, number>();
  
  for (const issue of allIssues) {
    issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
  }

  // Return issues that appear in more than one module
  return Array.from(issueCounts.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) // Top 5 most common issues
    .map(([issue, _]) => issue);
}

/**
 * Generate batch-level recommendations
 */
function generateBatchRecommendations(results: BatchValidationResponse['results']): string[] {
  const recommendations: string[] = [];
  
  const failedCount = results.filter(r => r.validation_response.status === 'failed').length;
  const warningCount = results.filter(r => r.validation_response.status === 'warning').length;
  
  if (failedCount > 0) {
    recommendations.push(`${failedCount} modules failed validation and need fixes`);
  }
  
  if (warningCount > 0) {
    recommendations.push(`${warningCount} modules have warnings that should be addressed`);
  }
  
  const avgScore = results.reduce((sum, r) => sum + r.validation_response.overall_score, 0) / results.length;
  if (avgScore < 80) {
    recommendations.push('Overall batch quality is below recommended threshold');
  }
  
  recommendations.push('Review common issues to identify systematic problems');
  recommendations.push('Consider implementing automated fixes for recurring issues');
  
  return recommendations;
}

export default router;
