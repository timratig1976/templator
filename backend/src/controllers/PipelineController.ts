import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { PipelineExecutor } from '../services/pipeline/PipelineExecutor';
import { HTMLGenerator } from '../services/ai/generation/HTMLGenerator';
import { IterativeRefinement } from '../services/ai/analysis/IterativeRefinement';
import sharp from 'sharp';

const logger = createLogger();

// ===== Modern function-based API =====
type Services = {
  pipelineExecutor: any;
  htmlGenerator: any;
  iterativeRefinement: any;
};

function resolveServices(overrides?: Partial<Services>): Services {
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

/**
 * PipelineController - Unified pipeline controller using domain-driven services
 * Uses PipelineExecutor as single source of truth for pipeline orchestration
 */
export class PipelineController {
  private pipelineExecutor: PipelineExecutor;
  private htmlGenerator: HTMLGenerator;
  private iterativeRefinement: IterativeRefinement;

  // Allow DI for testing; fall back to singletons in production
  constructor(
    pipelineExecutor?: any,
    htmlGenerator?: any,
    iterativeRefinement?: any
  ) {
    // Resolve PipelineExecutor with robust fallbacks for Jest mocks
    const resolvedPE =
      pipelineExecutor ||
      (typeof (PipelineExecutor as any)?.getInstance === 'function'
        ? (PipelineExecutor as any).getInstance()
        : undefined) ||
      (PipelineExecutor as any)?.default ||
      (PipelineExecutor as any);
    this.pipelineExecutor = resolvedPE;

    // Resolve HTMLGenerator with robust fallbacks
    const resolvedHG =
      htmlGenerator ||
      (typeof (HTMLGenerator as any)?.getInstance === 'function'
        ? (HTMLGenerator as any).getInstance()
        : undefined) ||
      (HTMLGenerator as any)?.default ||
      (HTMLGenerator as any);
    this.htmlGenerator = resolvedHG;

    // Resolve IterativeRefinement with robust fallbacks
    const resolvedIR =
      iterativeRefinement ||
      (typeof (IterativeRefinement as any)?.getInstance === 'function'
        ? (IterativeRefinement as any).getInstance()
        : undefined) ||
      (IterativeRefinement as any)?.default ||
      (IterativeRefinement as any);
    this.iterativeRefinement = resolvedIR;
  }

  async executePipeline(
    designFile: Express.Multer.File,
    options: any = {}
  ): Promise<any> {
    return executePipeline(designFile, options, {
      pipelineExecutor: this.pipelineExecutor,
    });
  }

  /**
   * Get pipeline status (for compatibility with existing API)
   */
  async getPipelineStatus(pipelineId: string): Promise<{ status: string; progress: number }> {
    // This is a simplified implementation for API compatibility
    // In a full implementation, this would track actual pipeline progress
    logger.info('Getting pipeline status', { pipelineId });
    
    return {
      status: 'completed', // Simplified - in reality this would track actual status
      progress: 100
    };
  }

  /**
   * Enhance specific sections (for compatibility with existing API)
   */
  async enhanceSections(
    sections: any[], 
    options?: { qualityThreshold?: number }
  ): Promise<any[]> {
    logger.info('Enhancing sections', { 
      sectionCount: sections.length,
      options 
    });

    // This is a simplified implementation for API compatibility
    // In a full implementation, this would use the EnhancementPhase directly
    return sections.map(section => ({
      ...section,
      qualityScore: Math.min(100, section.qualityScore + 10), // Simple enhancement
      enhanced: true
    }));
  }

  /**
   * Get quality metrics for sections (for compatibility with existing API)
   */
  async getQualityMetrics(sections: any[]): Promise<{
    overall: number;
    breakdown: Record<string, number>;
  }> {
    logger.info('Calculating quality metrics', { sectionCount: sections.length });

    const totalQuality = sections.reduce((sum, section) => sum + (section.qualityScore || 0), 0);
    const averageQuality = sections.length > 0 ? totalQuality / sections.length : 0;

    return {
      overall: Math.round(averageQuality),
      breakdown: {
        htmlStructure: Math.round(averageQuality * 0.9),
        accessibility: Math.round(averageQuality * 0.8),
        tailwindOptimization: Math.round(averageQuality * 0.85),
        hubspotCompliance: Math.round(averageQuality * 0.95),
        editability: Math.round(averageQuality * 0.9),
        performance: Math.round(averageQuality * 0.8)
      }
    };
  }

  /**
   * Regenerate HTML for a specific section using OpenAI
   */
  async regenerateSectionHTML(params: {
    sectionId: string;
    originalImage?: string;
    customPrompt?: string;
  }): Promise<any> {
    const { sectionId, originalImage, customPrompt } = params;
    
    logger.info('🔄 Regenerating HTML for section', {
      sectionId,
      hasOriginalImage: !!originalImage,
      hasCustomPrompt: !!customPrompt
    });

    try {
      // Use HTMLGenerator to regenerate HTML for a specific section
      const generationResult = await this.htmlGenerator.generateHTML({
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

  /** Get supported file types (for compatibility with existing API) */
  getSupportedTypes(): string[] {
    return ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  }

  // ===== LEGACY DESIGN CONTROLLER METHODS (MIGRATED) =====

  /** Convert uploaded design file to HTML/Tailwind CSS (Legacy API) */
  async convertDesignToHTML(designFile: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<{
    fileName: string;
    fileSize: number;
    analysis: {
      html: string;
      sections: any[];
      components: any[];
      description: string;
    };
  }> {
    return convertDesignToHTML(designFile, { htmlGenerator: this.htmlGenerator });
  }

  /** Refine generated HTML code (Legacy API) */
  async refineHTML(params: {
    html: string;
    requirements?: string;
  }): Promise<{
    originalHTML: string;
    refinedHTML: string;
    requirements: string | null;
  }> {
    return refineHTML(params, { iterativeRefinement: this.iterativeRefinement });
  }

  /** Get supported file types with detailed information (Legacy API) */
  getSupportedFileTypes(): {
    supportedTypes: Array<{
      type: string;
      extensions: string[];
      description: string;
    }>;
    maxFileSize: string;
    recommendations: string[];
  } {
    return getSupportedFileTypes();
  }
}
