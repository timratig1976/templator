import { createLogger } from '../utils/logger';
import { logToFrontend } from '../routes/logs';
import { HubSpotValidationService, ValidationResult, ValidationError, ValidationSeverity, HubSpotModule } from './HubSpotValidationService';
import { HubSpotPromptService, ModuleGenerationRequest, GeneratedModule } from './HubSpotPromptService';
import OpenAIService from './openaiService';

const logger = createLogger();

export interface ConfidenceMetrics {
  overall: number;
  fieldAccuracy: number;
  templateQuality: number;
  syntaxCorrectness: number;
  accessibilityCompliance: number;
  performanceOptimization: number;
  hubspotCompliance: number;
}

export interface RefinementIteration {
  iteration: number;
  generatedModule: GeneratedModule;
  validationResult: ValidationResult;
  confidence: ConfidenceMetrics;
  improvements: string[];
  refinementPrompt: string;
  timestamp: Date;
}

export interface RefinementResult {
  finalModule: GeneratedModule;
  finalValidation: ValidationResult;
  finalConfidence: ConfidenceMetrics;
  iterations: RefinementIteration[];
  totalIterations: number;
  improvementAchieved: boolean;
  processingTime: number;
}

export interface RefinementConfig {
  maxIterations: number;
  confidenceThreshold: number;
  improvementThreshold: number;
  focusAreas: string[];
  enableDeepRefinement: boolean;
}

export class IterativeRefinementService {
  private static instance: IterativeRefinementService;
  private validationService: HubSpotValidationService;
  private promptService: HubSpotPromptService;
  private openaiService: typeof OpenAIService;

  constructor() {
    this.validationService = HubSpotValidationService.getInstance();
    this.promptService = HubSpotPromptService.getInstance();
    this.openaiService = OpenAIService;
  }

  public static getInstance(): IterativeRefinementService {
    if (!IterativeRefinementService.instance) {
      IterativeRefinementService.instance = new IterativeRefinementService();
    }
    return IterativeRefinementService.instance;
  }

  /**
   * Calculate confidence metrics for a generated module
   */
  calculateConfidenceMetrics(
    generatedModule: GeneratedModule,
    validationResult: ValidationResult
  ): ConfidenceMetrics {
    const criticalErrors = validationResult.errors.filter(e => e.type === ValidationSeverity.CRITICAL).length;
    const highErrors = validationResult.errors.filter(e => e.type === ValidationSeverity.HIGH).length;
    const mediumErrors = validationResult.errors.filter(e => e.type === ValidationSeverity.MEDIUM).length;
    const warnings = validationResult.warnings.length;

    // Field accuracy based on field validation errors
    const fieldErrors = validationResult.errors.filter(e => e.category === 'FIELD').length;
    const fieldAccuracy = Math.max(0, 100 - (fieldErrors * 15));

    // Template quality based on template and syntax errors
    const templateErrors = validationResult.errors.filter(e => 
      e.category === 'TEMPLATE' || e.category === 'SYNTAX'
    ).length;
    const templateQuality = Math.max(0, 100 - (templateErrors * 10));

    // Syntax correctness
    const syntaxErrors = validationResult.errors.filter(e => e.category === 'SYNTAX').length;
    const syntaxCorrectness = syntaxErrors === 0 ? 100 : Math.max(0, 100 - (syntaxErrors * 20));

    // Use validation metrics if available
    const accessibilityCompliance = validationResult.metrics?.accessibility_score || 0;
    const performanceOptimization = validationResult.metrics?.performance_score || 0;

    // HubSpot compliance based on critical and high errors
    const hubspotCompliance = Math.max(0, 100 - (criticalErrors * 25 + highErrors * 15));

    // Overall confidence calculation
    const overall = Math.max(0, 100 - (
      criticalErrors * 30 +
      highErrors * 20 +
      mediumErrors * 10 +
      warnings * 5
    ));

    const confidence: ConfidenceMetrics = {
      overall,
      fieldAccuracy,
      templateQuality,
      syntaxCorrectness,
      accessibilityCompliance,
      performanceOptimization,
      hubspotCompliance
    };

    logger.debug('Calculated confidence metrics', {
      confidence,
      criticalErrors,
      highErrors,
      mediumErrors,
      warnings
    });

    return confidence;
  }

