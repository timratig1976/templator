import { PhaseHandler, PipelineContext } from '../base/PhaseHandler';
import { GeneratedSections, ValidatedSections, ValidatedSection, ValidationSummary, QualityMetrics } from '../types/PipelineTypes';
import { HubSpotValidationService } from '../../services/quality/HubSpotValidationService';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

/**
 * Phase 3: Quality Assurance & Validation
 * Validates generated HTML for HubSpot compliance, accessibility, and quality standards
 */
export class QualityAssurancePhase extends PhaseHandler<GeneratedSections, ValidatedSections> {
  private validationService: HubSpotValidationService;

  constructor() {
    super('Quality Assurance');
    this.validationService = new HubSpotValidationService();
  }

  protected async execute(input: GeneratedSections, context: PipelineContext): Promise<ValidatedSections> {
    const startTime = Date.now();
    const validatedSections: ValidatedSection[] = [];
    const recommendations: string[] = [];

    // Validate each section individually
    for (const section of input.sections) {
      try {
        const validatedSection = await this.validateSection(section, context);
        validatedSections.push(validatedSection);
        
        // Collect recommendations from validation results
        if (validatedSection.validationResult.suggestions.length > 0) {
          recommendations.push(...validatedSection.validationResult.suggestions);
        }

        logger.info(`Validated section: ${section.name}`, {
          pipelineId: context.pipelineId,
          sectionId: section.id,
          isValid: validatedSection.validationResult.isValid,
          errors: validatedSection.validationResult.errors.length,
          warnings: validatedSection.validationResult.warnings.length
        });
      } catch (error) {
        logger.error(`Failed to validate section: ${section.name}`, {
          pipelineId: context.pipelineId,
          sectionId: section.id,
          error: (error as Error).message
        });

        // Create fallback validation result
        const fallbackSection = this.createFallbackValidation(section);
        validatedSections.push(fallbackSection);
      }
    }

    // Calculate overall validation summary
    const overallValidation = this.calculateOverallValidation(validatedSections);
    const qualityMetrics = this.calculateQualityMetrics(validatedSections);

    // Remove duplicate recommendations
    const uniqueRecommendations = Array.from(new Set(recommendations));

    const processingTime = Date.now() - startTime;
    logger.info(`Quality assurance completed`, {
      pipelineId: context.pipelineId,
      sectionsValidated: validatedSections.length,
      overallValid: overallValidation.isValid,
      processingTime
    });

    return {
      sections: validatedSections,
      overallValidation,
      qualityMetrics,
      recommendations: uniqueRecommendations
    };
  }

  protected calculateQualityScore(output: ValidatedSections): number {
    return output.qualityMetrics.overall;
  }

  protected getWarnings(output: ValidatedSections): string[] {
    const warnings: string[] = [];

    if (!output.overallValidation.isValid) {
      warnings.push('Overall validation failed - critical errors detected');
    }

    if (output.overallValidation.criticalErrors > 0) {
      warnings.push(`${output.overallValidation.criticalErrors} critical errors found`);
    }

    if (output.qualityMetrics.overall < 70) {
      warnings.push('Overall quality score is below recommended threshold (70%)');
    }

    if (output.qualityMetrics.accessibility < 80) {
      warnings.push('Accessibility score is below recommended threshold (80%)');
    }

    if (output.qualityMetrics.hubspotCompliance < 85) {
      warnings.push('HubSpot compliance score is below recommended threshold (85%)');
    }

    const sectionsWithErrors = output.sections.filter(s => s.validationResult.errors.length > 0);
    if (sectionsWithErrors.length > 0) {
      warnings.push(`${sectionsWithErrors.length} sections have validation errors`);
    }

    return warnings;
  }

  protected getMetadata(output: ValidatedSections, context: PipelineContext): Record<string, any> {
    const totalErrors = output.sections.reduce((sum, section) => sum + section.validationResult.errors.length, 0);
    const totalWarnings = output.sections.reduce((sum, section) => sum + section.validationResult.warnings.length, 0);

    return {
      sectionsValidated: output.sections.length,
      totalErrors,
      totalWarnings,
      totalRecommendations: output.recommendations.length,
      overallScore: output.qualityMetrics.overall,
      complianceLevel: output.overallValidation.complianceLevel,
      validSections: output.sections.filter(s => s.validationResult.isValid).length
    };
  }

