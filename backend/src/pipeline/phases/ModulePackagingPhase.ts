import { PhaseHandler, PipelineContext } from '../base/PhaseHandler';
import { EnhancedSections, PackagedModule, ModuleMetadata } from '../types/PipelineTypes';
import ModulePackagingService from '../../services/module/ModulePackagingService';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

/**
 * Phase 5: Module Packaging & Export
 * Packages enhanced sections into a complete HubSpot module with proper structure
 */
export class ModulePackagingPhase extends PhaseHandler<EnhancedSections, PackagedModule> {
  private packagingService: ModulePackagingService;

  constructor() {
    super('Module Packaging Phase');
    this.packagingService = ModulePackagingService.getInstance();
  }

  protected async execute(input: EnhancedSections, context: PipelineContext): Promise<PackagedModule> {
    const startTime = Date.now();

    try {
      // Combine all enhanced sections into a single HTML template
      const combinedHTML = this.combineEnhancedSections(input.sections);
      
      // Extract all editable fields from sections
      const allFields = this.extractAllEditableFields(input.sections);
      
      // Create module metadata
      const metadata = this.createModuleMetadata(input, context, startTime);
      
      // Create the module structure for packaging
      const moduleId = `module_${context.pipelineId}`;
      const moduleFiles = {
        'module.html': combinedHTML,
        'fields.json': JSON.stringify(allFields, null, 2),
        'meta.json': JSON.stringify({
          label: metadata.name,
          css_assets: [],
          external_js: [],
          global: false,
          help_text: metadata.description,
          host_template_types: ['PAGE', 'EMAIL', 'BLOG_POST'],
          js_assets: [],
          other_assets: [],
          smart_type: 'NOT_SMART',
          tags: [],
          is_available_for_new_content: true
        }, null, 2),
        'README.md': `# ${metadata.name}\n\n${metadata.description}\n\nGenerated by Templator AI Pipeline`
      };

      // Package the module using the packaging service
      const packageResult = await this.packagingService.packageModule(
        moduleId,
        moduleFiles,
        {
          format: 'hubspot' as const,
          compression_level: 'fast' as const,
          include_source_maps: false,
          include_documentation: true,
          include_tests: false,
          minify_assets: true,
          optimize_images: true,
          bundle_dependencies: false
        },
        {
          name: metadata.name,
          version: metadata.version,
          description: metadata.description,
          author: metadata.author
        }
      );

      const processingTime = Date.now() - startTime;
      
      logger.info('Module packaging completed', {
        pipelineId: context.pipelineId,
        moduleId: packageResult.package_id,
        sectionsPackaged: input.sections.length,
        fieldsIncluded: allFields.length,
        processingTime
      });

      return {
        moduleId: packageResult.package_id,
        packageResult,
        finalHTML: combinedHTML,
        metadata: {
          ...metadata,
          processingTime
        },
        exportFormat: 'hubspot' as const
      };
    } catch (error) {
      throw this.createPhaseError(
        `Failed to package module: ${(error as Error).message}`,
        'PHASE5_ERROR'
      );
    }
  }

  protected calculateQualityScore(output: PackagedModule): number {
    // Base score from successful packaging
    let score = 80;

    // Adjust based on metadata quality
    if (output.metadata.totalSections >= 3) score += 10;
    if (output.metadata.averageQuality >= 80) score += 10;
    
    // Adjust based on export format
    if (output.exportFormat === 'hubspot') score += 5;
    
    // Adjust based on processing efficiency
    if (output.metadata.processingTime < 10000) score += 5; // Under 10 seconds

    return Math.min(100, Math.max(0, score));
  }

  protected getWarnings(output: PackagedModule): string[] {
    const warnings: string[] = [];

    if (output.metadata.averageQuality < 70) {
      warnings.push('Average section quality is below recommended threshold (70%)');
    }

    if (output.metadata.totalSections < 2) {
      warnings.push('Module contains fewer than 2 sections - consider adding more content');
    }

    if (output.metadata.processingTime > 30000) { // 30 seconds
      warnings.push('Packaging took longer than expected - consider optimizing');
    }

    if (!output.packageResult.package_id) {
      warnings.push('Package ID is missing - export may have issues');
    }

    return warnings;
  }

  protected getMetadata(output: PackagedModule, context: PipelineContext): Record<string, any> {
    return {
      moduleId: output.moduleId,
      exportFormat: output.exportFormat,
      sectionsPackaged: output.metadata.totalSections,
      finalQuality: output.metadata.averageQuality,
      processingTime: output.metadata.processingTime,
      packageSize: output.packageResult.size || 'unknown',
      aiModelsUsed: output.metadata.aiModelsUsed,
      timestamp: output.metadata.created
    };
  }

