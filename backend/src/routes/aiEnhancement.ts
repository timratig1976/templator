import express from 'express';
import { EnhancedAIService } from '../services/ai/EnhancedAIService';
import { FineTuningService } from '../services/ai/FineTuningService';
import openaiService, { OpenAIService, Section, EditableField, Component } from '../services/ai/openaiService';
import { createLogger } from '../utils/logger';
import { logToFrontend } from '../routes/logs';
import { v4 as uuidv4 } from 'uuid';

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

// Helper function to generate basic splitting suggestions (fallback)
function generateBasicSplittingSuggestions(fileName: string) {
  return [
    {
      id: 'header-section',
      name: 'Header Section',
      type: 'header',
      bounds: { x: 0, y: 0, width: 100, height: 15 }, // Percentage-based
      confidence: 0.8,
      description: 'Top navigation and branding area',
      suggested: true
    },
    {
      id: 'hero-section',
      name: 'Hero Section',
      type: 'hero',
      bounds: { x: 0, y: 15, width: 100, height: 35 },
      confidence: 0.7,
      description: 'Main banner or hero content area',
      suggested: true
    },
    {
      id: 'content-section',
      name: 'Main Content',
      type: 'content',
      bounds: { x: 0, y: 50, width: 100, height: 40 },
      confidence: 0.9,
      description: 'Primary content area',
      suggested: true
    },
    {
      id: 'footer-section',
      name: 'Footer Section',
      type: 'footer',
      bounds: { x: 0, y: 90, width: 100, height: 10 },
      confidence: 0.8,
      description: 'Footer links and information',
      suggested: true
    }
  ];
}

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
                url: `data:image/jpeg;base64,${imageBase64}`
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
      sectionTypes: Object.keys(sectionTypeDistribution).join(', '),
      processingTime: `${Date.now() - Date.parse(new Date().toISOString())}ms`
    }, requestId);

    return suggestions;

  } catch (error: any) {
    logger.error(`[${requestId}] Error in AI section detection: ${error.message}`, {
      requestId,
      error: error.message,
      stack: error.stack
    });

    logToFrontend('error', 'openai', '❌ AI section detection failed, using fallback', {
      error: error.message
    }, requestId);

    // Fallback to basic suggestions if AI fails
    return generateBasicSplittingSuggestions(fileName);
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

/**
 * Helper function to validate base64 image format
 */
function isValidBase64Image(base64String: string): boolean {
  try {
    // Check if it's a data URL format
    if (!base64String || typeof base64String !== 'string') {
      logger.error('Invalid base64 string: not a string or empty');
      return false;
    }
    
    if (!base64String.startsWith('data:image/')) {
      logger.error('Invalid base64 string: does not start with data:image/');
      return false;
    }
    
    // More flexible regex that handles various image formats
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,([A-Za-z0-9+\/=\s]*)$/;
    const match = base64String.match(base64Regex);
    
    if (!match) {
      logger.error('Invalid base64 string: does not match expected format');
      logger.error('String preview:', base64String.substring(0, 100) + '...');
      return false;
    }
    
    // Validate base64 characters (allow whitespace which we'll strip)
    const base64Part = match[2].replace(/\s/g, ''); // Remove any whitespace
    const validBase64Regex = /^[A-Za-z0-9+\/=]*$/;
    
    if (!validBase64Regex.test(base64Part)) {
      logger.error('Invalid base64 string: contains invalid characters');
      return false;
    }
    
    // Check if length is valid (must be multiple of 4 after padding)
    const paddedLength = Math.ceil(base64Part.length / 4) * 4;
    if (base64Part.length > 0 && paddedLength - base64Part.length > 2) {
      logger.error('Invalid base64 string: invalid length', { length: base64Part.length });
      return false;
    }
    
    // Try to decode to verify it's valid base64
    try {
      Buffer.from(base64Part, 'base64');
    } catch (decodeError) {
      logger.error('Invalid base64 string: cannot decode', { error: decodeError });
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error('Error validating base64 image:', error);
    return false;
  }
}

/**
 * POST /api/ai-enhancement/detect-sections
 * Lightweight section detection for splitting suggestions
 */
router.post('/detect-sections', async (req, res) => {
  const requestId = req.body.requestId || uuidv4();
  const startTime = Date.now();
  
  try {
    const { image, fileName, analysisType = 'lightweight' } = req.body;
    
    // Validate required fields
    if (!image) {
      logger.warn(`[${requestId}] Missing image in detect-sections request`);
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: image',
        code: 'MISSING_IMAGE'
      });
    }
    
    logger.info(`[${requestId}] Starting lightweight section detection`, {
      requestId,
      fileName: fileName || 'unknown',
      analysisType
    });
    
    logToFrontend('info', 'processing', `🔍 Starting lightweight section detection for ${fileName || 'design'}`, { fileName, analysisType }, requestId);
    
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
    
    // Use AI to analyze the design and suggest intelligent section splits
    const suggestions = await generateAISplittingSuggestions(image, fileName || 'design', requestId);
    
    const duration = Date.now() - startTime;
    
    logger.info(`[${requestId}] Section detection completed`, {
      requestId,
      duration,
      suggestionsCount: suggestions.length
    });
    
    logToFrontend('success', 'processing', `✅ Section detection completed in ${duration}ms with ${suggestions.length} suggestions`, { suggestionsCount: suggestions.length }, requestId, duration);
    
    return res.status(200).json({
      success: true,
      suggestions,
      meta: {
        processingTime: duration,
        requestId,
        analysisType: 'lightweight',
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
router.post('/analyze-layout', async (req, res) => {
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

export default router;
