import { PhaseHandler, PipelineContext } from '../base/PhaseHandler';
import sharp from 'sharp';
import { DesignFile, ProcessedInput, DesignSection, DesignComplexity } from '../types/PipelineTypes';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

/**
 * Phase 1: Input Processing & Upload
 * Handles file validation, image processing, complexity analysis, and section detection
 */
export class InputProcessingPhase extends PhaseHandler<DesignFile, ProcessedInput> {
  constructor() {
    super('Input Processing');
  }

  protected async execute(input: DesignFile, context: PipelineContext): Promise<ProcessedInput> {
    this.validateInput(input, context);

    const startTime = Date.now();

    // Step 1: Convert file to base64 for AI processing
    const imageBase64 = this.convertToBase64(input);
    
    // Step 2: Analyze design complexity
    const complexity = this.analyzeDesignComplexity(input);
    
    // Step 3: Detect logical sections (simplified for now)
    const sections = await this.detectSections(imageBase64, complexity);
    
    const processingTime = Date.now() - startTime;

    return {
      pipelineId: context.pipelineId,
      imageBase64,
      complexity,
      sections,
      metadata: {
        fileName: input.originalname,
        fileSize: input.size,
        mimeType: input.mimetype,
        processingTime
      }
    };
  }

  protected calculateQualityScore(output: ProcessedInput): number {
    let score = 70; // Base score

    // Adjust based on file quality
    if (output.metadata.fileSize > 100 * 1024) score += 10; // Larger files usually have more detail
    if (output.metadata.mimeType === 'image/png') score += 5; // PNG often better for designs
    
    // Adjust based on complexity analysis
    switch (output.complexity.estimatedComplexity) {
      case 'high': score += 15; break;
      case 'medium': score += 10; break;
      case 'low': score += 5; break;
    }

    // Adjust based on sections detected
    if (output.sections.length >= 3) score += 10;
    if (output.sections.length >= 5) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  protected getWarnings(output: ProcessedInput): string[] {
    const warnings: string[] = [];

    if (output.metadata.fileSize < 50 * 1024) {
      warnings.push('Small file size may result in lower quality analysis');
    }

    if (output.metadata.fileSize > 5 * 1024 * 1024) {
      warnings.push('Large file size may increase processing time');
    }

    if (output.sections.length < 2) {
      warnings.push('Few sections detected - consider using a more structured design');
    }

    if (output.complexity.estimatedComplexity === 'low') {
      warnings.push('Low complexity design may produce simpler output');
    }

    return warnings;
  }

  protected getMetadata(output: ProcessedInput, context: PipelineContext): Record<string, any> {
    return {
      sectionsDetected: output.sections.length,
      complexityLevel: output.complexity.estimatedComplexity,
      recommendedSections: output.complexity.recommendedSections,
      imageFormat: output.metadata.mimeType,
      fileSizeKB: Math.round(output.metadata.fileSize / 1024),
      base64Length: output.imageBase64.length
    };
  }

  protected createFallbackResult(context: PipelineContext): ProcessedInput {
    logger.warn('Creating fallback result for input processing', {
      pipelineId: context.pipelineId,
      fileName: context.metadata.fileName
    });

    return {
      pipelineId: context.pipelineId,
      imageBase64: '', // Empty base64
      complexity: {
        sizeKB: context.metadata.fileSize / 1024,
        recommendedSections: 3,
        estimatedComplexity: 'medium',
        processingHints: ['Fallback processing used']
      },
      sections: this.getDefaultSections(),
      metadata: {
        fileName: context.metadata.fileName,
        fileSize: context.metadata.fileSize,
        mimeType: context.metadata.mimeType,
        processingTime: 0
      }
    };
  }

  /**
   * Convert file buffer to base64 string
   */
  private convertToBase64(file: DesignFile): string {
    try {
      return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    } catch (error) {
      throw this.createPhaseError(`Failed to convert file to base64: ${(error as Error).message}`);
    }
  }

  /**
   * Analyze design complexity based on file characteristics
   */
  private analyzeDesignComplexity(file: DesignFile): DesignComplexity {
    const sizeKB = file.size / 1024;
    let recommendedSections = 3;
    let estimatedComplexity: 'low' | 'medium' | 'high' = 'medium';
    const processingHints: string[] = [];

    // Determine complexity based on file size
    if (sizeKB > 500) {
      recommendedSections = 6;
      estimatedComplexity = 'high';
      processingHints.push('Large file suggests complex design');
    } else if (sizeKB > 200) {
      recommendedSections = 4;
      estimatedComplexity = 'medium';
      processingHints.push('Medium file size suggests moderate complexity');
    } else if (sizeKB > 100) {
      recommendedSections = 3;
      estimatedComplexity = 'medium';
    } else {
      recommendedSections = 2;
      estimatedComplexity = 'low';
      processingHints.push('Small file may have limited detail');
    }

    // Adjust based on file type
    if (file.mimetype === 'image/png') {
      processingHints.push('PNG format good for designs with text');
    } else if (file.mimetype === 'image/jpeg') {
      processingHints.push('JPEG format good for photographic content');
    }

    return {
      sizeKB,
      recommendedSections,
      estimatedComplexity,
      processingHints
    };
  }

  /**
   * Detect logical sections in the design (simplified implementation)
   * In the full implementation, this would use AI for section detection
   */
  private async detectSections(imageBase64: string, complexity: DesignComplexity): Promise<DesignSection[]> {
    const sections: DesignSection[] = [];
    const sectionCount = complexity.recommendedSections;

    // Create default sections based on complexity
    const sectionTypes: Array<'header' | 'hero' | 'content' | 'features' | 'footer' | 'navigation' | 'sidebar'> = 
      ['header', 'hero', 'content', 'features', 'footer', 'navigation', 'sidebar'];

    for (let i = 0; i < sectionCount && i < sectionTypes.length; i++) {
      const sectionType = sectionTypes[i];
      // Crop the image for this section
      let originalImage = imageBase64;
      try {
        // Decode base64 to buffer
        const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          // For simplicity, we assume vertical slicing
          const metadata = await sharp(buffer).metadata();
          const height = metadata.height || 1000;
          const width = metadata.width || 1000;
          const sectionHeight = Math.floor(height / sectionCount);
          const top = i * sectionHeight;
          const cropped = await sharp(buffer)
            .extract({ left: 0, top, width, height: sectionHeight })
            .toBuffer();
          originalImage = `data:${mimeType};base64,${cropped.toString('base64')}`;
        }
      } catch (err) {
        // fallback to full image
        originalImage = imageBase64;
      }
      sections.push({
        id: `section_${i + 1}`,
        name: this.getSectionName(sectionType),
        type: sectionType,
        originalImage, // assign cropped image
        bounds: {
          x: 0,
          y: (i * 100) / sectionCount,
          width: 100,
          height: 100 / sectionCount
        },
        complexity: Math.floor(Math.random() * 5) + 1, // Simplified
        estimatedElements: Math.floor(Math.random() * 10) + 3
      });
    }

    return sections;
  }