  protected createFallbackResult(context: PipelineContext): PackagedModule {
    logger.warn('Creating fallback result for module packaging', {
      pipelineId: context.pipelineId
    });

    const fallbackHTML = this.getFallbackHTML();
    const fallbackMetadata = this.getFallbackMetadata(context);

    return {
      moduleId: `fallback_${context.pipelineId}`,
      packageResult: {
        package_id: `fallback_${context.pipelineId}`,
        success: false,
        message: 'Fallback packaging used due to errors'
      },
      finalHTML: fallbackHTML,
      metadata: fallbackMetadata,
      exportFormat: 'hubspot'
    };
  }

  /**
   * Combine all enhanced sections into a single HTML template
   */
  private combineEnhancedSections(sections: any[]): string {
    if (sections.length === 0) {
      return this.getFallbackHTML();
    }

    const combinedSections = sections.map(section => {
      return `
<!-- Section: ${section.name} -->
<div class="section-${section.id}" data-section-type="${section.type}">
${section.finalHtml || section.html}
</div>
      `.trim();
    }).join('\n\n');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated HubSpot Module</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white">
    <div class="hubspot-module">
${combinedSections}
    </div>
</body>
</html>
    `.trim();
  }

  /**
   * Extract all editable fields from all sections
   */
  private extractAllEditableFields(sections: any[]): any[] {
    const allFields: any[] = [];
    const fieldIds = new Set<string>();

    for (const section of sections) {
      for (const field of section.editableFields || []) {
        // Ensure unique field IDs across sections
        let uniqueId = field.id;
        let counter = 1;
        
        while (fieldIds.has(uniqueId)) {
          uniqueId = `${field.id}_${counter}`;
          counter++;
        }
        
        fieldIds.add(uniqueId);
        
        allFields.push({
          ...field,
          id: uniqueId,
          sectionId: section.id,
          sectionName: section.name
        });
      }
    }

    return allFields;
  }

  /**
   * Create comprehensive module metadata
   */
  private createModuleMetadata(
    input: EnhancedSections, 
    context: PipelineContext, 
    startTime: number
  ): ModuleMetadata {
    const totalSections = input.sections.length;
    const averageQuality = input.finalQuality;
    const processingTime = Date.now() - startTime;
    
    // Extract AI models used from sections
    const aiModelsUsed = [...new Set(
      input.sections
        .map(s => s.aiMetadata?.model)
        .filter((model): model is string => Boolean(model))
    )];

    return {
      name: `Generated Module ${context.pipelineId}`,
      version: '1.0.0',
      description: `HubSpot module generated from design with ${totalSections} sections`,
      author: 'Templator AI Pipeline',
      created: new Date().toISOString(),
      totalSections,
      averageQuality,
      processingTime,
      aiModelsUsed: aiModelsUsed.length > 0 ? aiModelsUsed : ['gpt-4o']
    };
  }

  /**
   * Get fallback HTML when packaging fails
   */
  private getFallbackHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fallback HubSpot Module</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white">
    <div class="hubspot-module">
        <section class="py-12 px-4 bg-white">
            <div class="max-w-4xl mx-auto text-center">
                <h1 class="text-4xl font-bold text-gray-900 mb-6">{{ module_title }}</h1>
                <div class="prose max-w-none mx-auto">
                    {{ module_content }}
                </div>
                <div class="mt-8">
                    <a href="{{ cta_url }}" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
                        {{ cta_text }}
                    </a>
                </div>
            </div>
        </section>
    </div>
</body>
</html>
    `.trim();
  }

  /**
   * Get fallback metadata when packaging fails
   */
  private getFallbackMetadata(context: PipelineContext): ModuleMetadata {
    return {
      name: `Fallback Module ${context.pipelineId}`,
      version: '1.0.0',
      description: 'Fallback HubSpot module created due to packaging errors',
      author: 'Templator AI Pipeline (Fallback)',
      created: new Date().toISOString(),
      totalSections: 1,
      averageQuality: 40, // Low quality for fallback
      processingTime: 0,
      aiModelsUsed: ['fallback']
    };
  }

  protected validateInput(input: EnhancedSections, context: PipelineContext): void {
    super.validateInput(input, context);

    if (!input.sections || input.sections.length === 0) {
      throw this.createPhaseError('At least one enhanced section is required for packaging', 'PHASE5_ERROR');
    }

    if (typeof input.finalQuality !== 'number' || input.finalQuality < 0) {
      throw this.createPhaseError('Valid final quality score is required for packaging', 'PHASE5_ERROR');
    }

    // Validate that each section has the required properties
    for (const section of input.sections) {
      if (!section.finalHtml && !section.html) {
        throw this.createPhaseError(`Section ${section.id} is missing HTML content`, 'PHASE5_ERROR');
      }

      if (!section.editableFields || !Array.isArray(section.editableFields)) {
        throw this.createPhaseError(`Section ${section.id} has invalid editable fields`, 'PHASE5_ERROR');
      }
    }
  }
}
