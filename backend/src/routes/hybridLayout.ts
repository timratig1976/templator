import { Router } from 'express';
import { Request, Response } from 'express';
import multer from 'multer';
import { createLogger } from '../utils/logger';
import openaiService from '../services/ai/openaiService';
import { createError } from '../middleware/errorHandler';

const router = Router();
const logger = createLogger();

// Configure multer for image uploads with proper error handling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error: any = new Error('Invalid file type. Only images are allowed.');
      error.code = 'INVALID_FILE_TYPE';
      cb(error);
    }
  },
});

// Multer error handling middleware
function handleMulterError(error: any, req: any, res: any, next: any) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.',
        code: 'FILE_TOO_LARGE'
      });
    }
    return res.status(400).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
  
  if (error && error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  next(error);
}

/**
 * POST /api/hybrid-layout/analyze
 * Analyze image with OpenAI Vision for initial section detection
 */
router.post('/analyze', (req: Request, res: Response, next: any) => {
  // Check if request has multipart content type
  const contentType = req.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({
      success: false,
      error: 'No image file provided. Expected multipart/form-data with image field.',
      code: 'INPUT_INVALID',
      requestId: `hybrid_analyze_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
  }
  
  // Apply multer middleware for multipart requests
  upload.single('image')(req, res, (err: any) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, async (req: Request, res: Response) => {
  const requestId = `hybrid_analyze_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
        code: 'INPUT_INVALID',
        requestId
      });
    }

    logger.info('Starting hybrid layout analysis', {
      requestId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    // Convert buffer to base64
    const imageBase64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${imageBase64}`;

    // Use existing OpenAI Vision integration
    const analysis = await openaiService.convertDesignToHTML(dataUri, req.file.originalname);

    // Transform the analysis into the format expected by the hybrid component
    const hybridSections = analysis.sections.map((section, index) => ({
      id: section.id,
      name: section.name,
      type: section.type,
      bounds: {
        // Generate reasonable bounds based on section order and type
        x: getDefaultX(section.type, index),
        y: getDefaultY(section.type, index),
        width: getDefaultWidth(section.type),
        height: getDefaultHeight(section.type)
      },
      html: section.html,
      editableFields: section.editableFields,
      aiConfidence: calculateAIConfidence(section) // Calculate confidence based on section complexity
    }));

    const response = {
      success: true,
      data: {
        originalAnalysis: analysis,
        hybridSections,
        imageMetadata: {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          dimensions: await getImageDimensions(req.file.buffer)
        }
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - parseInt(requestId.split('_')[2])
      }
    };

    logger.info('Hybrid layout analysis completed', {
      requestId,
      sectionsDetected: hybridSections.length,
      averageConfidence: hybridSections.reduce((sum, s) => sum + s.aiConfidence, 0) / hybridSections.length
    });

    res.json(response);
  } catch (error) {
    logger.error('Hybrid layout analysis failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze layout',
      requestId
    });
  }
});

/**
 * POST /api/hybrid-layout/generate
 * Generate HTML from user-confirmed sections
 */
router.post('/generate', async (req: Request, res: Response) => {
  const requestId = `hybrid_generate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { sections, imageMetadata } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sections data. Expected an array of sections.',
        code: 'INPUT_INVALID',
        requestId
      });
    }

    if (sections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Sections array cannot be empty.',
        code: 'EMPTY_SECTIONS',
        requestId
      });
    }

    logger.info('Starting HTML generation from hybrid sections', {
      requestId,
      sectionsCount: sections.length,
      imageFileName: imageMetadata?.fileName
    });

    // Transform user-confirmed sections back to the format expected by the pipeline
    const transformedSections = sections.map((section: any) => ({
      id: section.id,
      name: section.name,
      type: section.type,
      html: section.html,
      editableFields: section.editableFields || []
    }));

    // Generate enhanced HTML using the existing AI service
    const enhancedHTML = await generateEnhancedHTML(transformedSections);

    // Create the final analysis object
    const finalAnalysis = {
      html: enhancedHTML,
      sections: transformedSections,
      components: extractComponents(transformedSections),
      description: `User-refined layout with ${sections.length} sections: ${sections.map((s: any) => s.name).join(', ')}`
    };

    const response = {
      success: true,
      data: {
        analysis: finalAnalysis,
        userModifications: calculateUserModifications(sections),
        qualityScore: calculateQualityScore(finalAnalysis)
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - parseInt(requestId.split('_')[2])
      }
    };

    logger.info('HTML generation from hybrid sections completed', {
      requestId,
      htmlLength: enhancedHTML.length,
      sectionsProcessed: transformedSections.length
    });

    res.json(response);
  } catch (error) {
    logger.error('HTML generation from hybrid sections failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate HTML',
      requestId
    });
  }
});

