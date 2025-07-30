import express from 'express';
import { SectionComparisonService } from '../services/comparison/SectionComparisonService';
import { InteractivePromptService } from '../services/prompts/InteractivePromptService';
import { EnhancedAIService } from '../services/ai/EnhancedAIService';
import { createLogger } from '../utils/logger';
import multer from 'multer';
import path from 'path';

const router = express.Router();
const logger = createLogger();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'storage', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `section-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

// Service instances
let comparisonService: SectionComparisonService;
let promptService: InteractivePromptService;
let enhancedAI: EnhancedAIService;

// Initialize services
async function initializeServices() {
  if (!comparisonService) {
    comparisonService = new SectionComparisonService();
    await comparisonService.loadFromStorage();
  }
  if (!promptService) {
    promptService = new InteractivePromptService();
    await promptService.loadFromStorage();
  }
  if (!enhancedAI) {
    enhancedAI = new EnhancedAIService();
    await enhancedAI.initialize();
  }
}

/**
 * POST /api/comparison/create
 * Create a new section comparison
 */
router.post('/create', upload.single('originalImage'), async (req, res) => {
  try {
    await initializeServices();

    const { 
      generatedHtml, 
      generatedCss, 
      prompt, 
      enhancedPrompt, 
      context, 
      sectionType, 
      projectId 
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Original section image is required'
      });
    }

    if (!generatedHtml || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Generated HTML and prompt are required'
      });
    }

    const comparison = await comparisonService.createComparison({
      originalImagePath: req.file.path,
      generatedHtml,
      generatedCss: generatedCss || '',
      prompt,
      enhancedPrompt: enhancedPrompt || prompt,
      context: context ? JSON.parse(context) : {},
      sectionType: sectionType || 'unknown',
      projectId
    });

    res.json({
      success: true,
      data: comparison
    });

  } catch (error) {
    logger.error('Error creating section comparison', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create section comparison'
    });
  }
});

/**
 * POST /api/comparison/:id/rate
 * Rate a section comparison
 */
router.post('/:id/rate', async (req, res) => {
  try {
    await initializeServices();

    const { id } = req.params;
    const { userRating, userComments, improvements, issues } = req.body;

    if (!userRating || userRating < 1 || userRating > 5) {
      return res.status(400).json({
        success: false,
        error: 'User rating must be between 1 and 5'
      });
    }

    const updatedComparison = await comparisonService.updateComparisonRating(id, {
      userRating,
      userComments,
      improvements: improvements ? improvements.split(',').map((s: string) => s.trim()) : undefined,
      issues: issues ? issues.split(',').map((s: string) => s.trim()) : undefined
    });

    if (!updatedComparison) {
      return res.status(404).json({
        success: false,
        error: 'Comparison not found'
      });
    }

    res.json({
      success: true,
      data: updatedComparison
    });

  } catch (error) {
    logger.error('Error rating section comparison', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to rate section comparison'
    });
  }
});

/**
 * POST /api/comparison/:id/regenerate
 * Create a new version of a comparison (regeneration)
 */
router.post('/:id/regenerate', async (req, res) => {
  try {
    await initializeServices();

    const { id } = req.params;
    const { 
      prompt, 
      additionalContext, 
      templateId,
      customContexts 
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required for regeneration'
      });
    }

    // Get original comparison
    const originalComparison = comparisonService.getComparison(id);
    if (!originalComparison) {
      return res.status(404).json({
        success: false,
        error: 'Original comparison not found'
      });
    }

    // Generate enhanced prompt if template is provided
    let enhancedPrompt = prompt;
    let contexts: any[] = [];

    if (templateId) {
      const generation = await promptService.generateInteractivePrompt(templateId, {
        designFile: originalComparison.context.designFile,
        sectionType: originalComparison.metadata.sectionType,
        userRequirements: additionalContext,
        customContexts: customContexts ? JSON.parse(customContexts) : undefined
      });

      if (generation) {
        enhancedPrompt = generation.enhancedPrompt;
        contexts = generation.contexts;
      }
    } else {
      // Use enhanced AI service directly
      enhancedPrompt = await enhancedAI.enhancePrompt(prompt, {
        ...originalComparison.context,
        userRequirements: additionalContext
      });
    }

    // Generate new HTML (this would typically call OpenAI)
    // For now, we'll simulate the generation
    const generatedHtml = `<!-- Regenerated HTML with enhanced prompt -->
