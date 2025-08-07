import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { PipelineController } from '../controllers/PipelineController';
import { createError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger();
const pipelineController = new PipelineController();

// Configure multer for pipeline uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(createError(
        'Invalid file type. Please upload PNG, JPG, GIF, or WebP files.',
        400,
        'INPUT_INVALID'
      ));
    }
  }
});

/**
 * POST /api/pipeline/execute
 * Execute the full 5-phase quality-focused pipeline
 */
router.post('/execute', upload.single('design'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw createError('No design file uploaded', 400, 'INPUT_INVALID');
    }

    const { originalname, mimetype, buffer, size } = req.file;
    
    logger.info('🚀 Pipeline execution requested', {
      fileName: originalname,
      fileSize: size,
      mimeType: mimetype,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });

    // Execute the quality-focused pipeline
    const result = await pipelineController.executePipeline(req.file);

    logger.info('✅ Pipeline execution completed successfully', {
      fileName: originalname,
      moduleId: result.id,
      qualityScore: result.qualityScore,
      sectionsGenerated: result.sections.length,
      processingTime: result.processingTime
    });

    res.json({
      success: true,
      data: result,
      message: 'Quality-focused pipeline executed successfully',
      metadata: {
        processingTime: result.processingTime,
        sectionsGenerated: result.sections.length,
        averageQualityScore: result.qualityScore,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('❌ Pipeline execution failed', {
      error: error?.message || 'Unknown error',
      stack: error?.stack,
      fileName: req.file?.originalname
    });
    next(error);
  }
});

/**
 * GET /api/pipeline/status/:id
 * Get pipeline execution status (for future real-time tracking)
 */
router.get('/status/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // For now, return a simple status
    // In full implementation, this would track real-time pipeline progress
    res.json({
      success: true,
      data: {
        pipelineId: id,
        status: 'completed', // or 'running', 'failed'
        currentPhase: 'export',
        progress: 100,
        phases: [
          { name: 'Section Detection', status: 'completed', progress: 100 },
          { name: 'AI Generation', status: 'completed', progress: 100 },
          { name: 'Quality Verification', status: 'completed', progress: 100 },
          { name: 'Template Mapping', status: 'completed', progress: 100 },
          { name: 'Final Assembly', status: 'completed', progress: 100 }
        ]
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/pipeline/quality/:id
 * Get detailed quality metrics for a pipeline execution
 */
router.get('/quality/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // For now, return sample quality metrics
    // In full implementation, this would fetch from database
    res.json({
      success: true,
      data: {
        pipelineId: id,
        overallQuality: 87,
        metrics: {
          htmlValidation: 95,
          accessibilityScore: 82,
          tailwindOptimization: 90,
          editabilityScore: 85,
          hubspotCompliance: 88
        },
        sectionQuality: [
          { sectionId: 'section_1', name: 'Header', score: 92 },
          { sectionId: 'section_2', name: 'Hero', score: 85 },
          { sectionId: 'section_3', name: 'Content', score: 83 },
          { sectionId: 'section_4', name: 'Footer', score: 89 }
        ],
        recommendations: [
          'Consider adding more ARIA labels for better accessibility',
          'Optimize image alt text descriptions',
          'Add more responsive breakpoints for mobile devices'
        ]
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pipeline/enhance/:sectionId
 * Enhance a specific section with AI improvements
 */
router.post('/enhance/:sectionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sectionId } = req.params;
    const { enhancementType, options } = req.body;
    
    logger.info('🎨 Section enhancement requested', {
      sectionId,
      enhancementType,
      options
    });

    // For now, return a sample enhancement
    // In full implementation, this would use AI to enhance the section
    res.json({
      success: true,
      data: {
        sectionId,
        enhancementType,
        originalHtml: '<div class="p-4">Original content</div>',
        enhancedHtml: '<div class="p-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-lg">Enhanced content with better styling</div>',
        improvements: [
          'Added gradient background',
          'Improved padding and spacing',
          'Added shadow and rounded corners',
          'Enhanced color contrast'
        ],
        qualityImprovement: {
          before: 75,
          after: 92,
          improvement: 17
        }
      },
      message: 'Section enhanced successfully'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pipeline/regenerate-html
 * Regenerate HTML for a specific section using OpenAI
 */
router.post('/regenerate-html', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sectionId, originalImage, customPrompt } = req.body;
    
    if (!sectionId) {
      throw createError('Section ID is required', 400, 'INPUT_INVALID');
    }
    
    logger.info('🔄 HTML regeneration requested', {
      sectionId,
      hasOriginalImage: !!originalImage,
      hasCustomPrompt: !!customPrompt,
      timestamp: new Date().toISOString()
    });

    // Use the pipeline controller to regenerate HTML for the section
    const regeneratedSection = await pipelineController.regenerateSectionHTML({
      sectionId,
      originalImage,
      customPrompt: customPrompt || 'Please regenerate this section with improved HTML quality, better Tailwind 4 styling, and enhanced accessibility.'
    });

    logger.info('✅ HTML regeneration completed successfully', {
      sectionId,
      newHtmlLength: regeneratedSection.html.length,
      fieldsCount: regeneratedSection.editableFields?.length || 0,
      qualityScore: regeneratedSection.qualityScore
    });

    res.json({
      success: true,
      data: regeneratedSection,
      message: 'HTML regenerated successfully',
      metadata: {
        sectionId,
        regeneratedAt: new Date().toISOString(),
        htmlLength: regeneratedSection.html.length,
        fieldsGenerated: regeneratedSection.editableFields?.length || 0
      }
    });

  } catch (error: any) {
    logger.error('❌ HTML regeneration failed', {
      error: error?.message || 'Unknown error',
      stack: error?.stack,
      sectionId: req.body?.sectionId
    });
    next(error);
  }
});

/**
 * GET /api/pipeline/supported-types
 * Get supported file types and requirements
 */
router.get('/supported-types', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      supportedTypes: [
        {
          type: 'image/jpeg',
          extensions: ['.jpg', '.jpeg'],
          description: 'JPEG images'
        },
        {
          type: 'image/png', 
          extensions: ['.png'],
          description: 'PNG images (recommended for designs with text)'
        },
        {
          type: 'image/gif',
          extensions: ['.gif'], 
          description: 'GIF images'
        },
        {
          type: 'image/webp',
          extensions: ['.webp'],
          description: 'WebP images'
        }
      ],
      maxFileSize: '10MB',
      recommendations: [
        'Use high-resolution images for better AI analysis',
        'Ensure design elements are clearly visible',
        'PNG format recommended for designs with text',
        'JPEG format recommended for photographs',
        'Avoid very complex designs for better section detection'
      ],
      qualityGuidelines: [
        'Designs should have clear visual sections',
        'Text should be readable and well-contrasted',
        'UI elements should be distinguishable',
        'Layouts should follow standard web patterns'
      ]
    }
  });
});

export default router;
