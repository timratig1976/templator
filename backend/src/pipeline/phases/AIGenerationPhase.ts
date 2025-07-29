import { PhaseHandler, PipelineContext } from '../base/PhaseHandler';
import { ProcessedInput, GeneratedSections, GeneratedSection, EditableField, QualityIssue } from '../types/PipelineTypes';
import { OpenAIService } from '../../services/openaiService';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

/**
 * Phase 2: AI-Powered HTML Generation
 * Converts design sections into semantic HTML with Tailwind CSS and editable fields
 */
export class AIGenerationPhase extends PhaseHandler<ProcessedInput, GeneratedSections> {
  private openaiService: OpenAIService;

  constructor() {
    super('AI Generation');
    this.openaiService = new OpenAIService();
  }

  protected async execute(input: ProcessedInput, context: PipelineContext): Promise<GeneratedSections> {
    const startTime = Date.now();
    const generatedSections: GeneratedSection[] = [];
    let totalQuality = 0;

    // Process each section individually for better quality
    for (const section of input.sections) {
      try {
        const generatedSection = await this.generateSectionHTML(section, input, context);
        generatedSections.push(generatedSection);
        totalQuality += generatedSection.qualityScore;
        
        logger.info(`Generated section: ${section.name}`, {
          pipelineId: context.pipelineId,
          sectionId: section.id,
          quality: generatedSection.qualityScore,
          fieldsCount: generatedSection.editableFields.length
        });
      } catch (error) {
        logger.error(`Failed to generate section: ${section.name}`, {
          pipelineId: context.pipelineId,
          sectionId: section.id,
          error: (error as Error).message
        });
        
        // Create fallback section
        const fallbackSection = this.createFallbackSection(section, input);
        generatedSections.push(fallbackSection);
        totalQuality += fallbackSection.qualityScore;
      }
    }

    const overallQuality = generatedSections.length > 0 ? totalQuality / generatedSections.length : 0;
    const totalProcessingTime = Date.now() - startTime;

    return {
      sections: generatedSections,
      overallQuality,
      totalProcessingTime,
      metadata: {
        sectionsDetected: input.sections.length,
        averageQuality: overallQuality,
        aiModelUsed: 'gpt-4o'
      }
    };
  }

  protected calculateQualityScore(output: GeneratedSections): number {
    // Quality is already calculated per section, return overall quality
    return output.overallQuality;
  }

  protected getWarnings(output: GeneratedSections): string[] {
    const warnings: string[] = [];

    if (output.overallQuality < 60) {
      warnings.push('Overall quality is below recommended threshold (60%)');
    }

    const sectionsWithIssues = output.sections.filter(s => s.issues.length > 0);
    if (sectionsWithIssues.length > 0) {
      warnings.push(`${sectionsWithIssues.length} sections have quality issues`);
    }

    const sectionsWithLowQuality = output.sections.filter(s => s.qualityScore < 50);
    if (sectionsWithLowQuality.length > 0) {
      warnings.push(`${sectionsWithLowQuality.length} sections have low quality scores`);
    }

    if (output.totalProcessingTime > 30000) { // 30 seconds
      warnings.push('Processing time exceeded 30 seconds - consider optimizing');
    }

    return warnings;
  }

  protected getMetadata(output: GeneratedSections, context: PipelineContext): Record<string, any> {
    const totalFields = output.sections.reduce((sum, section) => sum + section.editableFields.length, 0);
    const totalIssues = output.sections.reduce((sum, section) => sum + section.issues.length, 0);

    return {
      sectionsGenerated: output.sections.length,
      totalEditableFields: totalFields,
      averageFieldsPerSection: Math.round(totalFields / output.sections.length),
      totalQualityIssues: totalIssues,
      processingTimeMs: output.totalProcessingTime,
      aiModelUsed: output.metadata.aiModelUsed
    };
  }

