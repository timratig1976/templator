import express from 'express';
import type { Request, Response } from 'express';
import { EnhancedAIService } from '../services/ai/EnhancedAIService';
import { FineTuningService } from '../services/ai/FineTuningService';
import openaiService, { OpenAIService, Section, EditableField, Component } from '../services/ai/openaiService';
import SplittingService from '../services/ai/splitting/SplittingService';
import { HTMLValidator } from '../services/quality/validation/HTMLValidator';
import { ComprehensiveLogger } from '../services/core/logging/ComprehensiveLogger';
import { WebSocketService } from '../services/core/websocket/WebSocketService';
import { createLogger } from '../utils/logger';
import { logToFrontend } from '../routes/logs';
import { v4 as uuidv4 } from 'uuid';
import { isValidBase64Image } from '../utils/base64';
import type { Prisma } from '@prisma/client';
import designUploadRepo from '../services/database/DesignUploadRepository';
import designSplitRepo from '../services/database/DesignSplitRepository';
import splitAssetRepo from '../services/database/SplitAssetRepository';
import storage from '../services/storage';
import { sha256 } from '../utils/checksum';
import imageCropService from '../services/ai/ImageCropService';
import { createHmac } from 'crypto';
import { Readable } from 'stream';
import fs from 'fs';

// Interface for layout analysis response
interface LayoutAnalysisResult {
  sections: Section[];
  html: string;
  description: string;
  components: Component[];
  confidence: number;
  quality: number;
  processingTime: number;
  enhancedAnalysis: {
    recommendations: {
      suggestedAdjustments: string[];
      qualityScore: number;
      improvementTips: string[];
    };
    detectionMetrics: {
      averageConfidence: number;
      processingTime: number;
    };
  };
}

const router = express.Router();
const logger = createLogger();

// Helper function to safely extract error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// (Removed) basic heuristic splitting suggestions; AI-only enforced

// Cost calculation for OpenAI API usage
function calculateOpenAICost(totalTokens: number, model: string): number {
  // GPT-4o pricing (as of 2024)
  const pricing = {
    'gpt-4o': {
      input: 0.005 / 1000,  // $0.005 per 1K input tokens
      output: 0.015 / 1000  // $0.015 per 1K output tokens
    },
    'gpt-4': {
      input: 0.03 / 1000,
      output: 0.06 / 1000
    }
  };
  
  const modelPricing = pricing[model as keyof typeof pricing] || pricing['gpt-4o'];
  // Simplified calculation - using average pricing
  const avgPrice = (modelPricing.input + modelPricing.output) / 2;
  return totalTokens * avgPrice;
}