  /**
   * Generate refinement prompt based on validation issues
   */
  generateRefinementPrompt(
    originalRequest: ModuleGenerationRequest,
    validationResult: ValidationResult,
    previousIterations: RefinementIteration[],
    focusAreas: string[] = []
  ): string {
    const criticalIssues = validationResult.errors
      .filter(e => e.type === ValidationSeverity.CRITICAL)
      .map(e => `- ${e.message} (${e.code})`)
      .join('\n');

    const highPriorityIssues = validationResult.errors
      .filter(e => e.type === ValidationSeverity.HIGH)
      .map(e => `- ${e.message} (${e.code})`)
      .join('\n');

    const suggestions = validationResult.suggestions
      .map(s => `- ${s.message}`)
      .join('\n');

    const previousAttempts = previousIterations.length > 0 ? 
      `\n\nPrevious refinement attempts (${previousIterations.length}):\n` +
      previousIterations.map((iter, idx) => 
        `Attempt ${idx + 1}: ${iter.improvements.join(', ')}`
      ).join('\n') : '';

    const focusAreasText = focusAreas.length > 0 ? 
      `\n\nFocus specifically on these areas: ${focusAreas.join(', ')}` : '';

    return `You are refining a HubSpot module that has validation issues. Please fix the following problems while maintaining the original functionality and design intent.

ORIGINAL REQUEST:
Module Type: ${originalRequest.moduleType}
Description: ${originalRequest.designDescription || 'No description provided'}
Requirements: ${originalRequest.requirements || 'None specified'}

CRITICAL ISSUES TO FIX:
${criticalIssues || 'None'}

HIGH PRIORITY ISSUES:
${highPriorityIssues || 'None'}

IMPROVEMENT SUGGESTIONS:
${suggestions || 'None'}

${previousAttempts}${focusAreasText}

REFINEMENT GUIDELINES:
1. Fix all critical and high-priority validation errors
2. Maintain the original module's purpose and design
3. Ensure all field IDs are unique and follow HubSpot naming conventions
4. Use proper HubL syntax and avoid deprecated features
5. Include proper accessibility attributes (ARIA labels, alt text, etc.)
6. Optimize for performance (avoid inline styles, use semantic HTML)
7. Ensure mobile responsiveness and cross-browser compatibility

Please provide the refined module with the same structure:
- fields.json (complete field definitions)
- meta.json (module metadata with content_types)
- module.html (complete template with HubL)

Focus on quality over quantity - make precise, targeted improvements.`;
  }

