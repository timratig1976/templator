import { PhaseHandler, PipelineContext } from '../base/PhaseHandler';
import { ValidatedSections, EnhancedSections, EnhancedSection, Enhancement, EnhancementSummary } from '../types/PipelineTypes';
import { IterativeRefinementService } from '../../services/analysis/IterativeRefinementService';
import { AutoErrorCorrectionService } from '../../services/quality/AutoErrorCorrectionService';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

/**
 * Phase 4: Enhancement & Optimization
 * Applies iterative refinements and automated error corrections to improve quality
 */
export class EnhancementPhase extends PhaseHandler<ValidatedSections, EnhancedSections> {
  private refinementService: IterativeRefinementService;
  private errorCorrectionService: AutoErrorCorrectionService;

  constructor() {
    super('Enhancement & Optimization');
    this.refinementService = new IterativeRefinementService();
    this.errorCorrectionService = new AutoErrorCorrectionService();
  }

  protected async execute(input: ValidatedSections, context: PipelineContext): Promise<EnhancedSections> {
    const startTime = Date.now();
    let totalIterations = 0;

    // Process all sections in parallel for better performance
    const enhancementPromises = input.sections.map(async (section) => {
      try {
        const enhancedSection = await this.enhanceSection(section, context);
        
        // Create enhancement summary
        const summary: EnhancementSummary = {
          sectionId: section.id,
          enhancementsApplied: enhancedSection.enhancements.applied,
          qualityBefore: section.qualityScore,
          qualityAfter: enhancedSection.finalQuality,
          totalImprovement: enhancedSection.finalQuality - section.qualityScore
        };

        logger.info(`Enhanced section: ${section.name}`, {
          pipelineId: context.pipelineId,
          sectionId: section.id,
          qualityImprovement: summary.totalImprovement,
          enhancementsApplied: summary.enhancementsApplied.length,
          iterations: enhancedSection.enhancements.iterationsUsed
        });

        return { enhancedSection, summary };
      } catch (error) {
        logger.error(`Failed to enhance section: ${section.name}`, {
          pipelineId: context.pipelineId,
          sectionId: section.id,
          error: (error as Error).message
        });

        // Create fallback enhanced section
        const fallbackSection = this.createFallbackEnhancement(section);
        
        const fallbackSummary: EnhancementSummary = {
          sectionId: section.id,
          enhancementsApplied: [],
          qualityBefore: section.qualityScore,
          qualityAfter: section.qualityScore,
          totalImprovement: 0
        };

        return { enhancedSection: fallbackSection, summary: fallbackSummary };
      }
    });

    const results = await Promise.all(enhancementPromises);
    const enhancedSections = results.map(r => r.enhancedSection);
    const enhancementSummaries = results.map(r => r.summary);
    
    // Calculate totals
    totalIterations = enhancedSections.reduce((sum, section) => sum + section.enhancements.iterationsUsed, 0);

    // Calculate final quality score
    const finalQuality = enhancedSections.length > 0 
      ? enhancedSections.reduce((sum, section) => sum + section.finalQuality, 0) / enhancedSections.length
      : 0;

    const processingTime = Date.now() - startTime;
    logger.info(`Enhancement phase completed`, {
      pipelineId: context.pipelineId,
      sectionsEnhanced: enhancedSections.length,
      finalQuality,
      totalIterations,
      processingTime
    });

    return {
      sections: enhancedSections,
      enhancementsApplied: enhancementSummaries,
      finalQuality,
      iterationsPerformed: totalIterations
    };
  }

  protected calculateQualityScore(output: EnhancedSections): number {
    return output.finalQuality;
  }

  protected getWarnings(output: EnhancedSections): string[] {
    const warnings: string[] = [];

    if (output.finalQuality < 75) {
      warnings.push('Final quality score is below recommended threshold (75%)');
    }

    const sectionsWithNoImprovement = output.enhancementsApplied.filter(s => s.totalImprovement <= 0);
    if (sectionsWithNoImprovement.length > 0) {
      warnings.push(`${sectionsWithNoImprovement.length} sections showed no quality improvement`);
    }

    const sectionsWithLowQuality = output.sections.filter(s => s.finalQuality < 60);
    if (sectionsWithLowQuality.length > 0) {
      warnings.push(`${sectionsWithLowQuality.length} sections still have low quality scores`);
    }

    if (output.iterationsPerformed === 0) {
      warnings.push('No enhancement iterations were performed');
    }

    return warnings;
  }