  protected createFallbackResult(context: PipelineContext): GeneratedSections {
    logger.warn('Creating fallback result for AI generation', {
      pipelineId: context.pipelineId
    });

    const fallbackSection: GeneratedSection = {
      id: 'fallback_section',
      name: 'Default Section',
      type: 'content',
      html: this.getDefaultHTML(),
      editableFields: this.getDefaultFields(),
      qualityScore: 40, // Low quality for fallback
      issues: [{
        type: 'warning',
        category: 'html',
        message: 'Fallback content used due to AI generation failure',
        severity: 'medium',
        fixable: false
      }]
    };

    return {
      sections: [fallbackSection],
      overallQuality: 40,
      totalProcessingTime: 0,
      metadata: {
        sectionsDetected: 1,
        averageQuality: 40,
        aiModelUsed: 'fallback'
      }
    };
  }

  /**
   * Generate HTML for a specific section using OpenAI
   */
  private async generateSectionHTML(
    section: any, 
    input: ProcessedInput, 
    context: PipelineContext
  ): Promise<GeneratedSection> {
    const prompt = this.buildSectionPrompt(section, input.complexity);
    
    try {
      // Use OpenAI to generate HTML for this section
      const response = await this.openaiService.generateHubSpotModule(prompt);

      // Parse the response and extract structured data
      const parsedResponse = this.parseAIResponse(response);
      
      return {
        id: section.id,
        name: section.name,
        type: section.type,
        html: parsedResponse.html,
        editableFields: parsedResponse.fields,
        qualityScore: this.calculateSectionQuality(parsedResponse),
        issues: this.identifyQualityIssues(parsedResponse),
        aiMetadata: {
          model: 'gpt-4o',
          tokensUsed: response.length, // Approximation
          confidence: parsedResponse.confidence || 0.8
        }
      };
    } catch (error) {
      throw this.createPhaseError(
        `Failed to generate HTML for section ${section.name}: ${(error as Error).message}`,
        'PHASE2_ERROR'
      );
    }
  }

  /**
   * Build section-specific prompt for AI generation
   */
  private buildSectionPrompt(section: any, complexity: any): string {
    return `
Generate semantic HTML5 with Tailwind CSS for a ${section.type} section.

Section Details:
- Name: ${section.name}
- Type: ${section.type}
- Estimated Elements: ${section.estimatedElements}
- Complexity: ${section.complexity}/5

Requirements:
1. Use semantic HTML5 elements
2. Apply Tailwind CSS classes for styling
3. Make content editable with clear field identifiers
4. Ensure responsive design (mobile-first)
5. Include accessibility attributes (ARIA labels, alt text)
6. Generate 3-5 editable fields per section

Return JSON format:
{
  "html": "semantic HTML with Tailwind classes",
  "fields": [
    {
      "id": "unique_field_id",
      "name": "Field Name",
      "type": "text|rich_text|image|url|boolean",
      "selector": "CSS selector",
      "defaultValue": "default content",
      "required": true/false
    }
  ],
  "confidence": 0.8
}
    `.trim();
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(response: string): any {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      if (parsed.html && parsed.fields) {
        return parsed;
      }
    } catch (error) {
      // If JSON parsing fails, extract HTML and create basic fields
      logger.warn('Failed to parse AI response as JSON, using fallback parsing');
    }

    // Fallback parsing for non-JSON responses
    return {
      html: this.extractHTMLFromResponse(response),
      fields: this.generateBasicFields(),
      confidence: 0.6
    };
  }

  /**
   * Extract HTML from AI response when JSON parsing fails
   */
  private extractHTMLFromResponse(response: string): string {
    // Look for HTML content in the response
    const htmlMatch = response.match(/<[^>]+>/);
    if (htmlMatch) {
      // Extract everything that looks like HTML
      const htmlStart = response.indexOf('<');
      const htmlEnd = response.lastIndexOf('>') + 1;
      return response.substring(htmlStart, htmlEnd);
    }

    // Return basic HTML if no HTML found
    return this.getDefaultHTML();
  }

