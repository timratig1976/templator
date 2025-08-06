/**
 * Layout Splitting API Routes
 * Handles large layout file splitting and sequential processing
 */

import express from 'express';
import { z } from 'zod';
import { validateZodRequest } from '../middleware/unifiedValidation';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { layoutSectionSplittingService } from '../services/analysis/LayoutSectionSplittingService';
import { sequentialSectionProcessingService } from '../services/analysis/SequentialSectionProcessingService';

const router = express.Router();
const logger = createLogger();

// Request schemas
const splitLayoutSchema = z.object({
  html: z.string().min(100, 'HTML must be at least 100 characters'),
  options: z.object({
    maxSectionSize: z.number().optional(),
    minSectionSize: z.number().optional(),
    preserveStructure: z.boolean().optional(),
    detectComponents: z.boolean().optional(),
    splitStrategy: z.enum(['semantic', 'size', 'hybrid']).optional(),
    maxSections: z.number().optional()
  }).optional()
});

const processLayoutSchema = z.object({
  html: z.string().min(100, 'HTML must be at least 100 characters'),
  splittingOptions: z.object({
    maxSectionSize: z.number().optional(),
    minSectionSize: z.number().optional(),
    preserveStructure: z.boolean().optional(),
    detectComponents: z.boolean().optional(),
    splitStrategy: z.enum(['semantic', 'size', 'hybrid']).optional(),
    maxSections: z.number().optional()
  }).optional(),
  processingOptions: z.object({
    batchSize: z.number().optional(),
    maxRetries: z.number().optional(),
    skipFailedSections: z.boolean().optional(),
    combineResults: z.boolean().optional(),
    qualityThreshold: z.number().min(0).max(100).optional(),
    timeoutPerSection: z.number().optional(),
    enableRefinement: z.boolean().optional(),
    enableAutoCorrection: z.boolean().optional()
  }).optional()
});

const processSectionsSchema = z.object({
  sections: z.array(z.object({
    id: z.string(),
    type: z.enum(['header', 'hero', 'content', 'sidebar', 'footer', 'navigation', 'feature', 'testimonial', 'contact', 'gallery', 'unknown']),
    html: z.string(),
    title: z.string(),
    description: z.string(),
    complexity: z.enum(['low', 'medium', 'high']),
    estimatedFields: z.number(),
    dependencies: z.array(z.string()),
    priority: z.number()
  })),
  totalSections: z.number(),
  estimatedProcessingTime: z.number(),
  recommendedBatchSize: z.number(),
  metadata: z.object({
    originalSize: z.number(),
    averageSectionSize: z.number(),
    complexitySummary: z.record(z.number())
  }),
  processingOptions: z.object({
    batchSize: z.number().optional(),
    maxRetries: z.number().optional(),
    skipFailedSections: z.boolean().optional(),
    combineResults: z.boolean().optional(),
    qualityThreshold: z.number().min(0).max(100).optional(),
    timeoutPerSection: z.number().optional(),
    enableRefinement: z.boolean().optional(),
    enableAutoCorrection: z.boolean().optional()
  }).optional()
});

/**
 * POST /api/layout/split
 * Split a large layout file into manageable sections
 */
router.post('/split', validateZodRequest(splitLayoutSchema), async (req, res, next) => {
  try {
    const { html, options = {} } = req.body;

    logger.info('Layout splitting requested', {
      htmlSize: html.length,
      options
    });

    const splittingResult = await layoutSectionSplittingService.splitLayout(html, options);

    logger.info('Layout splitting completed', {
      totalSections: splittingResult.totalSections,
      estimatedTime: splittingResult.estimatedProcessingTime,
      batchSize: splittingResult.recommendedBatchSize
    });

    res.json({
      success: true,
      data: splittingResult,
      message: `Successfully split layout into ${splittingResult.totalSections} sections`
    });

  } catch (error) {
    logger.error('Layout splitting failed', { error });
    next(error);
  }
});

/**
 * POST /api/layout/process
 * Split layout and process all sections sequentially
 */