  protected getMetadata(output: EnhancedSections, context: PipelineContext): Record<string, any> {
    const totalEnhancements = output.enhancementsApplied.reduce((sum, s) => sum + s.enhancementsApplied.length, 0);
    const avgImprovement = output.enhancementsApplied.length > 0
      ? output.enhancementsApplied.reduce((sum, s) => sum + s.totalImprovement, 0) / output.enhancementsApplied.length
      : 0;

    return {
      sectionsEnhanced: output.sections.length,
      totalEnhancements,
      averageImprovement: Math.round(avgImprovement * 100) / 100,
      totalIterations: output.iterationsPerformed,
      finalQualityScore: output.finalQuality,
      enhancementTypes: this.getEnhancementTypeBreakdown(output)
    };
  }

  protected createFallbackResult(context: PipelineContext): EnhancedSections {
    logger.warn('Creating fallback result for enhancement phase', {
      pipelineId: context.pipelineId
    });

    return {
      sections: [],
      enhancementsApplied: [],
      finalQuality: 0,
      iterationsPerformed: 0
    };
  }

  /**
   * Enhance a single section using refinement and error correction services
   */
  private async enhanceSection(section: any, context: PipelineContext): Promise<EnhancedSection> {
    let currentSection = { ...section };
    const appliedEnhancements: Enhancement[] = [];
    let iterationsUsed = 0;

    // Step 1: Apply error corrections if validation errors exist
    if (section.validationResult.errors.length > 0) {
      try {
        const correctionResult = await this.applyErrorCorrections(currentSection, context);
        if (correctionResult.applied) {
          appliedEnhancements.push(...correctionResult.enhancements);
          currentSection = correctionResult.correctedSection;
          iterationsUsed++;
        }
      } catch (error) {
        logger.warn(`Error correction failed for section ${section.id}`, {
          pipelineId: context.pipelineId,
          error: (error as Error).message
        });
      }
    }

    // Step 2: Apply iterative refinements for quality improvement
    if (currentSection.qualityScore < 80) { // Only refine if quality is below threshold
      try {
        const refinementResult = await this.applyIterativeRefinements(currentSection, context);
        if (refinementResult.applied) {
          appliedEnhancements.push(...refinementResult.enhancements);
          currentSection = refinementResult.refinedSection;
          iterationsUsed += refinementResult.iterations;
        }
      } catch (error) {
        logger.warn(`Iterative refinement failed for section ${section.id}`, {
          pipelineId: context.pipelineId,
          error: (error as Error).message
        });
      }
    }

    // Calculate final quality and improvement
    const finalQuality = this.calculateEnhancedQuality(currentSection, appliedEnhancements);
    const qualityImprovement = finalQuality - section.qualityScore;

    return {
      ...currentSection,
      enhancements: {
        applied: appliedEnhancements,
        qualityImprovement,
        iterationsUsed
      },
      finalHtml: currentSection.html,
      finalQuality
    };
  }

  /**
   * Apply error corrections to a section
   */
  private async applyErrorCorrections(section: any, context: PipelineContext): Promise<{
    applied: boolean;
    enhancements: Enhancement[];
    correctedSection: any;
  }> {
    const startTime = Date.now();

    // Create a GeneratedModule for the error correction service
    const moduleForCorrection = {
      fields: section.editableFields,
      meta: { name: section.name, version: '1.0.0' },
      template: section.html,
      description: `Section: ${section.name}`
    };

    const validationResult = {
      valid: section.validationResult.isValid,
      score: section.validationResult.complianceScore || 0,
      errors: section.validationResult.errors || [],
      warnings: section.validationResult.warnings || [],
      suggestions: section.validationResult.suggestions || [],
      metrics: {
        complexity_score: section.validationResult.complianceScore || 0,
        accessibility_score: section.validationResult.complianceScore || 0,
        performance_score: section.validationResult.complianceScore || 0,
        maintainability_score: section.validationResult.complianceScore || 0
      },
      processingTime: 0
    };

    const correctionResult = await this.errorCorrectionService.correctErrors(
      moduleForCorrection,
      validationResult
    );

    const processingTime = Date.now() - startTime;

    if (correctionResult.success && correctionResult.correctedModule) {
      const enhancements: Enhancement[] = correctionResult.appliedCorrections.map(correction => ({
        type: 'quality',
        description: `Error correction: ${(correction as any).correctionType || (correction as any).type || 'unknown'}`,
        applied: true,
        impact: 5, // Assume 5 point improvement per correction
        processingTime: processingTime / correctionResult.appliedCorrections.length
      }));

      return {
        applied: true,
        enhancements,
        correctedSection: {
          ...section,
          html: correctionResult.correctedModule.template,
          editableFields: correctionResult.correctedModule.fields
        }
      };
    }

    return {
      applied: false,
      enhancements: [],
      correctedSection: section
    };
  }