  /**
   * Perform iterative refinement on a generated module
   */
  async refineModule(
    originalRequest: ModuleGenerationRequest,
    initialModule: GeneratedModule,
    config: RefinementConfig = {
      maxIterations: 3,
      confidenceThreshold: 85,
      improvementThreshold: 10,
      focusAreas: [],
      enableDeepRefinement: true
    },
    requestId?: string
  ): Promise<RefinementResult> {
    const startTime = Date.now();
    const iterations: RefinementIteration[] = [];
    let currentModule = initialModule;
    let bestModule = initialModule;
    let bestConfidence: ConfidenceMetrics | null = null;

    logger.info('Starting iterative refinement', {
      moduleType: originalRequest.moduleType,
      maxIterations: config.maxIterations,
      confidenceThreshold: config.confidenceThreshold,
      requestId
    });

    logToFrontend('info', 'processing', '🔄 Starting iterative refinement', {
      maxIterations: config.maxIterations,
      confidenceThreshold: config.confidenceThreshold
    }, requestId);

    try {
      for (let iteration = 1; iteration <= config.maxIterations; iteration++) {
        logger.info(`Starting refinement iteration ${iteration}`, { requestId });
        
        logToFrontend('info', 'processing', `🔍 Refinement iteration ${iteration}`, {
          iteration,
          maxIterations: config.maxIterations
        }, requestId);

        // Validate current module
        const validationResult = await this.validationService.validateModule({
          fields: currentModule.fields,
          meta: currentModule.meta,
          template: currentModule.template
        });

        // Calculate confidence metrics
        const confidence = this.calculateConfidenceMetrics(currentModule, validationResult);

        // Check if we've reached our confidence threshold
        if (confidence.overall >= config.confidenceThreshold) {
          logger.info(`Confidence threshold reached: ${confidence.overall}%`, { 
            iteration, 
            requestId 
          });
          
          logToFrontend('success', 'processing', '✅ Confidence threshold reached', {
            confidence: confidence.overall,
            iteration
          }, requestId);

          break;
        }

        // Track best result so far
        if (!bestConfidence || confidence.overall > bestConfidence.overall) {
          bestModule = currentModule;
          bestConfidence = confidence;
        }

        // Generate improvements list
        const improvements = this.generateImprovementsList(validationResult, confidence);

        // Store iteration data
        const refinementPrompt = this.generateRefinementPrompt(
          originalRequest,
          validationResult,
          iterations,
          config.focusAreas
        );

        iterations.push({
          iteration,
          generatedModule: currentModule,
          validationResult,
          confidence,
          improvements,
          refinementPrompt,
          timestamp: new Date()
        });

        // If this is the last iteration, don't generate a new module
        if (iteration === config.maxIterations) {
          logger.info('Reached maximum iterations', { 
            iteration, 
            maxIterations: config.maxIterations,
            requestId 
          });
          break;
        }

        // Generate refined module
        try {
          logToFrontend('info', 'processing', '🤖 Generating refinement', {
            iteration,
            issuesFound: validationResult.errors.length
          }, requestId);

          // Generate refined module using OpenAI with refinement prompt
          const refinedContent = await this.openaiService.generateHubSpotModule(
            refinementPrompt
          );
          
          // Parse the refined module response
          const refinedModule = await this.promptService.generateModule({
            ...originalRequest,
            designDescription: refinementPrompt
          });

          currentModule = refinedModule;

          logger.info(`Completed refinement iteration ${iteration}`, {
            confidence: confidence.overall,
            errorsFound: validationResult.errors.length,
            requestId
          });

        } catch (error) {
          logger.error(`Refinement iteration ${iteration} failed`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId
          });

          logToFrontend('error', 'processing', `❌ Refinement iteration ${iteration} failed`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          }, requestId);

          // Continue with current module if refinement fails
          break;
        }
      }

      // Final validation of the best module
      const finalValidation = await this.validationService.validateModule({
        fields: bestModule.fields,
        meta: bestModule.meta,
        template: bestModule.template
      });

      const finalConfidence = this.calculateConfidenceMetrics(bestModule, finalValidation);
      const processingTime = Date.now() - startTime;

      // Determine if improvement was achieved
      const initialConfidence = iterations.length > 0 ? iterations[0].confidence.overall : 0;
      const improvementAchieved = finalConfidence.overall > initialConfidence + config.improvementThreshold;

      const result: RefinementResult = {
        finalModule: bestModule,
        finalValidation,
        finalConfidence,
        iterations,
        totalIterations: iterations.length,
        improvementAchieved,
        processingTime
      };

      logger.info('Completed iterative refinement', {
        totalIterations: iterations.length,
        initialConfidence,
        finalConfidence: finalConfidence.overall,
        improvementAchieved,
        processingTime,
        requestId
      });

      logToFrontend('success', 'processing', '🎯 Refinement completed', {
        totalIterations: iterations.length,
        finalConfidence: finalConfidence.overall,
        improvementAchieved,
        processingTime
      }, requestId);