  protected createFallbackResult(context: PipelineContext): ValidatedSections {
    logger.warn('Creating fallback result for quality assurance', {
      pipelineId: context.pipelineId
    });

    return {
      sections: [],
      overallValidation: {
        isValid: false,
        overallScore: 0,
        criticalErrors: 1,
        warnings: 0,
        suggestions: 0,
        complianceLevel: 'poor'
      },
      qualityMetrics: {
        overall: 0,
        htmlStructure: 0,
        accessibility: 0,
        tailwindOptimization: 0,
        hubspotCompliance: 0,
        editability: 0,
        performance: 0
      },
      recommendations: ['Quality assurance failed - manual review required']
    };
  }

  /**
   * Validate a single section using HubSpot validation service
   */
  private async validateSection(section: any, context: PipelineContext): Promise<ValidatedSection> {
    try {
      // Create a mock GeneratedModule for validation
      const moduleForValidation = {
        fields: section.editableFields.map((field: any) => ({
          id: field.id,
          name: field.name,
          type: field.type,
          required: field.required || false
        })),
        meta: {
          name: section.name,
          version: '1.0.0'
        },
        template: section.html,
        description: `Generated section: ${section.name}`
      };

      // Validate using HubSpot validation service
      const validationResult = await this.validationService.validateModule(moduleForValidation);

      // Calculate section-specific quality metrics
      const qualityMetrics = this.calculateSectionQualityMetrics(section, validationResult);

      return {
        ...section,
        validationResult: {
          isValid: validationResult.valid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          suggestions: validationResult.suggestions,
          complianceScore: validationResult.score
        },
        qualityMetrics
      };
    } catch (error) {
      throw this.createPhaseError(
        `Failed to validate section ${section.name}: ${(error as Error).message}`,
        'PHASE3_ERROR'
      );
    }
  }

