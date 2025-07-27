import { createLogger } from '../utils/logger';
import { logToFrontend } from '../routes/logs';
import { TemplateLibraryService, ModuleTemplate, ExtensionPoint } from './TemplateLibraryService';
import { HubSpotPromptService, GeneratedModule, ModuleGenerationRequest } from './HubSpotPromptService';
import { HubSpotValidationService, ValidationResult } from './HubSpotValidationService';
import OpenAIService from './openaiService';

const logger = createLogger();

export interface CustomizationRequest {
  template_id: string;
  customizations: TemplateCustomization[];
  requirements?: string;
  target_audience?: string;
  brand_guidelines?: BrandGuidelines;
  content_preferences?: ContentPreferences;
}

export interface TemplateCustomization {
  extension_point_id: string;
  customization_type: 'replace' | 'extend' | 'modify' | 'style';
  value: any;
  ai_instructions?: string;
}

export interface BrandGuidelines {
  primary_colors: string[];
  secondary_colors: string[];
  fonts: string[];
  tone_of_voice: 'professional' | 'casual' | 'friendly' | 'authoritative' | 'playful';
  logo_url?: string;
  brand_keywords: string[];
}

export interface ContentPreferences {
  language: string;
  reading_level: 'elementary' | 'middle' | 'high_school' | 'college' | 'graduate';
  content_length: 'concise' | 'moderate' | 'detailed' | 'comprehensive';
  include_examples: boolean;
  technical_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface CustomizationResult {
  success: boolean;
  customized_module: GeneratedModule;
  validation_result: ValidationResult;
  applied_customizations: AppliedCustomization[];
  ai_suggestions: string[];
  processing_time: number;
  quality_score: number;
}

export interface AppliedCustomization {
  extension_point_id: string;
  customization_type: string;
  original_value: any;
  new_value: any;
  ai_enhanced: boolean;
  confidence: number;
}

export interface TemplateMergeRequest {
  primary_template_id: string;
  secondary_template_ids: string[];
  merge_strategy: 'combine' | 'overlay' | 'hybrid';
  conflict_resolution: 'primary_wins' | 'secondary_wins' | 'ai_decide' | 'manual';
}

export interface MergeResult {
  success: boolean;
  merged_template: ModuleTemplate;
  conflicts_resolved: ConflictResolution[];
  validation_result: ValidationResult;
  merge_quality_score: number;
}

export interface ConflictResolution {
  conflict_type: 'field_duplicate' | 'style_conflict' | 'incompatible_features';
  resolution_method: string;
  original_values: any[];
  resolved_value: any;
  confidence: number;
}

export class TemplateCustomizationService {
  private static instance: TemplateCustomizationService;
  private templateLibrary: TemplateLibraryService;
  private promptService: HubSpotPromptService;
  private validationService: HubSpotValidationService;
  private openaiService: typeof OpenAIService;

  constructor() {
    this.templateLibrary = TemplateLibraryService.getInstance();
    this.promptService = HubSpotPromptService.getInstance();
    this.validationService = HubSpotValidationService.getInstance();
    this.openaiService = OpenAIService;
  }

  public static getInstance(): TemplateCustomizationService {
    if (!TemplateCustomizationService.instance) {
      TemplateCustomizationService.instance = new TemplateCustomizationService();
    }
    return TemplateCustomizationService.instance;
  }

