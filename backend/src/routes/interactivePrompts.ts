import express from 'express';
import { InteractivePromptService } from '../services/prompts/InteractivePromptService';
import { createLogger } from '../utils/logger';

const router = express.Router();
const logger = createLogger();

// Service instance
let promptService: InteractivePromptService;

// Initialize service
async function initializeService() {
  if (!promptService) {
    promptService = new InteractivePromptService();
    await promptService.loadFromStorage();
  }
}

/**
 * GET /api/prompts/templates
 * Get all available prompt templates
 */
router.get('/templates', async (req, res) => {
  try {
    await initializeService();

    const templates = promptService.getTemplates();

    res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    logger.error('Error getting prompt templates', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get prompt templates'
    });
  }
});

/**
 * GET /api/prompts/templates/:templateId
 * Get specific prompt template
 */
router.get('/templates/:templateId', async (req, res) => {
  try {
    await initializeService();

    const { templateId } = req.params;
    const template = promptService.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });

  } catch (error) {
    logger.error('Error getting prompt template', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get prompt template'
    });
  }
});

/**
 * POST /api/prompts/templates
 * Create custom prompt template
 */
router.post('/templates', async (req, res) => {
  try {
    await initializeService();

    const { name, description, basePrompt, sectionType, tags } = req.body;

    if (!name || !description || !basePrompt) {
      return res.status(400).json({
        success: false,
        error: 'Name, description, and base prompt are required'
      });
    }

    const template = await promptService.createTemplate({
      name,
      description,
      basePrompt,
      sectionType,
      tags: tags ? tags.split(',').map((t: string) => t.trim()) : undefined
    });

    res.json({
      success: true,
      data: template
    });

  } catch (error) {
    logger.error('Error creating prompt template', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create prompt template'
    });
  }
});

/**
 * POST /api/prompts/templates/:templateId/contexts
 * Add context to template
 */
router.post('/templates/:templateId/contexts', async (req, res) => {
  try {
    await initializeService();

    const { templateId } = req.params;
    const { category, title, content, priority = 5, enabled = true } = req.body;

    if (!category || !title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Category, title, and content are required'
      });
    }

    const validCategories = ['design', 'accessibility', 'performance', 'hubspot', 'tailwind', 'custom'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `Category must be one of: ${validCategories.join(', ')}`
      });
    }

    const updatedTemplate = await promptService.addContextToTemplate(templateId, {
      category,
      title,
      content,
      priority: Number(priority),
      enabled: Boolean(enabled)
    });

    if (!updatedTemplate) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: updatedTemplate
    });

  } catch (error) {
    logger.error('Error adding context to template', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to add context to template'
    });
  }
});

/**
 * PUT /api/prompts/templates/:templateId/contexts/:contextId
 * Update context in template
 */
router.put('/templates/:templateId/contexts/:contextId', async (req, res) => {
  try {
    await initializeService();

    const { templateId, contextId } = req.params;
    const updates = req.body;

    const updatedTemplate = await promptService.updateContext(templateId, contextId, updates);

    if (!updatedTemplate) {
      return res.status(404).json({
        success: false,
        error: 'Template or context not found'
      });
    }

    res.json({
      success: true,
      data: updatedTemplate
    });

  } catch (error) {
    logger.error('Error updating context', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update context'
    });
  }
});

/**
 * POST /api/prompts/generate
 * Generate enhanced prompt with full visibility
 */
router.post('/generate', async (req, res) => {
  try {
    await initializeService();

    const { 
      templateId, 
      designFile, 
      sectionType, 
      pipelinePhase = 'ai_generation',
      userRequirements,
      customContexts 
    } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required'
      });
    }

    const generation = await promptService.generateInteractivePrompt(templateId, {
      designFile,
      sectionType,
      pipelinePhase,
      userRequirements,
      customContexts: customContexts ? JSON.parse(customContexts) : undefined
    });

    if (!generation) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: generation
    });

  } catch (error) {
    logger.error('Error generating interactive prompt', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate interactive prompt'
    });
  }
});