<div class="regenerated-section">
  <p>This would be the newly generated HTML based on the enhanced prompt</p>
  <p>Enhanced Prompt Length: ${enhancedPrompt.length} characters</p>
</div>`;

    const generatedCss = `/* Regenerated CSS */
.regenerated-section {
  @apply p-4 bg-blue-50 border border-blue-200 rounded-lg;
}`;

    // Create new version
    const newComparison = await comparisonService.createComparisonVersion(id, {
      generatedHtml,
      generatedCss,
      prompt,
      enhancedPrompt,
      context: {
        ...originalComparison.context,
        additionalContext,
        contexts,
        templateId
      }
    });

    res.json({
      success: true,
      data: {
        comparison: newComparison,
        enhancedPrompt,
        contexts
      }
    });

  } catch (error) {
    logger.error('Error regenerating section comparison', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate section comparison'
    });
  }
});

/**
 * GET /api/comparison/:id
 * Get a specific comparison
 */
router.get('/:id', async (req, res) => {
  try {
    await initializeServices();

    const { id } = req.params;
    const comparison = comparisonService.getComparison(id);

    if (!comparison) {
      return res.status(404).json({
        success: false,
        error: 'Comparison not found'
      });
    }

    res.json({
      success: true,
      data: comparison
    });

  } catch (error) {
    logger.error('Error getting section comparison', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get section comparison'
    });
  }
});

/**
 * GET /api/comparison/:id/versions
 * Get all versions of a comparison
 */
router.get('/:id/versions', async (req, res) => {
  try {
    await initializeServices();

    const { id } = req.params;
    const versions = comparisonService.getComparisonVersions(id);

    res.json({
      success: true,
      data: versions
    });

  } catch (error) {
    logger.error('Error getting comparison versions', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get comparison versions'
    });
  }
});

/**
 * GET /api/comparison/best
 * Get best rated comparisons for learning
 */
router.get('/best', async (req, res) => {
  try {
    await initializeServices();

    const { minRating = 4, limit = 10 } = req.query;
    const bestComparisons = comparisonService.getBestComparisons(
      Number(minRating), 
      Number(limit)
    );

    res.json({
      success: true,
      data: bestComparisons
    });

  } catch (error) {
    logger.error('Error getting best comparisons', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get best comparisons'
    });
  }
});

/**
 * GET /api/comparison/stats
 * Get comparison statistics
 */
router.get('/stats', async (req, res) => {
  try {
    await initializeServices();

    const stats = comparisonService.getComparisonStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting comparison stats', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get comparison stats'
    });
  }
});

/**
 * POST /api/comparison/session
 * Create a new comparison session
 */
router.post('/session', async (req, res) => {
  try {
    await initializeServices();

    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
    }

    const session = await comparisonService.createComparisonSession(projectId);

    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    logger.error('Error creating comparison session', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create comparison session'
    });
  }
});

/**
 * GET /api/comparison/session/:sessionId
 * Get comparison session
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    await initializeServices();

    const { sessionId } = req.params;
    const session = comparisonService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    logger.error('Error getting comparison session', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get comparison session'
    });
  }
});

/**
 * POST /api/comparison/session/:sessionId/best/:sectionId
 * Mark comparison as best version for a section
 */
router.post('/session/:sessionId/best/:sectionId', async (req, res) => {
  try {
    await initializeServices();

    const { sessionId, sectionId } = req.params;
    const { comparisonId } = req.body;

    if (!comparisonId) {
      return res.status(400).json({
        success: false,
        error: 'Comparison ID is required'
      });
    }

    await comparisonService.markAsBestVersion(sessionId, sectionId, comparisonId);

    res.json({
      success: true,
      message: 'Best version marked successfully'
    });

  } catch (error) {
    logger.error('Error marking best version', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to mark best version'
    });
  }
});

export default router;