  /**
   * Calculate quality metrics for a single section
   */
  private calculateSectionQualityMetrics(section: any, validationResult: any): any {
    // Base metrics from validation result
    let htmlStructure = validationResult.score || 50;
    let accessibility = 70; // Default
    let tailwindOptimization = 60; // Default
    let hubspotCompliance = validationResult.score || 50;
    let editability = 70; // Default
    let performance = 75; // Default

    // Analyze HTML structure
    if (section.html.includes('<section>') || section.html.includes('<article>')) {
      htmlStructure += 10;
    }
    if (section.html.includes('<header>') || section.html.includes('<footer>')) {
      htmlStructure += 5;
    }

    // Analyze accessibility
    if (section.html.includes('aria-')) {
      accessibility += 15;
    }
    if (section.html.includes('alt=')) {
      accessibility += 10;
    }
    if (section.html.includes('role=')) {
      accessibility += 5;
    }

    // Analyze Tailwind usage
    const tailwindClasses = (section.html.match(/class="[^"]*"/g) || []).length;
    if (tailwindClasses > 5) {
      tailwindOptimization += 20;
    } else if (tailwindClasses > 2) {
      tailwindOptimization += 10;
    }

    // Analyze editability
    if (section.editableFields.length >= 3) {
      editability += 15;
    } else if (section.editableFields.length >= 2) {
      editability += 10;
    }

    // Ensure scores are within bounds
    const metrics = {
      htmlStructure: Math.min(100, Math.max(0, htmlStructure)),
      accessibility: Math.min(100, Math.max(0, accessibility)),
      tailwindOptimization: Math.min(100, Math.max(0, tailwindOptimization)),
      hubspotCompliance: Math.min(100, Math.max(0, hubspotCompliance)),
      editability: Math.min(100, Math.max(0, editability)),
      performance: Math.min(100, Math.max(0, performance))
    };

    return metrics;
  }

  /**
   * Calculate overall validation summary
   */
  private calculateOverallValidation(sections: ValidatedSection[]): ValidationSummary {
    if (sections.length === 0) {
      return {
        isValid: false,
        overallScore: 0,
        criticalErrors: 1,
        warnings: 0,
        suggestions: 0,
        complianceLevel: 'poor'
      };
    }

    const validSections = sections.filter(s => s.validationResult.isValid);
    const totalErrors = sections.reduce((sum, s) => sum + s.validationResult.errors.length, 0);
    const totalWarnings = sections.reduce((sum, s) => sum + s.validationResult.warnings.length, 0);
    const totalSuggestions = sections.reduce((sum, s) => sum + s.validationResult.suggestions.length, 0);
    
    const criticalErrors = sections.reduce((sum, s) => {
      return sum + s.validationResult.errors.filter(e => e.type === 'error').length;
    }, 0);

    const averageScore = sections.reduce((sum, s) => sum + s.validationResult.complianceScore, 0) / sections.length;
    const isValid = validSections.length === sections.length && criticalErrors === 0;

    let complianceLevel: 'poor' | 'fair' | 'good' | 'excellent' = 'poor';
    if (averageScore >= 90) complianceLevel = 'excellent';
    else if (averageScore >= 75) complianceLevel = 'good';
    else if (averageScore >= 60) complianceLevel = 'fair';

    return {
      isValid,
      overallScore: Math.round(averageScore),
      criticalErrors,
      warnings: totalWarnings,
      suggestions: totalSuggestions,
      complianceLevel
    };
  }

  /**
   * Calculate overall quality metrics
   */
  private calculateQualityMetrics(sections: ValidatedSection[]): QualityMetrics {
    if (sections.length === 0) {
      return {
        overall: 0,
        htmlStructure: 0,
        accessibility: 0,
        tailwindOptimization: 0,
        hubspotCompliance: 0,
        editability: 0,
        performance: 0
      };
    }

    const avgMetrics = sections.reduce((acc, section) => {
      acc.htmlStructure += section.qualityMetrics.htmlStructure;
      acc.accessibility += section.qualityMetrics.accessibility;
      acc.tailwindUsage += section.qualityMetrics.tailwindUsage;
      acc.hubspotCompliance += section.qualityMetrics.hubspotCompliance;
      return acc;
    }, {
      htmlStructure: 0,
      accessibility: 0,
      tailwindUsage: 0,
      hubspotCompliance: 0
    });

    const count = sections.length;
    const metrics = {
      htmlStructure: Math.round(avgMetrics.htmlStructure / count),
      accessibility: Math.round(avgMetrics.accessibility / count),
      tailwindUsage: Math.round(avgMetrics.tailwindUsage / count),
      hubspotCompliance: Math.round(avgMetrics.hubspotCompliance / count)
    };

    // Calculate overall as weighted average using available properties
    const overall = Math.round(
      (metrics.htmlStructure * 0.3) +
      (metrics.accessibility * 0.3) +
      (metrics.tailwindUsage * 0.2) +
      (metrics.hubspotCompliance * 0.2)
    );

    return {
      overall,
      ...metrics,
      // Add missing properties for interface compatibility
      tailwindOptimization: metrics.tailwindUsage, // Use tailwindUsage as fallback
      editability: Math.round((metrics.htmlStructure + metrics.accessibility) / 2), // Calculate from available metrics
      performance: Math.round((metrics.tailwindUsage + metrics.hubspotCompliance) / 2) // Calculate from available metrics
    };
  }

  /**
   * Create fallback validation for a section when validation fails
   */
  private createFallbackValidation(section: any): ValidatedSection {
    return {
      ...section,
      validationResult: {
        isValid: false,
        errors: [{
          type: 'error' as any,
          category: 'validation' as any,
          code: 'VALIDATION_FAILED',
          message: 'Section validation failed',
          fix: 'Manual review required'
        }],
        warnings: [],
        suggestions: ['Review section content manually'],
        complianceScore: 0
      },
      qualityMetrics: {
        htmlStructure: 30,
        accessibility: 20,
        tailwindOptimization: 25,
        hubspotCompliance: 0,
        editability: 40,
        performance: 50
      }
    };
  }

  protected validateInput(input: GeneratedSections, context: PipelineContext): void {
    super.validateInput(input, context);

    if (!input.sections || input.sections.length === 0) {
      throw this.createPhaseError('At least one generated section is required for validation', 'PHASE3_ERROR');
    }

    for (const section of input.sections) {
      if (!section.html) {
        throw this.createPhaseError(`Section ${section.id} is missing HTML content`, 'PHASE3_ERROR');
      }

      if (!section.editableFields || section.editableFields.length === 0) {
        throw this.createPhaseError(`Section ${section.id} has no editable fields`, 'PHASE3_ERROR');
      }
    }
  }
}