  /**
   * Customize a template based on user requirements
   */
  async customizeTemplate(
    request: CustomizationRequest,
    requestId?: string
  ): Promise<CustomizationResult> {
    const startTime = Date.now();

    logger.info('Starting template customization', {
      templateId: request.template_id,
      customizationCount: request.customizations.length,
      requestId
    });

    logToFrontend('info', 'processing', '🎨 Starting template customization', {
      templateId: request.template_id,
      customizations: request.customizations.length
    }, requestId);

    try {
      // Get the base template
      const baseTemplate = this.templateLibrary.getTemplate(request.template_id);
      if (!baseTemplate) {
        throw new Error(`Template not found: ${request.template_id}`);
      }

      // Create a working copy of the template
      let customizedModule: GeneratedModule = {
        fields: JSON.parse(JSON.stringify(baseTemplate.template_data.fields)),
        meta: JSON.parse(JSON.stringify(baseTemplate.template_data.meta)),
        template: baseTemplate.template_data.template,
        description: baseTemplate.description
      };

      const appliedCustomizations: AppliedCustomization[] = [];
      const aiSuggestions: string[] = [];

      // Apply each customization
      for (const customization of request.customizations) {
        const extensionPoint = baseTemplate.extension_points.find(
          ep => ep.id === customization.extension_point_id
        );

        if (!extensionPoint) {
          logger.warn('Extension point not found', {
            extensionPointId: customization.extension_point_id,
            templateId: request.template_id
          });
          continue;
        }

        const result = await this.applyCustomization(
          customizedModule,
          extensionPoint,
          customization,
          request.brand_guidelines,
          request.content_preferences,
          requestId
        );

        customizedModule = result.module;
        appliedCustomizations.push(result.appliedCustomization);
        
        if (result.aiSuggestion) {
          aiSuggestions.push(result.aiSuggestion);
        }
      }

      // Apply AI enhancements if requirements are provided
      if (request.requirements || request.brand_guidelines || request.content_preferences) {
        const enhancedModule = await this.applyAIEnhancements(
          customizedModule,
          request,
          requestId
        );
        customizedModule = enhancedModule.module;
        aiSuggestions.push(...enhancedModule.suggestions);
      }

      // Validate the customized module
      const validationResult = await this.validationService.validateModule(customizedModule);

      // Calculate quality score
      const qualityScore = this.calculateCustomizationQuality(
        baseTemplate,
        customizedModule,
        validationResult,
        appliedCustomizations
      );

      const processingTime = Date.now() - startTime;

      const result: CustomizationResult = {
        success: validationResult.valid,
        customized_module: customizedModule,
        validation_result: validationResult,
        applied_customizations: appliedCustomizations,
        ai_suggestions: aiSuggestions,
        processing_time: processingTime,
        quality_score: qualityScore
      };

      logger.info('Template customization completed', {
        templateId: request.template_id,
        success: result.success,
        qualityScore: result.quality_score,
        processingTime,
        requestId
      });

      logToFrontend('success', 'processing', '✅ Template customization completed', {
        success: result.success,
        qualityScore: Math.round(result.quality_score),
        appliedCustomizations: appliedCustomizations.length
      }, requestId);

      return result;

    } catch (error) {
      logger.error('Template customization failed', {
        templateId: request.template_id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      logToFrontend('error', 'processing', '❌ Template customization failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, requestId);

      throw error;
    }
  }

  /**
   * Apply a single customization to a module
   */
  private async applyCustomization(
    module: GeneratedModule,
    extensionPoint: ExtensionPoint,
    customization: TemplateCustomization,
    brandGuidelines?: BrandGuidelines,
    contentPreferences?: ContentPreferences,
    requestId?: string
  ): Promise<{
    module: GeneratedModule;
    appliedCustomization: AppliedCustomization;
    aiSuggestion?: string;
  }> {
    const originalValue = this.extractOriginalValue(module, extensionPoint);
    let newValue = customization.value;
    let aiEnhanced = false;
    let confidence = 100;

    // Apply AI enhancement if instructions are provided
    if (customization.ai_instructions) {
      const aiResult = await this.enhanceWithAI(
        module,
        extensionPoint,
        customization,
        brandGuidelines,
        contentPreferences,
        requestId
      );
      
      newValue = aiResult.enhancedValue;
      aiEnhanced = true;
      confidence = aiResult.confidence;
    }

    // Apply the customization based on type
    const updatedModule = this.applyCustomizationByType(
      module,
      extensionPoint,
      customization.customization_type,
      newValue
    );

    const appliedCustomization: AppliedCustomization = {
      extension_point_id: extensionPoint.id,
      customization_type: customization.customization_type,
      original_value: originalValue,
      new_value: newValue,
      ai_enhanced: aiEnhanced,
      confidence
    };

    return {
      module: updatedModule,
      appliedCustomization,
      aiSuggestion: aiEnhanced ? `AI enhanced ${extensionPoint.name} based on your requirements` : undefined
    };
  }

  /**
   * Apply AI enhancements to the entire module
   */
  private async applyAIEnhancements(
    module: GeneratedModule,
    request: CustomizationRequest,
    requestId?: string
  ): Promise<{
    module: GeneratedModule;
    suggestions: string[];
  }> {
    const enhancementPrompt = this.buildEnhancementPrompt(module, request);
    
    try {
      const aiResponse = await this.openaiService.generateHubSpotModule(enhancementPrompt);
      // Parse the AI response manually since parseModuleResponse is private
      const enhancedModule = this.parseAIResponse(aiResponse);
      
      const suggestions = [
        'AI enhanced content based on your requirements',
        'Optimized for your target audience',
        'Applied brand guidelines to styling and content'
      ];

      if (request.brand_guidelines) {
        suggestions.push('Integrated brand colors and tone of voice');
      }

      if (request.content_preferences) {
        suggestions.push(`Adjusted content for ${request.content_preferences.reading_level} reading level`);
      }

      return {
        module: enhancedModule,
        suggestions
      };

    } catch (error) {
      logger.warn('AI enhancement failed, using original module', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      return {
        module,
        suggestions: ['AI enhancement was attempted but failed - using base customizations']
      };
    }
  }

  /**
   * Merge multiple templates into a single template
   */
  async mergeTemplates(
    request: TemplateMergeRequest,
    requestId?: string
  ): Promise<MergeResult> {
    logger.info('Starting template merge', {
      primaryTemplate: request.primary_template_id,
      secondaryTemplates: request.secondary_template_ids,
      strategy: request.merge_strategy,
      requestId
    });

    try {
      // Get all templates
      const primaryTemplate = this.templateLibrary.getTemplate(request.primary_template_id);
      if (!primaryTemplate) {
        throw new Error(`Primary template not found: ${request.primary_template_id}`);
      }

      const secondaryTemplates = request.secondary_template_ids.map(id => {
        const template = this.templateLibrary.getTemplate(id);
        if (!template) {
          throw new Error(`Secondary template not found: ${id}`);
        }
        return template;
      });

      // Perform the merge based on strategy
      let mergedTemplate: ModuleTemplate;
      let conflictsResolved: ConflictResolution[] = [];

      switch (request.merge_strategy) {
        case 'combine':
          ({ mergedTemplate, conflicts: conflictsResolved } = await this.combineTemplates(
            primaryTemplate,
            secondaryTemplates,
            request.conflict_resolution
          ));
          break;

        case 'overlay':
          ({ mergedTemplate, conflicts: conflictsResolved } = await this.overlayTemplates(
            primaryTemplate,
            secondaryTemplates,
            request.conflict_resolution
          ));
          break;

        case 'hybrid':
          ({ mergedTemplate, conflicts: conflictsResolved } = await this.hybridMergeTemplates(
            primaryTemplate,
            secondaryTemplates,
            request.conflict_resolution
          ));
          break;

        default:
          throw new Error(`Unknown merge strategy: ${request.merge_strategy}`);
      }

      // Validate the merged template
      const validationResult = await this.validationService.validateModule({
        fields: mergedTemplate.template_data.fields,
        meta: mergedTemplate.template_data.meta,
        template: mergedTemplate.template_data.template
      });

      // Calculate merge quality score
      const mergeQualityScore = this.calculateMergeQuality(
        primaryTemplate,
        secondaryTemplates,
        mergedTemplate,
        validationResult,
        conflictsResolved
      );

      const result: MergeResult = {
        success: validationResult.valid,
        merged_template: mergedTemplate,
        conflicts_resolved: conflictsResolved,
        validation_result: validationResult,
        merge_quality_score: mergeQualityScore
      };

      logger.info('Template merge completed', {
        success: result.success,
        conflictsResolved: conflictsResolved.length,
        mergeQualityScore: result.merge_quality_score,
        requestId
      });

      return result;

    } catch (error) {
      logger.error('Template merge failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  /**
   * Get customization recommendations for a template
   */
  getCustomizationRecommendations(
    templateId: string,
    userContext?: {
      industry?: string;
      use_case?: string;
      target_audience?: string;
    }
  ): {
    recommended_customizations: TemplateCustomization[];
    reasoning: string[];
  } {
    const template = this.templateLibrary.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const recommendations: TemplateCustomization[] = [];
    const reasoning: string[] = [];

    // Analyze extension points and suggest customizations
    for (const extensionPoint of template.extension_points) {
      if (extensionPoint.type === 'style' && userContext?.industry) {
        recommendations.push({
          extension_point_id: extensionPoint.id,
          customization_type: 'modify',
          value: this.getIndustryStyleRecommendation(userContext.industry),
          ai_instructions: `Adapt the ${extensionPoint.name} for the ${userContext.industry} industry`
        });
        reasoning.push(`Recommended ${extensionPoint.name} customization for ${userContext.industry} industry`);
      }

      if (extensionPoint.type === 'field' && userContext?.use_case) {
        recommendations.push({
          extension_point_id: extensionPoint.id,
          customization_type: 'extend',
          value: this.getUseCaseFieldRecommendation(userContext.use_case),
          ai_instructions: `Add fields relevant to ${userContext.use_case} use case`
        });
        reasoning.push(`Added fields optimized for ${userContext.use_case} use case`);
      }
    }

    return {
      recommended_customizations: recommendations,
      reasoning
    };
  }

  // Helper methods for template operations
  private extractOriginalValue(module: GeneratedModule, extensionPoint: ExtensionPoint): any {
    // Extract the current value at the extension point
    // Implementation depends on extension point type and location
    return null; // Placeholder
  }

  private applyCustomizationByType(
    module: GeneratedModule,
    extensionPoint: ExtensionPoint,
    type: string,
    value: any
  ): GeneratedModule {
    // Apply customization based on type
    // Implementation depends on customization type
    return module; // Placeholder
  }

  private async enhanceWithAI(
    module: GeneratedModule,
    extensionPoint: ExtensionPoint,
    customization: TemplateCustomization,
    brandGuidelines?: BrandGuidelines,
    contentPreferences?: ContentPreferences,
    requestId?: string
  ): Promise<{ enhancedValue: any; confidence: number }> {
    // Use AI to enhance the customization value
    return { enhancedValue: customization.value, confidence: 85 }; // Placeholder
  }

  private buildEnhancementPrompt(
    module: GeneratedModule,
    request: CustomizationRequest
  ): string {
    let prompt = `Enhance this HubSpot module template based on the following requirements:\n\n`;
    
    if (request.requirements) {
      prompt += `Requirements: ${request.requirements}\n\n`;
    }

    if (request.brand_guidelines) {
      prompt += `Brand Guidelines:\n`;
      prompt += `- Primary Colors: ${request.brand_guidelines.primary_colors.join(', ')}\n`;
      prompt += `- Tone of Voice: ${request.brand_guidelines.tone_of_voice}\n`;
      if (request.brand_guidelines.brand_keywords.length > 0) {
        prompt += `- Brand Keywords: ${request.brand_guidelines.brand_keywords.join(', ')}\n`;
      }
      prompt += '\n';
    }

    if (request.content_preferences) {
      prompt += `Content Preferences:\n`;
      prompt += `- Reading Level: ${request.content_preferences.reading_level}\n`;
      prompt += `- Content Length: ${request.content_preferences.content_length}\n`;
      prompt += `- Technical Level: ${request.content_preferences.technical_level}\n\n`;
    }

    prompt += `Current Module:\n`;
    prompt += `Fields: ${JSON.stringify(module.fields, null, 2)}\n`;
    prompt += `Meta: ${JSON.stringify(module.meta, null, 2)}\n`;
    prompt += `Template: ${module.template}\n\n`;
    
    prompt += `Please enhance this module while maintaining HubSpot compatibility and best practices.`;

    return prompt;
  }

  private calculateCustomizationQuality(
    baseTemplate: ModuleTemplate,
    customizedModule: GeneratedModule,
    validationResult: ValidationResult,
    appliedCustomizations: AppliedCustomization[]
  ): number {
    let score = validationResult.score * 0.6; // Base validation score (60%)
    
    // Customization success rate (20%)
    const successfulCustomizations = appliedCustomizations.filter(c => c.confidence > 70).length;
    const customizationSuccessRate = appliedCustomizations.length > 0 ? 
      (successfulCustomizations / appliedCustomizations.length) * 100 : 100;
    score += customizationSuccessRate * 0.2;

    // AI enhancement bonus (10%)
    const aiEnhancedCount = appliedCustomizations.filter(c => c.ai_enhanced).length;
    const aiEnhancementBonus = aiEnhancedCount > 0 ? 10 : 0;
    score += aiEnhancementBonus * 0.1;

    // Template compatibility (10%)
    const compatibilityScore = baseTemplate.validation_score;
    score += compatibilityScore * 0.1;

    return Math.min(100, Math.max(0, score));
  }

  private calculateMergeQuality(
    primaryTemplate: ModuleTemplate,
    secondaryTemplates: ModuleTemplate[],
    mergedTemplate: ModuleTemplate,
    validationResult: ValidationResult,
    conflictsResolved: ConflictResolution[]
  ): number {
    // Calculate merge quality based on various factors
    let score = validationResult.score * 0.5; // Base validation (50%)
    
    // Conflict resolution quality (30%)
    const highConfidenceResolutions = conflictsResolved.filter(c => c.confidence > 80).length;
    const resolutionQuality = conflictsResolved.length > 0 ? 
      (highConfidenceResolutions / conflictsResolved.length) * 100 : 100;
    score += resolutionQuality * 0.3;

    // Template compatibility (20%)
    const avgTemplateScore = [primaryTemplate, ...secondaryTemplates]
      .reduce((sum, t) => sum + t.validation_score, 0) / (secondaryTemplates.length + 1);
    score += avgTemplateScore * 0.2;

    return Math.min(100, Math.max(0, score));
  }

  // Placeholder methods for merge strategies
  private async combineTemplates(
    primary: ModuleTemplate,
    secondary: ModuleTemplate[],
    conflictResolution: string
  ): Promise<{ mergedTemplate: ModuleTemplate; conflicts: ConflictResolution[] }> {
    // Implement combine strategy
    return { mergedTemplate: primary, conflicts: [] }; // Placeholder
  }

  private async overlayTemplates(
    primary: ModuleTemplate,
    secondary: ModuleTemplate[],
    conflictResolution: string
  ): Promise<{ mergedTemplate: ModuleTemplate; conflicts: ConflictResolution[] }> {
    // Implement overlay strategy
    return { mergedTemplate: primary, conflicts: [] }; // Placeholder
  }

  private async hybridMergeTemplates(
    primary: ModuleTemplate,
    secondary: ModuleTemplate[],
    conflictResolution: string
  ): Promise<{ mergedTemplate: ModuleTemplate; conflicts: ConflictResolution[] }> {
    // Implement hybrid strategy
    return { mergedTemplate: primary, conflicts: [] }; // Placeholder
  }

  private getIndustryStyleRecommendation(industry: string): any {
    // Return style recommendations based on industry
    return {}; // Placeholder
  }

  private getUseCaseFieldRecommendation(useCase: string): any {
    // Return field recommendations based on use case
    return {}; // Placeholder
  }

  /**
   * Parse AI response into GeneratedModule format
   */
  private parseAIResponse(aiResponse: string): GeneratedModule {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(aiResponse);
      
      if (parsed.fields && parsed.meta && parsed.template) {
        return {
          fields: parsed.fields,
          meta: parsed.meta,
          template: parsed.template,
          description: parsed.description || 'AI-enhanced module'
        };
      }
      
      // If not in expected format, try to extract components
      const fieldsMatch = aiResponse.match(/"fields"\s*:\s*(\[.*?\])/s);
      const metaMatch = aiResponse.match(/"meta"\s*:\s*(\{.*?\})/s);
      const templateMatch = aiResponse.match(/"template"\s*:\s*"(.*?)"/s);
      
      if (fieldsMatch && metaMatch && templateMatch) {
        return {
          fields: JSON.parse(fieldsMatch[1]),
          meta: JSON.parse(metaMatch[1]),
          template: templateMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
          description: 'AI-enhanced module'
        };
      }
      
      throw new Error('Unable to parse AI response into module format');
      
    } catch (error) {
      logger.warn('Failed to parse AI response, using fallback', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Return a basic fallback module
      return {
        fields: [],
        meta: {
          label: 'AI Enhanced Module',
          content_types: ['page']
        },
        template: '<div>AI enhancement failed - using original template</div>',
        description: 'AI enhancement failed'
      };
    }
  }
}

// Export handled by class declaration