router.post('/process', validateZodRequest(processLayoutSchema), async (req, res, next) => {
  try {
    const { html, splittingOptions = {}, processingOptions = {} } = req.body;

    logger.info('Layout processing requested', {
      htmlSize: html.length,
      splittingOptions,
      processingOptions
    });

    // First, split the layout
    const splittingResult = await layoutSectionSplittingService.splitLayout(html, splittingOptions);

    logger.info('Layout split completed, starting processing', {
      totalSections: splittingResult.totalSections
    });

    // Then process all sections
    const processingResult = await sequentialSectionProcessingService.processSections(
      splittingResult,
      processingOptions
    );

    logger.info('Layout processing completed', {
      totalSections: processingResult.totalSections,
      processed: processingResult.processedSections,
      failed: processingResult.failedSections,
      overallScore: processingResult.overallQualityScore
    });

    res.json({
      success: true,
      data: {
        splitting: splittingResult,
        processing: processingResult
      },
      message: `Successfully processed ${processingResult.processedSections}/${processingResult.totalSections} sections`
    });

  } catch (error) {
    logger.error('Layout processing failed', { error });
    next(error);
  }
});

/**
 * POST /api/layout/process-sections
 * Process pre-split sections sequentially
 */
router.post('/process-sections', validateZodRequest(processSectionsSchema), async (req, res, next) => {
  try {
    const { processingOptions = {}, ...splittingResult } = req.body;

    logger.info('Section processing requested', {
      totalSections: splittingResult.totalSections,
      processingOptions
    });

    const processingResult = await sequentialSectionProcessingService.processSections(
      splittingResult,
      processingOptions
    );

    logger.info('Section processing completed', {
      totalSections: processingResult.totalSections,
      processed: processingResult.processedSections,
      failed: processingResult.failedSections,
      overallScore: processingResult.overallQualityScore
    });

    res.json({
      success: true,
      data: processingResult,
      message: `Successfully processed ${processingResult.processedSections}/${processingResult.totalSections} sections`
    });

  } catch (error) {
    logger.error('Section processing failed', { error });
    next(error);
  }
});

/**
 * GET /api/layout/analyze/:size
 * Analyze if a layout size should be split
 */
router.get('/analyze/:size', async (req, res, next) => {
  try {
    const size = parseInt(req.params.size);
    
    if (isNaN(size) || size < 0) {
      throw createError(
        'Invalid size parameter',
        400,
        'INVALID_SIZE',
        'Size must be a positive number',
        'Provide a valid file size in bytes'
      );
    }

    // Analysis thresholds
    const SMALL_LAYOUT = 10000; // 10KB
    const MEDIUM_LAYOUT = 50000; // 50KB
    const LARGE_LAYOUT = 150000; // 150KB
    const VERY_LARGE_LAYOUT = 500000; // 500KB

    let recommendation: string;
    let shouldSplit: boolean;
    let estimatedSections: number;
    let estimatedProcessingTime: number;

    if (size < SMALL_LAYOUT) {
      recommendation = 'Process as single module';
      shouldSplit = false;
      estimatedSections = 1;
      estimatedProcessingTime = 30;
    } else if (size < MEDIUM_LAYOUT) {
      recommendation = 'Consider splitting for better quality';
      shouldSplit = false;
      estimatedSections = 2;
      estimatedProcessingTime = 60;
    } else if (size < LARGE_LAYOUT) {
      recommendation = 'Recommended to split into sections';
      shouldSplit = true;
      estimatedSections = Math.ceil(size / 25000);
      estimatedProcessingTime = estimatedSections * 45;
    } else if (size < VERY_LARGE_LAYOUT) {
      recommendation = 'Strongly recommended to split';
      shouldSplit = true;
      estimatedSections = Math.ceil(size / 30000);
      estimatedProcessingTime = estimatedSections * 60;
    } else {
      recommendation = 'Must split - too large for single processing';
      shouldSplit = true;
      estimatedSections = Math.ceil(size / 40000);
      estimatedProcessingTime = estimatedSections * 75;
    }

    const analysis = {
      fileSize: size,
      fileSizeFormatted: formatFileSize(size),
      shouldSplit,
      recommendation,
      estimatedSections,
      estimatedProcessingTime,
      estimatedProcessingTimeFormatted: formatTime(estimatedProcessingTime),
      qualityBenefit: shouldSplit ? 'High - Better field detection and validation' : 'Low - Single module processing',
      complexity: size > LARGE_LAYOUT ? 'High' : size > MEDIUM_LAYOUT ? 'Medium' : 'Low'
    };

    res.json({
      success: true,
      data: analysis,
      message: `Analysis completed for ${formatFileSize(size)} layout`
    });

  } catch (error) {
    logger.error('Layout analysis failed', { error });
    next(error);
  }
});