/**
 * GET /api/prompts/generations/:generationId
 * Get specific prompt generation
 */
router.get('/generations/:generationId', async (req, res) => {
  try {
    await initializeService();

    const { generationId } = req.params;
    const generation = promptService.getGeneration(generationId);

    if (!generation) {
      return res.status(404).json({
        success: false,
        error: 'Generation not found'
      });
    }

    res.json({
      success: true,
      data: generation
    });

  } catch (error) {
    logger.error('Error getting prompt generation', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get prompt generation'
    });
  }
});

/**
 * PUT /api/prompts/generations/:generationId/result
 * Update prompt generation with results
 */
router.put('/generations/:generationId/result', async (req, res) => {
  try {
    await initializeService();

    const { generationId } = req.params;
    const { html, css, quality, userRating } = req.body;

    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'HTML result is required'
      });
    }

    if (userRating && (userRating < 1 || userRating > 5)) {
      return res.status(400).json({
        success: false,
        error: 'User rating must be between 1 and 5'
      });
    }

    const updatedGeneration = await promptService.updateGenerationResult(generationId, {
      html,
      css: css || '',
      quality,
      userRating: userRating ? Number(userRating) : undefined
    });

    if (!updatedGeneration) {
      return res.status(404).json({
        success: false,
        error: 'Generation not found'
      });
    }

    res.json({
      success: true,
      data: updatedGeneration
    });

  } catch (error) {
    logger.error('Error updating generation result', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update generation result'
    });
  }
});

/**
 * GET /api/prompts/templates/:templateId/generations
 * Get generations for a template
 */
router.get('/templates/:templateId/generations', async (req, res) => {
  try {
    await initializeService();

    const { templateId } = req.params;
    const generations = promptService.getGenerationsForTemplate(templateId);

    res.json({
      success: true,
      data: generations
    });

  } catch (error) {
    logger.error('Error getting template generations', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get template generations'
    });
  }
});

/**
 * GET /api/prompts/best
 * Get best performing prompts for learning
 */
router.get('/best', async (req, res) => {
  try {
    await initializeService();

    const { minRating = 4, limit = 10 } = req.query;
    const bestPrompts = promptService.getBestPrompts(
      Number(minRating), 
      Number(limit)
    );

    res.json({
      success: true,
      data: bestPrompts
    });

  } catch (error) {
    logger.error('Error getting best prompts', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get best prompts'
    });
  }
});

/**
 * GET /api/prompts/analytics
 * Get prompt performance analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    await initializeService();

    const analytics = promptService.getPromptAnalytics();

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Error getting prompt analytics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get prompt analytics'
    });
  }
});

/**
 * POST /api/prompts/preview
 * Preview enhanced prompt without saving
 */
router.post('/preview', async (req, res) => {
  try {
    await initializeService();

    const { 
      basePrompt,
      contexts = [],
      userRequirements,
      sectionType = 'unknown'
    } = req.body;

    if (!basePrompt) {
      return res.status(400).json({
        success: false,
        error: 'Base prompt is required'
      });
    }

    // Create a temporary template for preview
    const tempTemplate = await promptService.createTemplate({
      name: 'Preview Template',
      description: 'Temporary template for preview',
      basePrompt,
      sectionType
    });

    // Add contexts if provided
    for (const context of contexts) {
      await promptService.addContextToTemplate(tempTemplate.id, context);
    }

    // Generate preview
    const generation = await promptService.generateInteractivePrompt(tempTemplate.id, {
      sectionType,
      userRequirements
    });

    res.json({
      success: true,
      data: {
        enhancedPrompt: generation?.enhancedPrompt,
        contexts: generation?.contexts,
        originalPrompt: generation?.originalPrompt
      }
    });

  } catch (error) {
    logger.error('Error previewing prompt', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to preview prompt'
    });
  }
});

export default router;