  /**
   * Get default sections when section detection fails
   */
  private getDefaultSections(): DesignSection[] {
    return [
      {
        id: 'section_1',
        name: 'Main Section',
        type: 'content',
        imageData: '',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        complexity: 3,
        estimatedElements: 5
      }
    ];
  }

  /**
   * Get human-readable section name
   */
  private getSectionName(type: string): string {
    const names: Record<string, string> = {
      header: 'Header',
      hero: 'Hero Section',
      content: 'Main Content',
      features: 'Features',
      footer: 'Footer',
      navigation: 'Navigation',
      sidebar: 'Sidebar'
    };
    return names[type] || 'Section';
  }

  protected validateInput(input: DesignFile, context: PipelineContext): void {
    super.validateInput(input, context);

    if (!input.buffer || input.buffer.length === 0) {
      throw this.createPhaseError('File buffer is empty');
    }

    if (!input.originalname) {
      throw this.createPhaseError('File name is required');
    }

    if (!input.mimetype || !input.mimetype.startsWith('image/')) {
      throw this.createPhaseError(`Invalid file type: ${input.mimetype}`);
    }

    if (input.size > 10 * 1024 * 1024) { // 10MB limit
      throw this.createPhaseError('File size exceeds 10MB limit');
    }

    if (input.size < 1024) { // 1KB minimum
      throw this.createPhaseError('File size too small (minimum 1KB)');
    }
  }
}