// Helper functions

/**
 * Get default X position based on section type and index
 */
function getDefaultX(type: string, index: number): number {
  const typeDefaults = {
    header: 0,
    navigation: 0,
    hero: 0,
    content: 50,
    sidebar: 600,
    footer: 0
  };
  return typeDefaults[type as keyof typeof typeDefaults] || (index * 50);
}

/**
 * Get default Y position based on section type and index
 */
function getDefaultY(type: string, index: number): number {
  const typeDefaults = {
    header: 0,
    navigation: 60,
    hero: 120,
    content: 400,
    sidebar: 400,
    footer: 800
  };
  return typeDefaults[type as keyof typeof typeDefaults] || (index * 100);
}

/**
 * Get default width based on section type
 */
function getDefaultWidth(type: string): number {
  const typeDefaults = {
    header: 800,
    navigation: 800,
    hero: 800,
    content: 500,
    sidebar: 200,
    footer: 800
  };
  return typeDefaults[type as keyof typeof typeDefaults] || 400;
}

/**
 * Get default height based on section type
 */
function getDefaultHeight(type: string): number {
  const typeDefaults = {
    header: 80,
    navigation: 50,
    hero: 300,
    content: 200,
    sidebar: 300,
    footer: 100
  };
  return typeDefaults[type as keyof typeof typeDefaults] || 150;
}

/**
 * Calculate AI confidence based on section complexity and content
 */
function calculateAIConfidence(section: any): number {
  let confidence = 0.7; // Base confidence
  
  // Increase confidence for well-structured sections
  if (section.editableFields && section.editableFields.length > 0) {
    confidence += 0.1;
  }
  
  // Increase confidence for common section types
  if (['header', 'hero', 'footer'].includes(section.type)) {
    confidence += 0.1;
  }
  
  // Increase confidence based on HTML complexity
  if (section.html && section.html.length > 100) {
    confidence += 0.05;
  }
  
  return Math.min(0.95, confidence); // Cap at 95%
}

/**
 * Get image dimensions from buffer
 */
async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  // This is a simplified implementation
  // In a real application, you might use a library like 'sharp' or 'image-size'
  return { width: 800, height: 600 }; // Default dimensions
}

/**
 * Generate enhanced HTML from sections
 */
async function generateEnhancedHTML(sections: any[]): Promise<string> {
  // Combine all section HTML into a complete page
  const sectionsHTML = sections.map(section => section.html).join('\n\n');
  
  // Use the existing AI service to enhance the combined HTML
  const enhancedHTML = await openaiService.refineHTML(sectionsHTML, 
    'Ensure responsive design, proper semantic structure, and Tailwind CSS best practices'
  );
  
  return enhancedHTML;
}

/**
 * Extract components from sections
 */
function extractComponents(sections: any[]): any[] {
  const components: any[] = [];
  
  sections.forEach(section => {
    // Extract common components from HTML
    if (section.html.includes('button')) {
      components.push({
        id: `btn_${section.id}`,
        name: 'Button',
        type: 'button',
        selector: 'button',
        defaultValue: 'Click me'
      });
    }
    
    if (section.html.includes('<img')) {
      components.push({
        id: `img_${section.id}`,
        name: 'Image',
        type: 'image',
        selector: 'img',
        defaultValue: 'placeholder.jpg'
      });
    }
    
    if (section.html.includes('<h1') || section.html.includes('<h2')) {
      components.push({
        id: `heading_${section.id}`,
        name: 'Heading',
        type: 'text',
        selector: 'h1, h2',
        defaultValue: 'Your Heading'
      });
    }
  });
  
  return components;
}

/**
 * Calculate user modifications compared to AI suggestions
 */
function calculateUserModifications(sections: any[]): any {
  const modifications = {
    sectionsAdded: 0,
    sectionsRemoved: 0,
    sectionsModified: 0,
    positionsChanged: 0,
    typesChanged: 0
  };
  
  sections.forEach(section => {
    if (section.aiConfidence === 0) {
      modifications.sectionsAdded++;
    } else if (section.aiConfidence < 0.5) {
      modifications.sectionsModified++;
    }
  });
  
  return modifications;
}

/**
 * Calculate quality score for the final analysis
 */
function calculateQualityScore(analysis: any): number {
  let score = 70; // Base score
  
  // Add points for number of sections
  score += Math.min(20, analysis.sections.length * 3);
  
  // Add points for components
  score += Math.min(10, analysis.components.length * 2);
  
  return Math.min(100, score);
}

export default router;