  /**
   * Generate basic editable fields when AI parsing fails
   */
  private generateBasicFields(): EditableField[] {
    return [
      {
        id: 'heading',
        name: 'Heading',
        type: 'text',
        selector: 'h1, h2, h3',
        defaultValue: 'Your Heading Here',
        required: true
      },
      {
        id: 'content',
        name: 'Content',
        type: 'rich_text',
        selector: 'p, .content',
        defaultValue: 'Your content here...',
        required: false
      }
    ];
  }

  /**
   * Calculate quality score for a generated section
   */
  private calculateSectionQuality(parsedResponse: any): number {
    let score = 50; // Base score

    // HTML quality checks
    if (parsedResponse.html.includes('semantic')) score += 10;
    if (parsedResponse.html.includes('tailwind') || parsedResponse.html.includes('class=')) score += 15;
    if (parsedResponse.html.includes('aria-')) score += 10;
    if (parsedResponse.html.includes('alt=')) score += 5;

    // Field quality checks
    if (parsedResponse.fields && parsedResponse.fields.length >= 3) score += 10;
    if (parsedResponse.fields && parsedResponse.fields.length >= 5) score += 5;

    // Confidence adjustment
    if (parsedResponse.confidence) {
      score = score * parsedResponse.confidence;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Identify quality issues in generated content
   */
  private identifyQualityIssues(parsedResponse: any): QualityIssue[] {
    const issues: QualityIssue[] = [];

    if (!parsedResponse.html.includes('class=')) {
      issues.push({
        type: 'warning',
        category: 'tailwind',
        message: 'No Tailwind CSS classes detected',
        severity: 'medium',
        fixable: true,
        suggestion: 'Add Tailwind CSS classes for styling'
      });
    }

    if (!parsedResponse.html.includes('aria-')) {
      issues.push({
        type: 'suggestion',
        category: 'accessibility',
        message: 'Missing accessibility attributes',
        severity: 'low',
        fixable: true,
        suggestion: 'Add ARIA labels and accessibility attributes'
      });
    }

    if (parsedResponse.fields.length < 2) {
      issues.push({
        type: 'warning',
        category: 'hubspot',
        message: 'Few editable fields detected',
        severity: 'medium',
        fixable: true,
        suggestion: 'Add more editable fields for better customization'
      });
    }

    return issues;
  }

  /**
   * Create fallback section when generation fails
   */
  private createFallbackSection(section: any, input: ProcessedInput): GeneratedSection {
    return {
      id: section.id,
      name: section.name,
      type: section.type,
      html: this.getDefaultHTML(),
      editableFields: this.getDefaultFields(),
      qualityScore: 30, // Low quality for fallback
      issues: [{
        type: 'error',
        category: 'html',
        message: 'AI generation failed, using fallback content',
        severity: 'high',
        fixable: false
      }]
    };
  }

  /**
   * Get default HTML template
   */
  private getDefaultHTML(): string {
    return `
<section class="py-12 px-4 bg-white">
  <div class="max-w-4xl mx-auto">
    <h2 class="text-3xl font-bold text-gray-900 mb-6">{{ heading }}</h2>
    <div class="prose max-w-none">
      {{ content }}
    </div>
  </div>
</section>
    `.trim();
  }

  /**
   * Get default editable fields
   */
  private getDefaultFields(): EditableField[] {
    return [
      {
        id: 'heading',
        name: 'Section Heading',
        type: 'text',
        selector: 'h2',
        defaultValue: 'Your Heading Here',
        required: true
      },
      {
        id: 'content',
        name: 'Section Content',
        type: 'rich_text',
        selector: '.prose',
        defaultValue: 'Your content here...',
        required: false
      }
    ];
  }

  protected validateInput(input: ProcessedInput, context: PipelineContext): void {
    super.validateInput(input, context);

    if (!input.imageBase64) {
      throw this.createPhaseError('Image base64 data is required', 'PHASE2_ERROR');
    }

    if (!input.sections || input.sections.length === 0) {
      throw this.createPhaseError('At least one section is required for generation', 'PHASE2_ERROR');
    }

    if (!input.complexity) {
      throw this.createPhaseError('Design complexity analysis is required', 'PHASE2_ERROR');
    }
  }
}
