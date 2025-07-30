import express from 'express';
import { EnhancedAIService } from '../services/ai/EnhancedAIService';
import { FineTuningService } from '../services/ai/FineTuningService';
import { createLogger } from '../utils/logger';

const router = express.Router();
const logger = createLogger();

// Helper function to safely extract error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

let enhancedAIService: EnhancedAIService;
let fineTuningService: FineTuningService;

// Initialize services
const initializeServices = async () => {
  try {
    if (!enhancedAIService) {
      logger.info('Initializing Enhanced AI Service...');
      enhancedAIService = new EnhancedAIService();
      await enhancedAIService.initialize();
      logger.info('Enhanced AI Service initialized successfully');
    }
    if (!fineTuningService) {
      logger.info('Initializing Fine-tuning Service...');
      fineTuningService = FineTuningService.getInstance();
      logger.info('Fine-tuning Service initialized successfully');
    }
  } catch (error) {
    logger.error('Error initializing AI Enhancement services', { error: getErrorMessage(error) });
    throw error;
  }
};

/**
 * AI Enhancement Routes
 * Provides access to RAG, Dynamic Context, and Fine-tuning capabilities
 */

// Simple test route
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'AI Enhancement routes are working' });
});

// ============================================================
// RAG + DYNAMIC CONTEXT ENDPOINTS (Approaches 1 & 2)
// ============================================================

/**
 * GET /api/ai-enhancement/status
 * Get AI enhancement system status
 */
