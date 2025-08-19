import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { PipelineExecutor } from '../services/pipeline/PipelineExecutor';
import { HTMLGenerator } from '../services/ai/generation/HTMLGenerator';
import { IterativeRefinement } from '../services/ai/analysis/IterativeRefinement';
import sharp from 'sharp';

const logger = createLogger();

// Service resolution helpers
export type Services = {
  pipelineExecutor: any;
  htmlGenerator: any;
  iterativeRefinement: any;
};

export function resolveServices(overrides?: Partial<Services>): Services {
  const resolvedPE =
    overrides?.pipelineExecutor ||
    (typeof (PipelineExecutor as any)?.getInstance === 'function'
      ? (PipelineExecutor as any).getInstance()
      : undefined) ||
    (PipelineExecutor as any)?.default ||
    (PipelineExecutor as any);

  const resolvedHG =
    overrides?.htmlGenerator ||
    (typeof (HTMLGenerator as any)?.getInstance === 'function'
      ? (HTMLGenerator as any).getInstance()
      : undefined) ||
    (HTMLGenerator as any)?.default ||
    (HTMLGenerator as any);

  const resolvedIR =
    overrides?.iterativeRefinement ||
    (typeof (IterativeRefinement as any)?.getInstance === 'function'
      ? (IterativeRefinement as any).getInstance()
      : undefined) ||
    (IterativeRefinement as any)?.default ||
    (IterativeRefinement as any);

  return {
    pipelineExecutor: resolvedPE,
    htmlGenerator: resolvedHG,
    iterativeRefinement: resolvedIR,
  } as Services;
}

export async function executePipeline(
  designFile: Express.Multer.File,
  options: any = {},
  deps?: Partial<Services>
): Promise<any> {
  const startTime = Date.now();
  const { pipelineExecutor } = resolveServices(deps);

  logger.info('🚀 Starting modular pipeline execution', {
    fileName: designFile.originalname,
    fileSize: designFile.size,
    mimeType: designFile.mimetype,
    options
  });

  try {
    const pipelineInput = {
      designFile: designFile.buffer,
      fileName: designFile.originalname,
      options: {
        generateModule: options.generateModule !== false,
        includeValidation: options.includeValidation !== false,
        optimizeForPerformance: options.optimizeForPerformance !== false
      }
    };

    const result = await pipelineExecutor.executePipeline(pipelineInput);

    const processingTime = Date.now() - startTime;
    logger.info('✅ Pipeline execution completed successfully', {
      pipelineId: result.id,
      totalTime: processingTime,
      status: result.status,
      phasesCompleted: result.phases?.filter((p: any) => p.status === 'completed').length || 0,
      totalDuration: result.totalDuration
    });

    return result;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('❌ Pipeline execution failed', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      processingTime,
      fileName: designFile.originalname
    });

    const msg = `Pipeline execution failed: ${(error as Error).message}`;
    const maybeErr = createError(msg, 500, 'INTERNAL_ERROR') as unknown;
    if (maybeErr instanceof Error) throw maybeErr;
    throw new Error(msg);
  }
}

export async function convertDesignToHTML(
  designFile: { buffer: Buffer; originalname: string; mimetype: string },
  deps?: Partial<Services>
): Promise<{
  fileName: string;
  fileSize: number;
  analysis: { html: string; sections: any[]; components: any[]; description: string };
}> {
  const { htmlGenerator } = resolveServices(deps);
  const { buffer, originalname, mimetype } = designFile;

  logger.info(`Processing design file: ${originalname} (${mimetype})`);

  try {
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
      framework: 'tailwind'
    });

    return {
      fileName: originalname,
      fileSize: buffer.length,
      analysis: {
        html: analysis.html,
        sections: [],
        components: [],
        description: 'Design converted to HTML using AI'
      }
    };
  } catch (error) {
    logger.error('Design conversion failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fileName: originalname
    });
    throw error;
  }
}

export async function refineHTML(
  params: { html: string; requirements?: string },
  deps?: Partial<Services>
): Promise<{ originalHTML: string; refinedHTML: string; requirements: string | null }> {
  const { iterativeRefinement } = resolveServices(deps);
  const { html, requirements } = params;

  if (!html) {
    throw createError('HTML code is required', 400, 'INPUT_INVALID');
  }

  try {
    const refinementResult = await iterativeRefinement.refineCode({
      html,
      css: '',
      feedback: requirements || 'Improve HTML quality, accessibility, and Tailwind CSS styling',
      maxIterations: 2,
      targetQualityScore: 85
    });

    return {
      originalHTML: html,
      refinedHTML: refinementResult.html,
      requirements: requirements || null
    };
  } catch (error) {
    logger.error('HTML refinement failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      htmlLength: html.length
    });
    throw error;
  }
}

export function getSupportedFileTypes(): {
  supportedTypes: Array<{ type: string; extensions: string[]; description: string }>;
  maxFileSize: string;
  recommendations: string[];
} {
  return {
    supportedTypes: [
      { type: 'image/jpeg', extensions: ['.jpg', '.jpeg'], description: 'JPEG images' },
      { type: 'image/png', extensions: ['.png'], description: 'PNG images' },
      { type: 'image/gif', extensions: ['.gif'], description: 'GIF images' },
      { type: 'image/webp', extensions: ['.webp'], description: 'WebP images' }
    ],
    maxFileSize: '10MB',
    recommendations: [
      'Use high-resolution images for better AI analysis',
      'Ensure design elements are clearly visible',
      'PNG format recommended for designs with text',
      'JPEG format recommended for photographs'
    ]
  };
}

export async function regenerateSectionHTML(params: {
  sectionId: string;
  originalImage?: string;
  customPrompt?: string;
}, deps?: Partial<Services>): Promise<any> {
  const { htmlGenerator } = resolveServices(deps);
  const { sectionId, originalImage, customPrompt } = params;

  logger.info('🔄 Regenerating HTML for section', {
    sectionId,
    hasOriginalImage: !!originalImage,
    hasCustomPrompt: !!customPrompt
  });

  try {
    const generationResult = await htmlGenerator.generateHTML({
      sectionType: 'content',
      imageBase64: originalImage || '',
      designDescription: customPrompt || 'Please regenerate this section with improved HTML quality, better Tailwind 4 styling, and enhanced accessibility.',
      requirements: ['responsive', 'accessible', 'modern'],
      framework: 'tailwind'
    });

    const regeneratedSection = {
      id: sectionId,
      name: `Regenerated Section ${sectionId}`,
      type: 'content',
      html: generationResult.html,
      editableFields: [],
      qualityScore: generationResult.qualityScore,
      regeneratedAt: new Date().toISOString()
    };

    logger.info('✅ Section HTML regenerated successfully', {
      sectionId,
      newHtmlLength: regeneratedSection.html?.length || 0,
      fieldsCount: regeneratedSection.editableFields?.length || 0
    });

    return regeneratedSection;
  } catch (error) {
    logger.error('❌ Section HTML regeneration failed', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      sectionId
    });

    throw createError(
      `Section HTML regeneration failed: ${(error as Error).message}`,
      500,
      'INTERNAL_ERROR'
    );
  }
}
