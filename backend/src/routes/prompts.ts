import express from 'express';
import { createError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import PromptStorageService from '../services/ai/PromptStorageService';

const router = express.Router();
const logger = createLogger();
const promptStorageService = new PromptStorageService();

/**
 * Get prompt and result data for a specific pipeline execution
 * GET /api/pipeline-prompts/:pipelineId
 */
router.get('/:pipelineId', async (req, res, next) => {
  try {
    const { pipelineId } = req.params;
    const { sectionId } = req.query;
    
    logger.info('Fetching prompt data', {
      pipelineId,
      sectionId: sectionId as string | undefined
    });
    
    const promptData = await promptStorageService.getPromptAndResultData(
      pipelineId,
      sectionId as string | undefined
    );
    
    if (!promptData) {
      throw createError(
        'Prompt data not found',
        404,
        'INTERNAL_ERROR',
        `No prompt data found for pipeline ID ${pipelineId}`,
        'The requested prompt data could not be found'
      );
    }
    
    res.json(promptData);
  } catch (error) {
    next(error);
  }
});

/**
 * Store prompt data for later retrieval
 * POST /api/pipeline-prompts
 */
router.post('/', async (req, res, next) => {
  try {
    const { pipelineId, sectionId, promptData, resultData, metrics } = req.body;
    
    if (!pipelineId) {
      throw createError(
        'Missing required fields',
        400,
        'INPUT_INVALID',
        'pipelineId is required',
        'Please provide all required fields'
      );
    }
    
    logger.info('Storing prompt data', {
      pipelineId,
      sectionId
    });
    
    await promptStorageService.storePromptData(
      pipelineId,
      promptData,
      resultData,
      sectionId,
      metrics
    );
    
    res.status(201).json({
      success: true,
      message: 'Prompt data stored successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete prompt data
 * DELETE /api/pipeline-prompts/:pipelineId
 */
router.delete('/:pipelineId', async (req, res, next) => {
  try {
    const { pipelineId } = req.params;
    const { sectionId } = req.query;
    
    logger.info('Deleting prompt data', {
      pipelineId,
      sectionId: sectionId as string | undefined
    });
    
    await promptStorageService.deletePromptData(
      pipelineId,
      sectionId as string | undefined
    );
    
    res.json({
      success: true,
      message: 'Prompt data deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