/**
 * GET /api/layout/status/:batchId
 * Get processing status for a batch
 */
router.get('/status/:batchId', async (req, res, next) => {
  try {
    const { batchId } = req.params;

    const status = await sequentialSectionProcessingService.getProcessingStatus(batchId);

    if (!status) {
      throw createError(
        'Batch not found',
        404,
        'BATCH_NOT_FOUND',
        `No processing batch found with ID: ${batchId}`,
        'Check the batch ID and try again'
      );
    }

    res.json({
      success: true,
      data: status,
      message: `Status retrieved for batch ${batchId}`
    });

  } catch (error) {
    logger.error('Status retrieval failed', { error });
    next(error);
  }
});

/**
 * DELETE /api/layout/cancel/:batchId
 * Cancel processing for a batch
 */
router.delete('/cancel/:batchId', async (req, res, next) => {
  try {
    const { batchId } = req.params;

    const cancelled = await sequentialSectionProcessingService.cancelProcessing(batchId);

    res.json({
      success: true,
      data: { cancelled, batchId },
      message: cancelled ? `Processing cancelled for batch ${batchId}` : `Could not cancel batch ${batchId}`
    });

  } catch (error) {
    logger.error('Processing cancellation failed', { error });
    next(error);
  }
});

/**
 * GET /api/layout/examples
 * Get example splitting configurations
 */
router.get('/examples', async (req, res, next) => {
  try {
    const examples = {
      'small-layout': {
        description: 'Small layout (< 10KB) - Single module processing',
        splittingOptions: {
          maxSectionSize: 50000,
          minSectionSize: 1000,
          splitStrategy: 'semantic' as const
        },
        processingOptions: {
          batchSize: 1,
          qualityThreshold: 80,
          enableRefinement: true,
          enableAutoCorrection: true
        }
      },
      'medium-layout': {
        description: 'Medium layout (10-50KB) - Light splitting',
        splittingOptions: {
          maxSectionSize: 30000,
          minSectionSize: 2000,
          splitStrategy: 'hybrid' as const,
          maxSections: 5
        },
        processingOptions: {
          batchSize: 2,
          qualityThreshold: 85,
          enableRefinement: true,
          enableAutoCorrection: true
        }
      },
      'large-layout': {
        description: 'Large layout (50-150KB) - Recommended splitting',
        splittingOptions: {
          maxSectionSize: 25000,
          minSectionSize: 1500,
          splitStrategy: 'hybrid' as const,
          maxSections: 10
        },
        processingOptions: {
          batchSize: 3,
          qualityThreshold: 75,
          enableRefinement: true,
          enableAutoCorrection: true,
          skipFailedSections: true
        }
      },
      'very-large-layout': {
        description: 'Very large layout (> 150KB) - Aggressive splitting',
        splittingOptions: {
          maxSectionSize: 20000,
          minSectionSize: 1000,
          splitStrategy: 'size' as const,
          maxSections: 20
        },
        processingOptions: {
          batchSize: 2,
          qualityThreshold: 70,
          enableRefinement: true,
          enableAutoCorrection: true,
          skipFailedSections: true,
          timeoutPerSection: 180
        }
      }
    };

    res.json({
      success: true,
      data: examples,
      message: 'Example configurations retrieved'
    });

  } catch (error) {
    logger.error('Examples retrieval failed', { error });
    next(error);
  }
});

// Helper functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export default router;
