import { createLogger } from '../../utils/logger';
import { logToFrontend } from '../../routes/logs';
import { HubSpotValidationService, ValidationResult, ValidationError, ValidationSeverity, ValidationCategory, HubSpotModule } from '../quality/HubSpotValidationService';
import { GeneratedModule } from '../deployment/HubSpotPromptService';

const logger = createLogger();

export interface CorrectionRule {
  errorCode: string;
  errorCategory: ValidationCategory;
  severity: ValidationSeverity;
  correctionFunction: (module: GeneratedModule, error: ValidationError) => Promise<GeneratedModule>;
  description: string;
  confidence: number; // 0-100, how confident we are this correction will work
}

export interface CorrectionResult {
  success: boolean;
  correctedModule?: GeneratedModule;
  appliedCorrections: AppliedCorrection[];
  remainingErrors: ValidationError[];
  correctionConfidence: number;
  processingTime: number;
}

export interface AppliedCorrection {
  errorCode: string;
  errorMessage: string;
  correctionApplied: string;
  confidence: number;
  success: boolean;
}

export class AutoErrorCorrectionService {
  private static instance: AutoErrorCorrectionService;
  private validationService: HubSpotValidationService;
  private correctionRules: Map<string, CorrectionRule> = new Map();

  constructor() {
    this.validationService = HubSpotValidationService.getInstance();
    this.initializeCorrectionRules();
  }

  public static getInstance(): AutoErrorCorrectionService {
    if (!AutoErrorCorrectionService.instance) {
      AutoErrorCorrectionService.instance = new AutoErrorCorrectionService();
    }
    return AutoErrorCorrectionService.instance;
  }

  /**
   * Initialize built-in correction rules
   */
  private initializeCorrectionRules(): void {
    // Field ID corrections
    this.addCorrectionRule({
      errorCode: 'FIELD_INVALID_ID',
      errorCategory: ValidationCategory.FIELD,
      severity: ValidationSeverity.CRITICAL,
      description: 'Fix invalid field IDs to follow HubSpot naming conventions',
      confidence: 95,
      correctionFunction: this.correctFieldIds.bind(this)
    });

    // Duplicate field ID corrections
    this.addCorrectionRule({
      errorCode: 'FIELD_DUPLICATE_ID',
      errorCategory: ValidationCategory.FIELD,
      severity: ValidationSeverity.CRITICAL,
      description: 'Remove duplicate field IDs by making them unique',
      confidence: 90,
      correctionFunction: this.correctDuplicateFieldIds.bind(this)
    });

    // Reserved field name corrections
    this.addCorrectionRule({
      errorCode: 'FIELD_RESERVED_NAME',
      errorCategory: ValidationCategory.FIELD,
      severity: ValidationSeverity.HIGH,
      description: 'Replace reserved field names with valid alternatives',
      confidence: 85,
      correctionFunction: this.correctReservedFieldNames.bind(this)
    });

    // Missing required field properties
    this.addCorrectionRule({
      errorCode: 'FIELD_MISSING_PROPERTY',
      errorCategory: ValidationCategory.FIELD,
      severity: ValidationSeverity.HIGH,
      description: 'Add missing required field properties',
      confidence: 80,
      correctionFunction: this.correctMissingFieldProperties.bind(this)
    });

    // Invalid field types
    this.addCorrectionRule({
      errorCode: 'FIELD_INVALID_TYPE',
      errorCategory: ValidationCategory.FIELD,
      severity: ValidationSeverity.CRITICAL,
      description: 'Correct invalid field types to supported HubSpot types',
      confidence: 85,
      correctionFunction: this.correctInvalidFieldTypes.bind(this)
    });

    // Meta.json corrections (using FIELD category as meta validation is part of field validation)
    this.addCorrectionRule({
      errorCode: 'META_MISSING_CONTENT_TYPES',
      errorCategory: ValidationCategory.FIELD,
      severity: ValidationSeverity.CRITICAL,
      description: 'Add missing content_types property to meta.json',
      confidence: 95,
      correctionFunction: this.correctMissingContentTypes.bind(this)
    });

    // Template syntax corrections
    this.addCorrectionRule({
      errorCode: 'TEMPLATE_INVALID_HUBL',
      errorCategory: ValidationCategory.TEMPLATE,
      severity: ValidationSeverity.HIGH,
      description: 'Fix invalid HubL syntax in template',
      confidence: 70,
      correctionFunction: this.correctInvalidHubL.bind(this)
    });

    // Accessibility corrections
    this.addCorrectionRule({
      errorCode: 'ACCESSIBILITY_MISSING_ALT',
      errorCategory: ValidationCategory.ACCESSIBILITY,
      severity: ValidationSeverity.HIGH,
      description: 'Add missing alt attributes to images',
      confidence: 90,
      correctionFunction: this.correctMissingAltText.bind(this)
    });

    // Performance corrections
    this.addCorrectionRule({
      errorCode: 'PERFORMANCE_INLINE_STYLES',
      errorCategory: ValidationCategory.PERFORMANCE,
      severity: ValidationSeverity.MEDIUM,
      description: 'Remove inline styles and use CSS classes',
      confidence: 75,
      correctionFunction: this.correctInlineStyles.bind(this)
    });
  }

