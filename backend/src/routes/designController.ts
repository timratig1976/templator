import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import { createError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { HTMLGenerator } from '../services/ai/generation/HTMLGenerator';
import { IterativeRefinement } from '../services/ai/analysis/IterativeRefinement';

const logger = createLogger();

// Singletons (same pattern used by class-based controller)
const htmlGenerator = typeof (HTMLGenerator as any)?.getInstance === 'function'
  ? (HTMLGenerator as any).getInstance()
  : (HTMLGenerator as any)?.default || (HTMLGenerator as any);

const iterativeRefinement = typeof (IterativeRefinement as any)?.getInstance === 'function'
  ? (IterativeRefinement as any).getInstance()
  : (IterativeRefinement as any)?.default || (IterativeRefinement as any);

export function getSupportedFileTypes() {
  return {
    supportedTypes: [
      { type: 'image/jpeg', extensions: ['.jpg', '.jpeg'], description: 'JPEG images' },
      { type: 'image/png', extensions: ['.png'], description: 'PNG images' },
      { type: 'image/gif', extensions: ['.gif'], description: 'GIF images' },
      { type: 'image/webp', extensions: ['.webp'], description: 'WebP images' },
    ],
    maxFileSize: '10MB',
    recommendations: [
      'Use high-resolution images for better AI analysis',
      'Ensure design elements are clearly visible',
      'PNG format recommended for designs with text',
      'JPEG format recommended for photographs',
    ],
  };
}

export async function convertDesignToHTMLFromUpload(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw createError('No file uploaded', 400, 'INPUT_INVALID');
    }

    const { buffer, originalname, mimetype } = req.file;

    // Process image file with Sharp (as in class-based controller)
    if (mimetype === 'application/pdf') {
      throw createError(
        'PDF conversion not yet supported. Please upload an image file (PNG, JPG, etc.)',
        400,
        'INPUT_INVALID'
      );
    }

    const processedImage = await sharp(buffer)
      .resize(1920, null, { withoutEnlargement: true, fit: 'inside' })
      .jpeg({ quality: 85 })
      .toBuffer();

    const imageBase64 = processedImage.toString('base64');

    const analysis = await htmlGenerator.generateHTML({
      sectionType: 'hero',
      imageBase64,
      designDescription: `Design file: ${originalname}`,
      requirements: ['Convert this design to modern HTML with Tailwind CSS'],
      framework: 'tailwind',
    });

    res.json({
      success: true,
      data: {
        packagedModule: { name: originalname, id: originalname, status: 'completed' },
        fileName: originalname,
        fileSize: buffer.length,
        analysis: {
          html: analysis.html,
          sections: [],
          components: [],
          description: 'Design converted to HTML using AI',
        },
      },
      message: 'Design successfully converted to HTML',
    });
  } catch (error) {
    logger.error('Design conversion failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fileName: req.file?.originalname,
    });
    next(error);
  }
}

export async function refineHTMLHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { html, requirements } = req.body as { html: string; requirements?: string };
    if (!html) {
      throw createError('HTML code is required', 400, 'INPUT_INVALID');
    }

    const refinementResult = await iterativeRefinement.refineCode({
      html,
      css: '',
      feedback: requirements || 'Improve HTML quality, accessibility, and Tailwind CSS styling',
      maxIterations: 2,
      targetQualityScore: 85,
    });

    res.json({
      success: true,
      data: {
        originalHTML: html,
        refinedHTML: refinementResult.html,
        requirements: requirements || null,
      },
      message: 'HTML successfully refined',
    });
  } catch (error) {
    logger.error('HTML refinement failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      htmlLength: (req.body?.html || '').length,
    });
    next(error);
  }
}