// AI-powered splitting suggestions using OpenAI Vision
async function generateAISplittingSuggestions(imageBase64: string, fileName: string, requestId: string) {
  try {
    logger.info(`[${requestId}] Starting AI-powered section detection`, {
      requestId,
      fileName,
      imageSize: Math.round(imageBase64.length / 1024)
    });

  // List recent splits for quick-load UI
  // GET /api/ai-enhancement/splits/recent?limit=20
  router.get('/splits/recent', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit || 20), 100);
      const recent = await designSplitRepo.listRecent(isNaN(limit) ? 20 : limit);
      // shape items
      const items = recent.map((s: any) => ({
        designSplitId: s.id,
        createdAt: s.createdAt,
        // sectionCount can be filled lazily on summary; keep optional here
      }));
      return res.json({ success: true, data: { items } });
    } catch (e) {
      logger.error('Failed to list recent splits', { error: getErrorMessage(e) });
      return res.status(500).json({ success: false, error: 'Failed to list recent splits' });
    }
  });

  // Split summary: sections + optional image reference
  // GET /api/ai-enhancement/splits/:splitId/summary
  router.get('/splits/:splitId/summary', async (req: Request, res: Response) => {
    const { splitId } = req.params;
    try {
      const split = await designSplitRepo.findById(splitId);
      if (!split) return res.status(404).json({ success: false, error: 'DesignSplit not found' });

      // Collect section descriptors from JSON assets (created by detect-sections or analyze-layout)
      const assets = await designSplitRepo.listAssets(splitId);
      const sections = assets
        .filter((a: any) => a.kind === 'json')
        .map((a: any, i: number) => {
          const m: any = a.meta || {};
          return {
            id: m.id || m.sectionId || `section_${i + 1}`,
            name: m.name || m.type || `Section ${i + 1}`,
            type: (m.type || 'content') as string,
            // bounds may be present from detect-sections path
            bounds: m.bounds || undefined,
            description: m.splittingRationale || undefined,
          };
        });

      // Reference to uploaded image if available (key stored in designUpload.storageUrl)
      const imageUrl = split.designUpload?.storageUrl || null;

      return res.json({ success: true, data: { designSplitId: splitId, imageUrl, sections } });
    } catch (e) {
      logger.error('Failed to build split summary', { error: getErrorMessage(e), splitId });
      return res.status(500).json({ success: false, error: 'Failed to load split summary' });
    }
  });
    logToFrontend('info', 'openai', '🤖 Analyzing design with AI Vision', {
      fileName,
      model: 'gpt-4o'
    }, requestId);

    const DESIGN_SPLITTING_PROMPT = `
Analyze this design image and identify logical sections that should be split for modular development.

**Your Task**: 
Identify distinct visual sections in this design and suggest optimal splitting boundaries. DO NOT generate any HTML or CSS code.

**Analysis Requirements**:

1. **Visual Section Detection**:
   - Identify clear visual boundaries between different content areas
   - Look for natural breaks in layout (whitespace, borders, color changes)
   - Detect repeating patterns that could be componentized
   - Consider responsive behavior and how sections might stack

2. **Section Classification**:
   - header: Top navigation, branding, global elements
   - hero: Main banner, primary call-to-action area
   - navigation: Menu systems, breadcrumbs
   - content: Main body content, articles, text blocks
   - feature: Feature highlights, service listings, benefits
   - testimonial: Customer reviews, quotes, social proof
   - gallery: Image collections, portfolios, media grids
   - contact: Forms, contact information, maps
   - sidebar: Secondary content, widgets, related links
   - footer: Bottom navigation, legal, contact info

3. **Complexity Assessment**:
   - low: Simple text/image layouts, minimal interactivity
   - medium: Multiple elements, some dynamic content
   - high: Complex layouts, heavy interactivity, data-driven

4. **Splitting Strategy**:
   - Prioritize reusability and maintainability
   - Consider content editor needs
   - Balance granularity (not too many tiny sections)
   - Ensure sections can work independently

**Output Format**: Return a JSON object with this structure:
{
  "analysis": {
    "design_type": "landing_page|website|blog|ecommerce|portfolio",
    "layout_style": "single_column|multi_column|grid|sidebar|full_width",
    "complexity_overall": "low|medium|high",
    "responsive_considerations": ["mobile_first", "tablet_adjustments", "desktop_enhancements"]
  },
  "suggested_sections": [
    {
      "id": "section_1",
      "name": "Header Section",
      "type": "header|hero|navigation|content|feature|testimonial|gallery|contact|sidebar|footer",
      "bounds": {
        "x": 0,
        "y": 0, 
        "width": 100,
        "height": 15
      },
      "confidence": 0.9,
      "complexity": "low|medium|high",
      "description": "Brief description of what this section contains",
      "estimated_fields": 3,
      "splitting_rationale": "Why this should be a separate section",
      "dependencies": ["section_ids that this section depends on"],
      "reusability": "high|medium|low"
    }
  ],
  "splitting_recommendations": {
    "total_sections": 4,
    "recommended_batch_size": 2,
    "processing_order": ["section_1", "section_2", "section_3", "section_4"],
    "alternative_approaches": [
      {
        "approach": "more_granular",
        "description": "Split into 6 smaller sections for maximum flexibility",
        "trade_offs": "More sections to manage but higher reusability"
      }
    ]
  },
  "technical_considerations": {
    "responsive_breakpoints": ["mobile: 320px", "tablet: 768px", "desktop: 1024px"],
    "accessibility_notes": ["Ensure proper heading hierarchy", "Include skip navigation"],
    "performance_notes": ["Consider lazy loading for images", "Optimize above-fold content"]
  }
}

**Critical Instructions**:
- Focus ONLY on identifying sections and boundaries
- DO NOT generate any HTML, CSS, or code
- Provide percentage-based coordinates for section bounds
- Consider how sections will work on mobile devices
- Suggest realistic field counts for content management
- Explain your splitting rationale for each section
- Consider both visual and functional boundaries
- Think about content editor workflow and ease of use
`;

    // Prepare OpenAI request data
    const requestData = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: DESIGN_SPLITTING_PROMPT
            },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000, // Smaller since we're not generating code
      temperature: 0.2  // Lower for more consistent analysis
    };

    logToFrontend('info', 'openai', '📋 Sending design analysis request', {
      model: 'gpt-4o',
      maxTokens: 2000,
      temperature: 0.2,
      promptLength: DESIGN_SPLITTING_PROMPT.length,
      imageSize: `${Math.round(imageBase64.length / 1024)}KB`
    }, requestId);

    // Make direct OpenAI API call with timing
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const apiStartTime = Date.now();
    const response = await openai.chat.completions.create({
      model: requestData.model,
      messages: requestData.messages as any[], // Type assertion for vision messages
      max_tokens: requestData.max_tokens,
      temperature: requestData.temperature
    });
    const apiDuration = Date.now() - apiStartTime;

    const aiContent = response.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error('No content received from OpenAI');
    }

    // Calculate cost estimation
    const tokensUsed = response.usage?.total_tokens || 0;
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const estimatedCost = calculateOpenAICost(tokensUsed, 'gpt-4o');

    logToFrontend('info', 'openai', '🔍 Parsing AI analysis results', {
      responseLength: aiContent.length,
      tokensUsed,
      promptTokens,
      completionTokens,
      apiDuration: `${apiDuration}ms`,
      estimatedCost: `$${estimatedCost.toFixed(4)}`
    }, requestId);

    // Parse the AI response JSON
    let aiAnalysis;
    try {
      // Try to extract JSON from markdown code blocks first
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : aiContent.trim();
      aiAnalysis = JSON.parse(jsonString);
    } catch (parseError) {
      // Fallback: try parsing the entire content
      try {
        aiAnalysis = JSON.parse(aiContent);
      } catch (fallbackError) {
        logger.error(`[${requestId}] Failed to parse AI response as JSON`, {
          content: aiContent.substring(0, 500),
          parseError: (parseError as Error).message,
          fallbackError: (fallbackError as Error).message
        });
        throw new Error('Invalid JSON response from AI');
      }
    }
    
    if (!aiAnalysis || !aiAnalysis.suggested_sections) {
      throw new Error('Invalid AI response format');
    }

    // Convert AI analysis to frontend format
    const suggestions = aiAnalysis.suggested_sections.map((section: any, index: number) => ({
      id: section.id || `ai_section_${index + 1}`,
      name: section.name || `${section.type.charAt(0).toUpperCase() + section.type.slice(1)} Section`,
      type: section.type,
      bounds: {
        x: section.bounds.x || 0,
        y: section.bounds.y || 0,
        width: section.bounds.width || 100,
        height: section.bounds.height || 20
      },
      confidence: section.confidence || 0.8,
      description: section.description || `AI-detected ${section.type} section`,
      suggested: true,
      // Additional AI metadata
      complexity: section.complexity,
      estimatedFields: section.estimated_fields,
      splittingRationale: section.splitting_rationale,
      reusability: section.reusability
    }));

    // Collect section-level metrics
    const sectionMetrics = suggestions.map((s: any) => ({
      type: s.type,
      confidence: s.confidence,
      complexity: s.complexity,
      reusability: s.reusability
    }));

    const sectionTypeDistribution = suggestions.reduce((acc: Record<string, number>, s: any) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgConfidence = suggestions.reduce((sum: number, s: any) => sum + s.confidence, 0) / suggestions.length;

    logger.info(`[${requestId}] AI section detection completed`, {
      requestId,
      sectionsDetected: suggestions.length,
      designType: aiAnalysis.analysis?.design_type,
      layoutStyle: aiAnalysis.analysis?.layout_style,
      overallComplexity: aiAnalysis.analysis?.complexity_overall,
      tokensUsed,
      promptTokens,
      completionTokens,
      apiDuration,
      estimatedCost,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      sectionTypeDistribution,
      sectionMetrics,
      responsiveConsiderations: aiAnalysis.analysis?.responsive_considerations,
      technicalConsiderations: aiAnalysis.technical_considerations
    });

    logToFrontend('success', 'openai', `✅ AI detected ${suggestions.length} sections`, {
      sectionsCount: suggestions.length,
      designType: aiAnalysis.analysis?.design_type,
      layoutStyle: aiAnalysis.analysis?.layout_style,
      overallComplexity: aiAnalysis.analysis?.complexity_overall,
      tokensUsed,
      apiDuration: `${apiDuration}ms`,
      estimatedCost: `$${estimatedCost.toFixed(4)}`,
      avgConfidence: `${Math.round(avgConfidence * 100)}%`,
      sectionTypes: Object.keys(sectionTypeDistribution).join(', ')
    }, requestId);

    return suggestions;

  } catch (error: any) {
    logger.error(`[${requestId}] AI section detection failed`, {
      requestId,
      error: getErrorMessage(error),
      fileName,
      imageSize: Math.round(imageBase64.length / 1024),
      errorStack: error?.stack,
      errorType: error?.constructor?.name
    });

    logToFrontend('error', 'openai', `❌ AI analysis failed: ${error?.message || 'Unknown error'}.`, {
      error: error?.message || 'Unknown error',
      errorType: error?.constructor?.name || 'Unknown',
      fallbackUsed: false
    }, requestId);

    // Enforce AI-only: propagate failure to caller
    throw error;
  }
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
router.get('/test', (req: Request, res: Response) => {
  res.json({ success: true, message: 'AI Enhancement routes are working' });
});