router.get('/status', async (req, res) => {
  try {
    await initializeServices();
    
    const enhancementStats = enhancedAIService.getEnhancementStats();
    const fineTuningStats = fineTuningService.getStats();
    
    res.json({
      success: true,
      data: {
        enhancedAI: enhancementStats,
        fineTuning: fineTuningStats,
        approaches: {
          rag: {
            name: 'Retrieval-Augmented Generation',
            status: 'active',
            description: 'Vector search with knowledge base for contextual enhancement'
          },
          dynamicContext: {
            name: 'Dynamic Context Extension',
            status: 'active',
            description: 'Real-time context adaptation based on pipeline state and history'
          },
          fineTuning: {
            name: 'Fine-Tuning Jobs',
            status: 'available',
            description: 'Optional specialized model training for domain-specific needs'
          }
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error getting AI enhancement status', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to get AI enhancement status'
    });
  }
});

/**
 * POST /api/ai-enhancement/enhance-prompt
 * Enhance a prompt using RAG + Dynamic Context
 */
router.post('/enhance-prompt', async (req, res) => {
  try {
    await initializeServices();
    
    const { prompt, context = {} } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }
    
    const enhancedPrompt = await enhancedAIService.enhancePrompt(prompt, context);
    
    res.json({
      success: true,
      data: {
        originalPrompt: prompt,
        enhancedPrompt,
        context,
        enhancementApplied: {
          rag: true,
          dynamicContext: true,
          knowledgeBaseEntries: context.knowledgeBaseEntries || 'auto-selected'
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error enhancing prompt', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to enhance prompt'
    });
  }
});

/**
 * POST /api/ai-enhancement/generate-html
 * Generate enhanced HTML using RAG + Dynamic Context
 */
router.post('/generate-html', async (req, res) => {
  try {
    await initializeServices();
    
    const { designFile, options = {}, context = {} } = req.body;
    
    if (!designFile) {
      return res.status(400).json({
        success: false,
        error: 'Design file is required'
      });
    }
    
    const html = await enhancedAIService.generateEnhancedHTML(designFile, options, context);
    
    res.json({
      success: true,
      data: {
        html,
        designFile,
        options,
        context,
        enhancementApplied: {
          rag: true,
          dynamicContext: true,
          qualityOptimized: true
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error generating enhanced HTML', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to generate enhanced HTML'
    });
  }
});

/**
 * POST /api/ai-enhancement/refine-html
 * Refine HTML using enhanced context awareness
 */
router.post('/refine-html', async (req, res) => {
  try {
    await initializeServices();
    
    const { html, feedback, context = {} } = req.body;
    
    if (!html || !feedback) {
      return res.status(400).json({
        success: false,
        error: 'HTML and feedback are required'
      });
    }
    
    const refinedHtml = await enhancedAIService.refineEnhancedHTML(html, feedback, context);
    
    res.json({
      success: true,
      data: {
        originalHtml: html,
        refinedHtml,
        feedback,
        context,
        enhancementApplied: {
          rag: true,
          dynamicContext: true,
          feedbackIntegrated: true
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error refining HTML', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to refine HTML'
    });
  }
});

/**
 * POST /api/ai-enhancement/add-knowledge
 * Add new entry to knowledge base
 */
router.post('/add-knowledge', async (req, res) => {
  try {
    await initializeServices();
    
    const { content, type, category, tags = [] } = req.body;
    
    if (!content || !type || !category) {
      return res.status(400).json({
        success: false,
        error: 'Content, type, and category are required'
      });
    }
    
    await enhancedAIService.addKnowledgeEntry(content, type, category, tags);
    
    res.json({
      success: true,
      data: {
        message: 'Knowledge entry added successfully',
        entry: { content, type, category, tags },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error adding knowledge entry', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to add knowledge entry'
    });
  }
});

// ============================================================
// FINE-TUNING ENDPOINTS (Approach 3)
// ============================================================

/**
 * GET /api/ai-enhancement/fine-tuning/recommendations
 * Get fine-tuning recommendations
 */
router.get('/fine-tuning/recommendations', async (req, res) => {
  try {
    await initializeServices();
    
    const recommendations = fineTuningService.getFineTuningRecommendations();
    
    res.json({
      success: true,
      data: {
        recommendations,
        currentApproach: 'RAG + Dynamic Context',
        fineTuningBenefits: [
          'Highly consistent output format',
          'Domain-specific language patterns',
          'Reduced prompt engineering needs',
          'Faster inference times'
        ],
        fineTuningDrawbacks: [
          'High upfront cost ($100-500)',
          'Training time (2-4 hours)',
          'Maintenance complexity',
          'Less flexibility than RAG'
        ],
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error getting fine-tuning recommendations', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to get fine-tuning recommendations'
    });
  }
});

/**
 * POST /api/ai-enhancement/fine-tuning/prepare-data
 * Prepare training data for fine-tuning
 */
router.post('/fine-tuning/prepare-data', async (req, res) => {
  try {
    await initializeServices();
    
    const trainingFile = await fineTuningService.prepareTrainingData();
    
    res.json({
      success: true,
      data: {
        message: 'Training data prepared successfully',
        trainingFile,
        nextSteps: [
          'Review training data quality',
          'Create fine-tuning job',
          'Monitor training progress',
          'Test fine-tuned model'
        ],
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error preparing training data', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to prepare training data'
    });
  }
});

/**
 * POST /api/ai-enhancement/fine-tuning/create-job
 * Create a fine-tuning job
 */
router.post('/fine-tuning/create-job', async (req, res) => {
  try {
    await initializeServices();
    
    const { trainingFile, model = 'gpt-3.5-turbo', hyperparameters = { nEpochs: 3 } } = req.body;
    
    if (!trainingFile) {
      return res.status(400).json({
        success: false,
        error: 'Training file is required'
      });
    }
    
    const jobId = await fineTuningService.createFineTuningJob(trainingFile, model, hyperparameters);
    
    res.json({
      success: true,
      data: {
        message: 'Fine-tuning job created successfully',
        jobId,
        model,
        hyperparameters,
        estimatedTime: '2-4 hours',
        monitoringUrl: `/api/ai-enhancement/fine-tuning/jobs/${jobId}`,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error creating fine-tuning job', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to create fine-tuning job'
    });
  }
});

/**
 * GET /api/ai-enhancement/fine-tuning/jobs
 * List all fine-tuning jobs
 */
router.get('/fine-tuning/jobs', async (req, res) => {
  try {
    await initializeServices();
    
    const jobs = await fineTuningService.listJobs();
    
    res.json({
      success: true,
      data: {
        jobs,
        totalJobs: jobs.length,
        activeJobs: jobs.filter(job => ['validating_files', 'queued', 'running'].includes(job.status)).length,
        completedJobs: jobs.filter(job => job.status === 'succeeded').length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error listing fine-tuning jobs', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to list fine-tuning jobs'
    });
  }
});

/**
 * GET /api/ai-enhancement/fine-tuning/jobs/:jobId
 * Get fine-tuning job status
 */
router.get('/fine-tuning/jobs/:jobId', async (req, res) => {
  try {
    await initializeServices();
    
    const { jobId } = req.params;
    const job = await fineTuningService.checkJobStatus(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Fine-tuning job not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        job,
        statusDescription: getJobStatusDescription(job.status),
        nextSteps: getJobNextSteps(job.status),
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error getting job status', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to get job status'
    });
  }
});

/**
 * POST /api/ai-enhancement/fine-tuning/jobs/:jobId/cancel
 * Cancel a fine-tuning job
 */
router.post('/fine-tuning/jobs/:jobId/cancel', async (req, res) => {
  try {
    await initializeServices();
    
    const { jobId } = req.params;
    const cancelled = await fineTuningService.cancelJob(jobId);
    
    if (!cancelled) {
      return res.status(400).json({
        success: false,
        error: 'Failed to cancel job or job not cancellable'
      });
    }
    
    res.json({
      success: true,
      data: {
        message: 'Fine-tuning job cancelled successfully',
        jobId,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error cancelling job', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to cancel job'
    });
  }
});

// ============================================================
// COMPARISON AND ANALYSIS ENDPOINTS
// ============================================================

/**
 * POST /api/ai-enhancement/compare-approaches
 * Compare output quality between different approaches
 */
router.post('/compare-approaches', async (req, res) => {
  try {
    await initializeServices();
    
    const { prompt, designFile, context = {} } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required for comparison'
      });
    }
    
    // Generate outputs using different approaches
    const results = {
      baseline: {
        approach: 'Standard OpenAI API',
        prompt: prompt,
        description: 'Direct API call without enhancement'
      },
      ragEnhanced: {
        approach: 'RAG Enhanced',
        prompt: await enhancedAIService.enhancePrompt(prompt, { ...context, useRAG: true }),
        description: 'Enhanced with knowledge base retrieval'
      },
      dynamicContext: {
        approach: 'Dynamic Context',
        prompt: await enhancedAIService.enhancePrompt(prompt, { ...context, useDynamicContext: true }),
        description: 'Enhanced with pipeline state and history'
      },
      combined: {
        approach: 'RAG + Dynamic Context',
        prompt: await enhancedAIService.enhancePrompt(prompt, context),
        description: 'Full enhancement with both approaches'
      }
    };
    
    res.json({
      success: true,
      data: {
        comparison: results,
        recommendations: {
          bestApproach: 'combined',
          reasoning: 'RAG + Dynamic Context provides the most comprehensive enhancement',
          costEfficiency: 'High - no training costs, immediate benefits',
          implementationComplexity: 'Medium - requires knowledge base maintenance'
        },
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error comparing approaches', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to compare approaches'
    });
  }
});

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function getJobStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    'validating_files': 'Validating training data format and content',
    'queued': 'Job queued for training, waiting for available resources',
    'running': 'Training in progress, this may take 2-4 hours',
    'succeeded': 'Training completed successfully, model is ready to use',
    'failed': 'Training failed, check logs for error details',
    'cancelled': 'Training was cancelled by user request'
  };
  
  return descriptions[status] || 'Unknown status';
}

function getJobNextSteps(status: string): string[] {
  const nextSteps: Record<string, string[]> = {
    'validating_files': ['Wait for validation to complete', 'Monitor job status'],
    'queued': ['Wait for training to start', 'Monitor job status'],
    'running': ['Wait for training to complete', 'Monitor progress', 'Prepare test cases'],
    'succeeded': ['Test the fine-tuned model', 'Update API configuration', 'Monitor performance'],
    'failed': ['Review error logs', 'Fix training data issues', 'Create new job'],
    'cancelled': ['Review cancellation reason', 'Create new job if needed']
  };
  
  return nextSteps[status] || ['Check job status'];
}

export default router;
