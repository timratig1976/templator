import express from 'express';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { HTMLQualityService, ValidationResult } from '../services/quality/HTMLQualityService';
import AIQualityValidator, { AIValidationResult } from '../services/quality/AIQualityValidator';
import PromptOptimizationService, { ImprovedPrompt } from '../services/ai/PromptOptimizationService';
import PromptStorageService from '../services/ai/PromptStorageService';
import { v4 as uuid } from 'uuid';
import { logToFrontend } from '../utils/frontendLogger';

const router = express.Router();
const logger = createLogger();
const htmlQualityService = HTMLQualityService.getInstance();
const aiQualityValidator = AIQualityValidator.getInstance();
const promptOptimizationService = PromptOptimizationService.getInstance();
const promptStorageService = new PromptStorageService();

/**
 * Validate HTML with both rules-based and AI-powered validators
 * POST /api/html-validation
 */
router.post('/', async (req, res, next) => {
  try {
    const { html, sectionName, pipelineId, sectionId, originalPrompt } = req.body;
    const validationId = uuid();
    const requestId = req.headers['x-request-id'] as string || validationId;
    
    if (!html) {
      throw createError(
        'Missing HTML content',
        400,
        'INPUT_INVALID',
        'HTML content is required',
        'Please provide HTML content to validate'
      );
    }
    
    logger.info('Starting comprehensive HTML validation', {
      sectionName: sectionName || 'unknown',
      htmlLength: html.length,
      requestId,
      pipelineId,
      sectionId
    });
    
    logToFrontend('info', 'validation', `🔍 Starting HTML quality validation for ${sectionName || 'content'}...`, {
      sectionName,
      htmlLength: html.length
    }, requestId);
    
    // Step 1: Run rules-based validation
    const rulesValidationStart = Date.now();
    const rulesValidationResult = htmlQualityService.validateHTML(html);
    const rulesValidationTime = Date.now() - rulesValidationStart;
    
    logger.debug('Rules-based validation complete', {
      score: rulesValidationResult.score,
      issuesCount: rulesValidationResult.issues.length,
      validationTime: rulesValidationTime,
      requestId
    });
    
    // Step 2: Run AI-powered validation
    const aiValidationStart = Date.now();
    const aiValidationResult = await aiQualityValidator.validateWithOpenAI(
      html,
      sectionName || 'section',
      requestId
    );
    const aiValidationTime = Date.now() - aiValidationStart;
    
    logger.debug('AI-powered validation complete', {
      score: aiValidationResult.score,
      issuesCount: aiValidationResult.issues.length,
      validationTime: aiValidationTime,
      requestId
    });
    
    // Step 3: Combine validation results
    const combinedIssues = [
      ...rulesValidationResult.issues,
      ...aiValidationResult.issues.filter(issue => 
        !rulesValidationResult.issues.some(
          rIssue => 
            rIssue.category === issue.category && 
            rIssue.message === issue.message
        )
      )
    ];
    
    // Calculate weighted average score, favoring AI validation slightly
    const combinedScore = Math.round(
      (rulesValidationResult.score * 0.4) + 
      (aiValidationResult.score * 0.6)
    );
    
    const combinedMetrics = {
      semanticsScore: Math.round(
        (rulesValidationResult.metrics.semanticsScore * 0.4) + 
        (aiValidationResult.metrics.semanticsScore * 0.6)
      ),
      tailwindScore: Math.round(
        (rulesValidationResult.metrics.tailwindScore * 0.4) + 
        (aiValidationResult.metrics.tailwindScore * 0.6)
      ),
      accessibilityScore: Math.round(
        (rulesValidationResult.metrics.accessibilityScore * 0.4) + 
        (aiValidationResult.metrics.accessibilityScore * 0.6)
      ),
      responsiveScore: Math.round(
        (rulesValidationResult.metrics.responsiveScore * 0.4) + 
        (aiValidationResult.metrics.responsiveScore * 0.6)
      )
    };
    
    interface ExtendedValidationResult extends ValidationResult {
      validationId: string;
      reasoning: string;
      suggestions: string[];
      performanceMetrics: {
        rulesValidationTime: number;
        aiValidationTime: number;
        totalValidationTime: number;
      };
      improvedPrompt?: ImprovedPrompt;
    }
    
    const combinedResult: ExtendedValidationResult = {
      validationId,
      valid: combinedScore >= 70,
      score: combinedScore,
      issues: combinedIssues,
      metrics: combinedMetrics,
      reasoning: aiValidationResult.reasoning || '',
      suggestions: aiValidationResult.suggestions || [],
      performanceMetrics: {
        rulesValidationTime,
        aiValidationTime,
        totalValidationTime: rulesValidationTime + aiValidationTime
      }
    };
    
    logger.info('Combined HTML validation complete', {
      validationId,
      score: combinedResult.score,
      issuesCount: combinedResult.issues.length,
      requestId
    });
    
    logToFrontend('success', 'validation', `✅ HTML quality validation complete: Score ${combinedResult.score}/100`, {
      score: combinedResult.score,
      issues: combinedResult.issues.length,
      metrics: combinedResult.metrics
    }, requestId);
    
    // Step 4: If original prompt was provided, improve it based on validation results
    if (originalPrompt && pipelineId) {
      try {
        const improvedPromptResult = await promptOptimizationService.improvePromptBasedOnFeedback(
          originalPrompt,
          html,
          combinedResult,
          requestId
        );
        
        // Store the improved prompt for future use
        logger.debug('Prompt improved based on validation feedback', {
          originalPromptLength: originalPrompt.length,
          improvedPromptLength: improvedPromptResult.improvedPrompt.length,
          improvementCount: improvedPromptResult.improvements.length,
          variationId: improvedPromptResult.variationId,
          requestId
        });
        
        // Store prompt and result data if pipelineId is provided
        if (pipelineId) {
          await promptStorageService.storePromptData(
            pipelineId,
            {
              content: originalPrompt,
              model: 'gpt-4o',
              temperature: 0.7,
              tokenCount: Math.ceil(originalPrompt.length / 4), // Rough estimate
              promptType: 'tailwind4-html'
            },
            {
              content: html,
              generationTime: 0, // Not available here
              qualityScore: combinedResult.score,
              section: sectionName || 'unknown'
            },
            sectionId,
            combinedResult.metrics
          );
        }
        
        // Include improved prompt in response
        combinedResult.improvedPrompt = improvedPromptResult;
      } catch (error) {
        logger.error('Failed to improve prompt', {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId
        });
      }
    }
    
    // Return the combined validation result
    res.json(combinedResult);
  } catch (error) {
    logger.error('HTML validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(error);
  }
});

/**
 * Get validation metrics for a specific validation ID
 * GET /api/html-validation/:validationId
 */
router.get('/:validationId', async (req, res, next) => {
  try {
    const { validationId } = req.params;
    
    // In a real implementation, we would look up the validation result
    // from a database or cache using the validationId
    
    res.status(404).json({
      error: 'Validation result not found',
      message: 'The requested validation result could not be found'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update metrics for a prompt variation after use
 * POST /api/html-validation/metrics
 */
router.post('/metrics', async (req, res, next) => {
  try {
    const { variationId, qualityScore } = req.body;
    
    if (!variationId || qualityScore === undefined) {
      throw createError(
        'Missing required fields',
        400,
        'INPUT_INVALID',
        'variationId and qualityScore are required',
        'Please provide both variationId and qualityScore'
      );
    }
    
    // Update metrics for the prompt variation
    promptOptimizationService.updatePromptMetrics(variationId, qualityScore);
    
    res.json({
      success: true,
      message: 'Prompt metrics updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