// ============================================================
// RAG + DYNAMIC CONTEXT ENDPOINTS (Approaches 1 & 2)
// ============================================================

/**
 * GET /api/ai-enhancement/status
 * Get AI enhancement system status
 */
router.get('/status', async (req: Request, res: Response) => {
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
router.post('/enhance-prompt', async (req: Request, res: Response) => {
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
router.post('/generate-html', async (req: Request, res: Response) => {
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
router.post('/refine-html', async (req: Request, res: Response) => {
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
router.post('/add-knowledge', async (req: Request, res: Response) => {
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
router.get('/fine-tuning/recommendations', async (req: Request, res: Response) => {
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
router.post('/fine-tuning/prepare-data', async (req: Request, res: Response) => {
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
router.post('/fine-tuning/create-job', async (req: Request, res: Response) => {
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
router.get('/fine-tuning/jobs', async (req: Request, res: Response) => {
  try {
    await initializeServices();
    
    const jobs = await fineTuningService.listJobs();
    
    res.json({
      success: true,
      data: {
        jobs,
        totalJobs: jobs.length,
        activeJobs: jobs.filter((job: any) => ['validating_files', 'queued', 'running'].includes(job.status)).length,
        completedJobs: jobs.filter((job: any) => job.status === 'succeeded').length,
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
router.get('/fine-tuning/jobs/:jobId', async (req: Request, res: Response) => {
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
router.post('/fine-tuning/jobs/:jobId/cancel', async (req: Request, res: Response) => {
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
router.post('/compare-approaches', async (req: Request, res: Response) => {
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

/**
 * POST /api/ai-enhancement/detect-sections
 * Lightweight section detection for splitting suggestions
 */
router.post('/detect-sections', async (req: Request, res: Response) => {
  const requestId = req.body.requestId || uuidv4();
  const startTime = Date.now();
  
  try {
    const { image, fileName } = req.body;
    
    // Validate required fields
    if (!image) {
      logger.warn(`[${requestId}] Missing image in detect-sections request`);
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: image',
        code: 'MISSING_IMAGE'
      });
    }
    
    logger.info(`[${requestId}] Starting AI section detection`, {
      requestId,
      fileName: fileName || 'unknown',
      analysisType: 'ai'
    });
    
    logToFrontend('info', 'processing', `🤖 Starting AI section detection for ${fileName || 'design'}`, { fileName, analysisType: 'ai' }, requestId);
    
    // Validate base64 image format
    if (!isValidBase64Image(image)) {
      logger.warn(`[${requestId}] Invalid base64 image format`);
      logToFrontend('error', 'processing', '❌ Invalid image format provided', { error: 'Invalid base64 format' }, requestId);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid base64 image format',
        code: 'INVALID_BASE64'
      });
    }
    // Persist DesignUpload and initialize DesignSplit (processing)
    let mime = 'image/png';
    let inferredFileName = fileName || 'uploaded-design.png';
    const mimeMatch = image.match(/^data:(.*?);base64,/);
    if (mimeMatch && mimeMatch[1]) {
      mime = mimeMatch[1];
      const ext = mime.split('/')[1]?.toLowerCase();
      const normExt = ext === 'jpeg' ? 'jpg' : ext;
      inferredFileName = fileName || `uploaded-design.${normExt || 'png'}`;
    }
    const base64Payload = image.startsWith('data:') ? image.split(',')[1] : image;
    const approxSizeBytes = Math.floor((base64Payload.length * 3) / 4) - (base64Payload.endsWith('==') ? 2 : base64Payload.endsWith('=') ? 1 : 0);

    // Persist original image to storage (best-effort)
    let storageUrl: string | null = null;
    let checksum: string | null = null;
    try {
      const buffer = Buffer.from(base64Payload, 'base64');
      const ext = inferredFileName.split('.').pop() || 'png';
      const put = await storage.put(buffer, { mime, extension: ext });
      storageUrl = put.url;
      checksum = sha256(buffer);
    } catch (persistErr) {
      logger.warn(`[${requestId}] Failed to persist original image to storage (non-blocking)`, { error: getErrorMessage(persistErr) });
    }

    const designUpload = await designUploadRepo.create({
      filename: inferredFileName,
      mime,
      size: approxSizeBytes,
      storageUrl,
      checksum,
      meta: { requestId, source: 'detect-sections' }
    });

    const split = await designSplitRepo.create({
      designUploadId: designUpload.id,
      status: 'processing',
      metrics: { analysisType: 'ai' }
    });

    // Use AI to analyze the design and suggest intelligent section splits (always AI)
    const suggestions = await SplittingService.generateSplittingSuggestions(image, fileName || 'design', requestId);
    
    const duration = Date.now() - startTime;
    
    logger.info(`[${requestId}] Section detection completed`, {
      requestId,
      duration,
      suggestionsCount: suggestions.length
    });
    
    logToFrontend('success', 'processing', `✅ AI section detection completed in ${duration}ms with ${suggestions.length} suggestions`, { suggestionsCount: suggestions.length, analysisType: 'ai' }, requestId);
    
    // Persist suggestions as SplitAssets and mark split completed
    try {
      for (let i = 0; i < suggestions.length; i++) {
        const s = suggestions[i] as any;
        await splitAssetRepo.create({
          splitId: split.id,
          kind: 'json',
          meta: ({
            name: s.name,
            type: s.type,
            bounds: s.bounds,
            confidence: s.confidence,
            splittingRationale: s.splittingRationale,
            reusability: s.reusability,
          } as unknown) as any,
          order: i,
        });
      }
      await designSplitRepo.addMetrics(split.id, { durationMs: duration, suggestionCount: suggestions.length });
      await designSplitRepo.updateStatus(split.id, 'completed');
    } catch (persistErr) {
      logger.error(`[${requestId}] Failed to persist split assets`, { error: getErrorMessage(persistErr) });
      await designSplitRepo.updateStatus(split.id, 'failed');
    }
    
    return res.status(200).json({
      success: true,
      suggestions,
      splitId: split.id,
      meta: {
        processingTime: duration,
        requestId,
        analysisType: 'ai',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || 'Unknown error';
    
    logger.error(`[${requestId}] Error in section detection: ${errorMessage}`, { 
      error: { 
        message: errorMessage,
        stack: error.stack
      },
      requestId,
      duration
    });
    
    logToFrontend('error', 'processing', `❌ Section detection failed: ${errorMessage}`, { error: errorMessage }, requestId, duration);
    
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to detect sections', 
      details: errorMessage,
      code: 'SECTION_DETECTION_ERROR'
    });
  }
});

/**
 * POST /api/ai-enhancement/analyze-layout
 * Analyze design layout using OpenAI Vision API
 */
router.post('/analyze-layout', async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  const analysisType = req.body.analysisType || 'comprehensive';
  
  try {
    // Validate request body
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'Image data is required',
        code: 'MISSING_IMAGE'
      });
    }
    
    // Validate base64 image format
    if (!isValidBase64Image(image)) {
      logger.error(`[${requestId}] Invalid base64 image format provided`);
      logToFrontend('error', 'processing', '❌ Invalid image format provided. Please ensure it is a valid base64 encoded image.', { error: 'Invalid base64 image' }, requestId);
      
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid image format', 
        details: 'The provided image data is not in a valid base64 format',
        code: 'INVALID_BASE64'
      });
    }
    
    // Extract image format from base64 data
    let imageFormat = 'png'; // default fallback
    let filename = 'uploaded-design.png';
    
    if (image.startsWith('data:image/')) {
      const mimeMatch = image.match(/data:image\/(\w+);base64,/);
      if (mimeMatch && mimeMatch[1]) {
        imageFormat = mimeMatch[1].toLowerCase();
        // Handle common format variations
        if (imageFormat === 'jpeg') imageFormat = 'jpg';
        filename = `uploaded-design.${imageFormat}`;
      }
    }
    
    // Log the start of the analysis process
    logger.info(`[${requestId}] Starting layout analysis`, { 
      requestId, 
      analysisType,
      imageSize: image.length,
      imageFormat,
      filename
    });
    logToFrontend('info', 'processing', `Starting AI vision analysis of ${imageFormat.toUpperCase()} design layout...`, { imageSize: image.length, format: imageFormat }, requestId);
    
    // Persist DesignUpload and initialize DesignSplit (processing)
    let mime = imageFormat ? `image/${imageFormat}` : 'image/png';
    const base64Payload = image.startsWith('data:') ? image.split(',')[1] : image;
    const approxSizeBytes = Math.floor((base64Payload.length * 3) / 4) - (base64Payload.endsWith('==') ? 2 : base64Payload.endsWith('=') ? 1 : 0);

    // Persist original image to storage (best-effort)
    let storageUrl2: string | null = null;
    let checksum2: string | null = null;
    try {
      const buffer2 = Buffer.from(base64Payload, 'base64');
      const ext2 = filename.split('.').pop() || (imageFormat || 'png');
      const put2 = await storage.put(buffer2, { mime, extension: ext2 });
      storageUrl2 = put2.url;
      checksum2 = sha256(buffer2);
    } catch (persistErr) {
      logger.warn(`[${requestId}] Failed to persist original image to storage (non-blocking)`, { error: getErrorMessage(persistErr) });
    }

    const designUpload = await designUploadRepo.create({
      filename,
      mime,
      size: approxSizeBytes,
      storageUrl: storageUrl2,
      checksum: checksum2,
      meta: { requestId, source: 'analyze-layout' }
    });

    const split = await designSplitRepo.create({
      designUploadId: designUpload.id,
      status: 'processing',
      metrics: { analysisType }
    });

    // Call the OpenAI service to analyze the layout with correct filename
    const designAnalysis = await openaiService.convertDesignToHTML(image, filename);
    
    // Calculate the processing time
    const duration = Date.now() - startTime;
    
    // Create a structured analysis result with enhanced metadata
    const analysisResult: LayoutAnalysisResult = {
      html: designAnalysis.html,
      sections: designAnalysis.sections,
      components: designAnalysis.components,
      description: designAnalysis.description,
      confidence: 0.85, // Default confidence score
      quality: 0.8, // Default quality score
      processingTime: duration, // Add processing time
      enhancedAnalysis: {
        recommendations: {
          suggestedAdjustments: [],
          qualityScore: 0.9,
          improvementTips: []
        },
        detectionMetrics: {
          averageConfidence: 0.85,
          processingTime: duration
        }
      }
    };
    
    // Generate IDs for sections if they don't have them
    analysisResult.sections = analysisResult.sections.map((section: Section) => {
      // Create a new section object with all required properties
      const enhancedSection: Section = {
        id: section.id || uuidv4(),
        name: section.name || 'Unnamed Section',
        type: section.type || 'content',
        html: section.html || '',
        editableFields: section.editableFields || []
      };
      
      return enhancedSection;
    });
    
    // Add any additional recommendations or metrics if needed
    if (!analysisResult.enhancedAnalysis) {
      analysisResult.enhancedAnalysis = {
        recommendations: {
          suggestedAdjustments: [
            'Consider adding more contrast between sections',
            'Ensure consistent spacing between elements'
          ],
          qualityScore: 0.8,
          improvementTips: [
            'Use consistent color scheme throughout the design',
            'Consider accessibility in your design choices'
          ]
        },
        detectionMetrics: {
          averageConfidence: 0.8,
          processingTime: duration
        }
      };
    } else if (!analysisResult.enhancedAnalysis.recommendations) {
      analysisResult.enhancedAnalysis.recommendations = {
        suggestedAdjustments: [
          'Consider adding more contrast between sections',
          'Ensure consistent spacing between elements'
        ],
        qualityScore: 0.8,
        improvementTips: [
          'Use consistent color scheme throughout the design',
          'Consider accessibility in your design choices'
        ]
      };
    }
    
    // Make sure suggestedAdjustments and improvementTips are arrays if they don't exist
    if (!analysisResult.enhancedAnalysis.recommendations.suggestedAdjustments) {
      analysisResult.enhancedAnalysis.recommendations.suggestedAdjustments = [];
    }
    
    if (!analysisResult.enhancedAnalysis.recommendations.improvementTips) {
      analysisResult.enhancedAnalysis.recommendations.improvementTips = [];
    }
    
    // Persist sections as SplitAssets and mark split completed
    try {
      for (let i = 0; i < analysisResult.sections.length; i++) {
        const s = analysisResult.sections[i] as Section;
        await splitAssetRepo.create({
          splitId: split.id,
          kind: 'json',
          meta: ({
            id: s.id,
            name: s.name,
            type: s.type,
            editableFields: s.editableFields,
          } as unknown) as any,
          order: i,
        });
      }
      await designSplitRepo.addMetrics(split.id, { durationMs: duration, sectionCount: analysisResult.sections.length });
      await designSplitRepo.updateStatus(split.id, 'completed');
    } catch (persistErr) {
      logger.error(`[${requestId}] Failed to persist analyze-layout assets`, { error: getErrorMessage(persistErr) });
      await designSplitRepo.updateStatus(split.id, 'failed');
    }

    // Log the successful analysis
    logger.info(`[${requestId}] Layout analysis completed successfully`, {
      requestId,
      duration,
      sectionCount: analysisResult.sections.length
    });
    
    logToFrontend('success', 'processing', `✅ AI vision analysis completed in ${(duration / 1000).toFixed(2)}s with ${analysisResult.sections.length} sections detected`, { sectionCount: analysisResult.sections.length }, requestId, duration);
    
    // Return the analysis result with additional metadata
    return res.status(200).json({
      success: true,
      data: analysisResult,
      meta: {
        processingTime: duration,
        requestId,
        analysisType,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    // Extract detailed error information
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'INTERNAL_ERROR';
    const statusCode = error.status || 500;
    const errorDetails = error.details || errorMessage;
    
    // Log detailed error information
    logger.error(`[${requestId}] Error analyzing layout: ${errorMessage}`, { 
      error: { 
        statusCode, 
        code: errorCode, 
        details: errorDetails,
        stack: error.stack
      },
      requestId
    });
    
    // Send helpful error message to frontend
    logToFrontend('error', 'processing', `❌ Error analyzing layout: ${errorMessage}`, { error: 'Failed to analyze design', details: errorDetails }, requestId);
    
    // Return appropriate error response based on the type of error
    if (errorMessage.includes('invalid_base64') || errorMessage.includes('Invalid image')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid image format', 
        details: 'The provided image data is not in a valid base64 format',
        code: 'INVALID_BASE64'
      });
    } else if (errorMessage.includes('timeout')) {
      return res.status(504).json({ 
        success: false, 
        error: 'Analysis timeout', 
        details: 'The image analysis took too long to complete',
        code: 'TIMEOUT'
      });
    } else {
      return res.status(statusCode).json({ 
        success: false, 
        error: 'Failed to analyze layout', 
        details: errorDetails,
        code: errorCode
      });
    }
  }
});

// ===================== Added: Crops + Signed URL Endpoints =====================

// Helper to read a stream fully into Buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// POST /api/ai-enhancement/splits/:splitId/crops
// body: { sections: Array<{ id?: string, index: number, bounds: {x,y,width,height}, unit: 'px'|'percent' }>, projectId?: string }
router.post('/splits/:splitId/crops', async (req: Request, res: Response) => {
  const { splitId } = req.params;
  const { sections, projectId: bodyProjectId } = req.body || {};
  const force = (req.query.force === '1' || req.query.force === 'true' || (req.body && (req.body.force === true || req.body.force === '1' || req.body.force === 'true')));
  if (!Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({ success: false, error: 'sections array is required' });
  }

  try {
    // Avoid duplicates unless force=true: if image-crop assets already exist for this split, return them
    if (!force) {
      const existing = await splitAssetRepo.listBySplit(splitId);
      const existingCrops = existing.filter((a: any) => a.kind === 'image-crop');
      if (existingCrops.length > 0) {
        return res.json({ success: true, data: { assets: existingCrops } });
      }
    }

    const split = await designSplitRepo.findById(splitId);
    if (!split || !split.designUpload) {
      return res.status(404).json({ success: false, error: 'DesignSplit not found or missing upload' });
    }

    // If projectId provided, ensure split carries it; prefer the split's existing value if present
    const projectId = (split as any).projectId || (typeof bodyProjectId === 'string' ? bodyProjectId : undefined);
    if (!(split as any).projectId && projectId) {
      try { await designSplitRepo.setProject(splitId, projectId); } catch {}
    }

    const src = split.designUpload.storageUrl || '';
    let buffer: Buffer;
    if (src && fs.existsSync(src)) {
      buffer = fs.readFileSync(src);
    } else if (src) {
      // treat as storage key
      const stream = await storage.getStream(src);
      buffer = await streamToBuffer(stream);
    } else {
      return res.status(400).json({ success: false, error: 'Missing source image for split' });
    }

    const results = await imageCropService.createCropsForSplit(splitId, buffer, sections as any, projectId);
    // Detailed diagnostics: confirm separate crops and metadata
    try {
      results.forEach((r, idx) => {
        logger.debug('Created image crop', {
          splitId,
          index: idx,
          key: r.key,
          width: r.width,
          height: r.height,
          bounds: r.bounds,
          sectionId: r.asset?.meta?.sectionId ?? null,
          order: r.asset?.order ?? null,
        });
      });
      logger.info('Crop creation summary', { splitId, count: results.length });
    } catch {}
    // Note: service currently reads from path; adjust to buffer usage below if needed
    // To use buffer directly, we can extend ImageCropService; fall back by writing temp file if necessary.
    // For now, if src isn't a path, we already read buffer above; ensure src is path when calling service.

    return res.json({ success: true, data: { assets: results.map(r => r.asset) } });
  } catch (e) {
    logger.error('Failed to create crops', { error: getErrorMessage(e), splitId });
    return res.status(500).json({ success: false, error: 'Failed to create crops' });
  }
});

// GET /api/ai-enhancement/splits/:splitId/assets?kind=image-crop
router.get('/splits/:splitId/assets', async (req: Request, res: Response) => {
  const { splitId } = req.params;
  const kind = req.query.kind ? String(req.query.kind) : undefined;
  try {
    const items = await splitAssetRepo.listBySplit(splitId);
    const filtered = kind ? items.filter((i: any) => i.kind === kind) : items;
    res.json({ success: true, data: { assets: filtered } });
  } catch (e) {
    logger.error('Failed to list split assets', { error: getErrorMessage(e), splitId });
    res.status(500).json({ success: false, error: 'Failed to list assets' });
  }
});

// Signed URL generation for local storage
function signKey(key: string, exp: number): string {
  const secret = process.env.ASSET_SIGNING_SECRET || 'dev-secret';
  const payload = `${key}.${exp}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function verifySignature(key: string, exp: number, sig: string): boolean {
  if (Date.now() > exp) return false;
  const expected = signKey(key, exp);
  return expected === sig;
}

// GET /api/ai-enhancement/assets/signed?key=...&ttl=300000
router.get('/assets/signed', (req: Request, res: Response) => {
  const key = String(req.query.key || '');
  const ttl = Math.min(Number(req.query.ttl || 300000), 3600000); // cap at 1h
  if (!key) return res.status(400).json({ success: false, error: 'key is required' });
  const exp = Date.now() + (isNaN(ttl) ? 300000 : ttl);
  const sig = signKey(key, exp);
  const url = `/api/ai-enhancement/assets/download?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
  res.json({ success: true, data: { url, exp } });
});

// GET /api/ai-enhancement/assets/download?key=...&exp=...&sig=...
router.get('/assets/download', async (req: Request, res: Response) => {
  const key = String(req.query.key || '');
  const exp = Number(req.query.exp || 0);
  const sig = String(req.query.sig || '');
  if (!key || !exp || !sig) return res.status(400).json({ success: false, error: 'missing params' });
  const allowBypass = process.env.ASSET_SIGNING_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
  if (!verifySignature(key, exp, sig)) {
    // Detailed diagnostics for 403s
    try {
      const now = Date.now();
      const expected = signKey(key, exp);
      logger.warn('Asset signature verification failed', {
        key,
        exp,
        now,
        skewMs: exp - now,
        providedSigPrefix: sig.slice(0, 8),
        expectedSigPrefix: expected.slice(0, 8),
        sameSig: expected === sig,
        allowBypass,
      });
    } catch {}
    if (!allowBypass) return res.status(403).json({ success: false, error: 'invalid or expired signature' });
  }
  try {
    const stream = await storage.getStream(key);
    const lower = key.toLowerCase();
    const contentType = lower.endsWith('.jpg') || lower.endsWith('.jpeg')
      ? 'image/jpeg'
      : lower.endsWith('.webp')
      ? 'image/webp'
      : lower.endsWith('.gif')
      ? 'image/gif'
      : lower.endsWith('.svg')
      ? 'image/svg+xml'
      : 'image/png';
    res.setHeader('Content-Type', contentType);
    stream.pipe(res);
  } catch (e) {
    logger.error('Failed to stream asset', { key, error: getErrorMessage(e) });
    res.status(404).json({ success: false, error: 'not found' });
  }
});

// GET /api/ai-enhancement/splits/:splitId/summary
router.get('/splits/:splitId/summary', async (req: Request, res: Response) => {
  const { splitId } = req.params;
  try {
    const split = await designSplitRepo.findById(splitId);
    if (!split) return res.status(404).json({ success: false, error: 'DesignSplit not found' });

    const assets = await designSplitRepo.listAssets(splitId);
    const sections = assets
      .filter((a: any) => a.kind === 'json')
      .map((a: any, i: number) => {
        const m: any = a.meta || {};
        return {
          id: m.id || m.sectionId || `section_${i + 1}`,
          name: m.name || m.type || `Section ${i + 1}`,
          type: (m.type || 'content') as string,
          bounds: m.bounds || undefined,
          description: m.splittingRationale || undefined,
        };
      });

    const imageUrl = split.designUpload?.storageUrl || null;
    return res.json({ success: true, data: { designSplitId: splitId, imageUrl, sections } });
  } catch (e) {
    logger.error('Failed to get split summary', { splitId, error: getErrorMessage(e) });
    return res.status(500).json({ success: false, error: 'Failed to get split summary' });
  }
});

// GET /api/ai-enhancement/splits/recent
router.get('/splits/recent', async (req: Request, res: Response) => {
  try {
    const limitRaw = Number(req.query.limit || 20);
    const limit = Math.min(isNaN(limitRaw) ? 20 : limitRaw, 100);
    const recent = await designSplitRepo.listRecent(limit);

    // Optionally enrich with a rough sectionCount from json assets.
    const items = await Promise.all(
      recent.map(async (s: any) => {
        let sectionCount = 0;
        try {
          const assets = await designSplitRepo.listAssets(s.id);
          sectionCount = assets.filter((a: any) => a.kind === 'json').length;
        } catch {}
        return {
          designSplitId: s.id,
          createdAt: s.createdAt,
          name: (s as any).name || undefined,
          designUploadId: s.designUploadId,
          sectionCount,
        };
      })
    );

    return res.json({ success: true, data: { items } });
  } catch (e) {
    logger.error('Failed to get recent splits', { error: getErrorMessage(e) });
    res.status(500).json({ success: false, error: 'Failed to get recent splits' });
  }
});

export default router;