      return result;

    } catch (error) {
      logger.error('Iterative refinement failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        iterations: iterations.length,
        requestId
      });

      logToFrontend('error', 'processing', '❌ Refinement process failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        iterations: iterations.length
      }, requestId);

      throw error;
    }
  }

  /**
   * Generate list of improvements based on validation results
   */
  private generateImprovementsList(
    validationResult: ValidationResult,
    confidence: ConfidenceMetrics
  ): string[] {
    const improvements: string[] = [];

    // Critical errors
    const criticalErrors = validationResult.errors.filter(e => e.type === ValidationSeverity.CRITICAL);
    if (criticalErrors.length > 0) {
      improvements.push(`Fix ${criticalErrors.length} critical validation errors`);
    }

    // High priority errors
    const highErrors = validationResult.errors.filter(e => e.type === ValidationSeverity.HIGH);
    if (highErrors.length > 0) {
      improvements.push(`Resolve ${highErrors.length} high-priority issues`);
    }

    // Specific improvement areas based on confidence
    if (confidence.fieldAccuracy < 80) {
      improvements.push('Improve field definitions and validation');
    }

    if (confidence.templateQuality < 80) {
      improvements.push('Enhance template structure and HubL syntax');
    }

    if (confidence.accessibilityCompliance < 80) {
      improvements.push('Add accessibility attributes and ARIA labels');
    }

    if (confidence.performanceOptimization < 80) {
      improvements.push('Optimize for performance and loading speed');
    }

    if (confidence.hubspotCompliance < 90) {
      improvements.push('Ensure full HubSpot CMS compatibility');
    }

    return improvements;
  }

  /**
   * Analyze refinement effectiveness
   */
  analyzeRefinementEffectiveness(result: RefinementResult): {
    effectiveness: number;
    insights: string[];
    recommendations: string[];
  } {
    const { iterations, improvementAchieved, finalConfidence } = result;
    
    const initialConfidence = iterations.length > 0 ? iterations[0].confidence.overall : 0;
    const improvement = finalConfidence.overall - initialConfidence;
    const effectiveness = Math.min(100, Math.max(0, improvement * 2));

    const insights: string[] = [];
    const recommendations: string[] = [];

    // Analyze improvement trajectory
    if (improvement > 20) {
      insights.push('Significant improvement achieved through refinement');
    } else if (improvement > 10) {
      insights.push('Moderate improvement achieved');
    } else if (improvement > 0) {
      insights.push('Minor improvement achieved');
    } else {
      insights.push('No measurable improvement from refinement');
    }

    // Analyze iteration efficiency
    if (iterations.length > 0) {
      const avgImprovementPerIteration = improvement / iterations.length;
      if (avgImprovementPerIteration > 10) {
        insights.push('High efficiency per refinement iteration');
      } else if (avgImprovementPerIteration > 5) {
        insights.push('Moderate efficiency per iteration');
      } else {
        insights.push('Low efficiency per iteration');
        recommendations.push('Consider improving refinement prompts');
      }
    }

    // Final confidence analysis
    if (finalConfidence.overall >= 90) {
      insights.push('Excellent final quality achieved');
    } else if (finalConfidence.overall >= 80) {
      insights.push('Good final quality achieved');
    } else if (finalConfidence.overall >= 70) {
      insights.push('Acceptable final quality achieved');
      recommendations.push('Consider additional refinement iterations');
    } else {
      insights.push('Final quality below expectations');
      recommendations.push('Review prompt engineering and validation criteria');
    }

    // Specific area recommendations
    if (finalConfidence.accessibilityCompliance < 80) {
      recommendations.push('Focus on accessibility improvements in future refinements');
    }

    if (finalConfidence.performanceOptimization < 80) {
      recommendations.push('Emphasize performance optimization in refinement prompts');
    }

    return {
      effectiveness,
      insights,
      recommendations
    };
  }
}

// Export handled by class declaration