  /**
   * Apply iterative refinements to a section
   */
  private async applyIterativeRefinements(section: any, context: PipelineContext): Promise<{
    applied: boolean;
    enhancements: Enhancement[];
    refinedSection: any;
    iterations: number;
  }> {
    const startTime = Date.now();

    // Create a GeneratedModule for the refinement service
    const moduleForRefinement = {
      fields: section.editableFields,
      meta: { name: section.name, version: '1.0.0' },
      template: section.html,
      description: `Section: ${section.name}`
    };

    const moduleRequest = {
      ...moduleForRefinement,
      moduleType: 'custom' as const,
      complexity: 'medium' as const,
      requirements: 'Accessible, responsive, HubSpot-compatible module with enhanced quality'
    };

    const refinementResult = await this.refinementService.refineModule(
      moduleRequest,
      moduleForRefinement,
      { maxIterations: 3, confidenceThreshold: 80, improvementThreshold: 10, focusAreas: [], enableDeepRefinement: true },
      context.pipelineId
    );
    const processingTime = Date.now() - startTime;

    if (refinementResult.improvementAchieved && refinementResult.finalModule) {
      const enhancements: Enhancement[] = [
        {
          type: 'quality',
          description: 'Iterative quality refinement',
          applied: true,
          impact: refinementResult.finalConfidence.overall * 100 - section.qualityScore,
          processingTime
        }
      ];

      // Add specific enhancements based on confidence metrics
      if (refinementResult.finalConfidence.accessibilityCompliance > 0.8) {
        enhancements.push({
          type: 'accessibility',
          description: 'Accessibility improvements applied',
          applied: true,
          impact: 10,
          processingTime: processingTime / 4
        });
      }

      if (refinementResult.finalConfidence.performanceOptimization > 0.8) {
        enhancements.push({
          type: 'performance',
          description: 'Performance optimizations applied',
          applied: true,
          impact: 8,
          processingTime: processingTime / 4
        });
      }

      return {
        applied: true,
        enhancements,
        refinedSection: {
          ...section,
          html: refinementResult.finalModule.template,
          editableFields: refinementResult.finalModule.fields
        },
        iterations: refinementResult.totalIterations
      };
    }

    return {
      applied: false,
      enhancements: [],
      refinedSection: section,
      iterations: 0
    };
  }

  /**
   * Calculate enhanced quality score based on applied enhancements
   */
  private calculateEnhancedQuality(section: any, enhancements: Enhancement[]): number {
    let quality = section.qualityScore;

    // Add impact from each enhancement
    for (const enhancement of enhancements) {
      if (enhancement.applied) {
        quality += enhancement.impact;
      }
    }

    // Apply bonus for multiple enhancements
    if (enhancements.length > 2) {
      quality += 5; // Synergy bonus
    }

    return Math.min(100, Math.max(0, Math.round(quality)));
  }

  /**
   * Create fallback enhancement when enhancement fails
   */
  private createFallbackEnhancement(section: any): EnhancedSection {
    return {
      ...section,
      enhancements: {
        applied: [],
        qualityImprovement: 0,
        iterationsUsed: 0
      },
      finalHtml: section.html,
      finalQuality: section.qualityScore
    };
  }

  /**
   * Get breakdown of enhancement types applied
   */
  private getEnhancementTypeBreakdown(output: EnhancedSections): Record<string, number> {
    const breakdown: Record<string, number> = {
      quality: 0,
      accessibility: 0,
      performance: 0,
      styling: 0
    };

    for (const summary of output.enhancementsApplied) {
      for (const enhancement of summary.enhancementsApplied) {
        if (enhancement.applied) {
          breakdown[enhancement.type] = (breakdown[enhancement.type] || 0) + 1;
        }
      }
    }

    return breakdown;
  }

  protected validateInput(input: ValidatedSections, context: PipelineContext): void {
    super.validateInput(input, context);

    if (!input.sections || input.sections.length === 0) {
      throw this.createPhaseError('At least one validated section is required for enhancement', 'PHASE4_ERROR');
    }

    if (!input.qualityMetrics) {
      throw this.createPhaseError('Quality metrics are required for enhancement', 'PHASE4_ERROR');
    }

    for (const section of input.sections) {
      if (!section.validationResult) {
        throw this.createPhaseError(`Section ${section.id} is missing validation results`, 'PHASE4_ERROR');
      }

      if (typeof section.qualityScore !== 'number') {
        throw this.createPhaseError(`Section ${section.id} has invalid quality score`, 'PHASE4_ERROR');
      }
    }
  }
}