  /**
   * Add a new correction rule
   */
  addCorrectionRule(rule: CorrectionRule): void {
    this.correctionRules.set(rule.errorCode, rule);
    logger.debug('Added correction rule', {
      errorCode: rule.errorCode,
      confidence: rule.confidence,
      description: rule.description
    });
  }

  /**
   * Automatically correct validation errors in a module
   */
  async correctErrors(
    module: GeneratedModule,
    validationResult: ValidationResult,
    requestId?: string
  ): Promise<CorrectionResult> {
    const startTime = Date.now();
    let correctedModule = { ...module };
    const appliedCorrections: AppliedCorrection[] = [];
    const remainingErrors: ValidationError[] = [];

    logger.info('Starting automatic error correction', {
      errorCount: validationResult.errors.length,
      warningCount: validationResult.warnings.length,
      requestId
    });

    logToFrontend('info', 'processing', '🔧 Starting automatic error correction', {
      errorCount: validationResult.errors.length,
      warningCount: validationResult.warnings.length
    }, requestId);

    try {
      // Sort errors by severity (critical first)
      const sortedErrors = [...validationResult.errors].sort((a, b) => {
        const severityOrder = {
          [ValidationSeverity.CRITICAL]: 0,
          [ValidationSeverity.HIGH]: 1,
          [ValidationSeverity.MEDIUM]: 2,
          [ValidationSeverity.LOW]: 3
        };
        return severityOrder[a.type] - severityOrder[b.type];
      });

      // Apply corrections for each error
      for (const error of sortedErrors) {
        const rule = this.correctionRules.get(error.code);
        
        if (!rule) {
          logger.debug('No correction rule found for error', {
            errorCode: error.code,
            message: error.message
          });
          remainingErrors.push(error);
          continue;
        }

        try {
          logger.debug('Applying correction', {
            errorCode: error.code,
            confidence: rule.confidence,
            requestId
          });

          logToFrontend('info', 'processing', `🔧 Applying correction: ${rule.description}`, {
            errorCode: error.code,
            confidence: rule.confidence
          }, requestId);

          const correctedModuleResult = await rule.correctionFunction(correctedModule, error);
          correctedModule = correctedModuleResult;

          appliedCorrections.push({
            errorCode: error.code,
            errorMessage: error.message,
            correctionApplied: rule.description,
            confidence: rule.confidence,
            success: true
          });

          logger.info('Successfully applied correction', {
            errorCode: error.code,
            description: rule.description,
            requestId
          });

        } catch (correctionError) {
          logger.error('Failed to apply correction', {
            errorCode: error.code,
            error: correctionError instanceof Error ? correctionError.message : 'Unknown error',
            requestId
          });

          appliedCorrections.push({
            errorCode: error.code,
            errorMessage: error.message,
            correctionApplied: rule.description,
            confidence: rule.confidence,
            success: false
          });

          remainingErrors.push(error);
        }
      }

      // Calculate overall correction confidence
      const successfulCorrections = appliedCorrections.filter(c => c.success);
      const correctionConfidence = successfulCorrections.length > 0 ?
        successfulCorrections.reduce((sum, c) => sum + c.confidence, 0) / successfulCorrections.length : 0;

      const processingTime = Date.now() - startTime;
      const success = appliedCorrections.length > 0 && successfulCorrections.length > 0;

      const result: CorrectionResult = {
        success,
        correctedModule: success ? correctedModule : undefined,
        appliedCorrections,
        remainingErrors,
        correctionConfidence,
        processingTime
      };

      logger.info('Completed automatic error correction', {
        success,
        appliedCorrections: appliedCorrections.length,
        successfulCorrections: successfulCorrections.length,
        remainingErrors: remainingErrors.length,
        correctionConfidence,
        processingTime,
        requestId
      });

      logToFrontend('success', 'processing', '✅ Error correction completed', {
        appliedCorrections: successfulCorrections.length,
        remainingErrors: remainingErrors.length,
        correctionConfidence: Math.round(correctionConfidence)
      }, requestId);

      return result;

    } catch (error) {
      logger.error('Error correction process failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      logToFrontend('error', 'processing', '❌ Error correction failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      }, requestId);

      throw error;
    }
  }

  /**
   * Correction Functions
   */

  private async correctFieldIds(module: GeneratedModule, error: ValidationError): Promise<GeneratedModule> {
    const correctedModule = { ...module };
    
    // Find and fix invalid field IDs
    correctedModule.fields = correctedModule.fields.map(field => {
      if (field.id && !/^[a-z][a-z0-9_]*$/.test(field.id)) {
        const correctedId = field.id
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/^[^a-z]/, 'field_')
          .replace(/_+/g, '_')
          .replace(/_$/, '');
        
        return { ...field, id: correctedId };
      }
      return field;
    });

    return correctedModule;
  }

  private async correctDuplicateFieldIds(module: GeneratedModule, error: ValidationError): Promise<GeneratedModule> {
    const correctedModule = { ...module };
    const seenIds = new Set<string>();
    
    correctedModule.fields = correctedModule.fields.map((field, index) => {
      if (field.id && seenIds.has(field.id)) {
        const newId = `${field.id}_${index + 1}`;
        seenIds.add(newId);
        return { ...field, id: newId };
      }
      if (field.id) {
        seenIds.add(field.id);
      }
      return field;
    });

    return correctedModule;
  }

  private async correctReservedFieldNames(module: GeneratedModule, error: ValidationError): Promise<GeneratedModule> {
    const correctedModule = { ...module };
    const reservedNames = [
      'id', 'name', 'label', 'type', 'default', 'required', 'locked', 'children',
      'tab', 'expanded_options', 'help_text', 'inline_help_text', 'display_width'
    ];
    
    correctedModule.fields = correctedModule.fields.map(field => {
      if (field.id && reservedNames.includes(field.id)) {
        return { ...field, id: `custom_${field.id}` };
      }
      return field;
    });

    return correctedModule;
  }

  private async correctMissingFieldProperties(module: GeneratedModule, error: ValidationError): Promise<GeneratedModule> {
    const correctedModule = { ...module };
    
    correctedModule.fields = correctedModule.fields.map(field => {
      const correctedField = { ...field };
      
      // Add missing required properties
      if (!correctedField.id) {
        correctedField.id = `field_${Math.random().toString(36).substr(2, 9)}`;
      }
      if (!correctedField.name) {
        correctedField.name = correctedField.id || 'Unnamed Field';
      }
      if (!correctedField.label) {
        correctedField.label = correctedField.name || 'Field Label';
      }
      if (!correctedField.type) {
        correctedField.type = 'text';
      }
      
      return correctedField;
    });

    return correctedModule;
  }

  private async correctInvalidFieldTypes(module: GeneratedModule, error: ValidationError): Promise<GeneratedModule> {
    const correctedModule = { ...module };
    const validTypes = [
      'text', 'textarea', 'richtext', 'number', 'email', 'url', 'date', 'datetime',
      'boolean', 'choice', 'color', 'image', 'file', 'video', 'blog', 'form',
      'meeting', 'page', 'group', 'repeater'
    ];
    
    correctedModule.fields = correctedModule.fields.map(field => {
      if (field.type && !validTypes.includes(field.type)) {
        // Map common invalid types to valid ones
        const typeMapping: { [key: string]: string } = {
          'string': 'text',
          'int': 'number',
          'integer': 'number',
          'float': 'number',
          'bool': 'boolean',
          'select': 'choice',
          'dropdown': 'choice',
          'wysiwyg': 'richtext',
          'html': 'richtext'
        };
        
        return { ...field, type: typeMapping[field.type] || 'text' };
      }
      return field;
    });

    return correctedModule;
  }

  private async correctMissingContentTypes(module: GeneratedModule, error: ValidationError): Promise<GeneratedModule> {
    const correctedModule = { ...module };
    
    if (!correctedModule.meta.content_types) {
      correctedModule.meta.content_types = ['page', 'blog-post'];
    }

    return correctedModule;
  }

  private async correctInvalidHubL(module: GeneratedModule, error: ValidationError): Promise<GeneratedModule> {
    const correctedModule = { ...module };
    
    // Basic HubL syntax corrections
    let template = correctedModule.template;
    
    // Fix common HubL syntax issues
    template = template
      .replace(/\{\{\s*([^}]+)\s*\}\}/g, '{{ $1 }}') // Ensure proper spacing
      .replace(/\{\%\s*([^%]+)\s*\%\}/g, '{% $1 %}') // Fix control structures
      .replace(/module\.([a-zA-Z_][a-zA-Z0-9_]*)/g, 'module.$1') // Ensure proper field references
      .replace(/\{\{\s*module\.([^}]+)\s*\}\}/g, '{{ module.$1 }}'); // Fix field output
    
    correctedModule.template = template;
    return correctedModule;
  }

  private async correctMissingAltText(module: GeneratedModule, error: ValidationError): Promise<GeneratedModule> {
    const correctedModule = { ...module };
    
    // Add alt attributes to images without them
    let template = correctedModule.template;
    template = template.replace(
      /<img([^>]*?)(?:\s+alt\s*=\s*["'][^"']*["'])?([^>]*?)>/gi,
      (match, before, after) => {
        if (match.includes('alt=')) {
          return match; // Already has alt attribute
        }
        return `<img${before} alt="Image"${after}>`;
      }
    );
    
    correctedModule.template = template;
    return correctedModule;
  }

  private async correctInlineStyles(module: GeneratedModule, error: ValidationError): Promise<GeneratedModule> {
    const correctedModule = { ...module };
    
    // Remove inline styles and suggest CSS classes
    let template = correctedModule.template;
    template = template.replace(/\s+style\s*=\s*["'][^"']*["']/gi, '');
    
    correctedModule.template = template;
    return correctedModule;
  }

  /**
   * Get available correction rules
   */
  getAvailableCorrectionRules(): CorrectionRule[] {
    return Array.from(this.correctionRules.values());
  }

  /**
   * Check if a correction rule exists for an error code
   */
  canCorrectError(errorCode: string): boolean {
    return this.correctionRules.has(errorCode);
  }

  /**
   * Get correction confidence for an error
   */
  getCorrectionConfidence(errorCode: string): number {
    const rule = this.correctionRules.get(errorCode);
    return rule ? rule.confidence : 0;
  }
}

// Export handled by class declaration
