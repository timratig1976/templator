/**
 * Package Validation Service
 * Validates HubSpot modules before packaging and deployment
 */

import { logger } from '../utils/logger';
import { ModuleFiles } from './ModulePackagingService';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: 'structure' | 'content' | 'performance' | 'security' | 'hubspot';
}

export interface ValidationIssue {
  rule_id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file_path?: string;
  line_number?: number;
  column_number?: number;
  suggestion?: string;
  auto_fixable: boolean;
  context?: any;
}

export interface ValidationReport {
  is_valid: boolean;
  total_issues: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  performance_score: number;
  security_score: number;
  hubspot_compliance_score: number;
  validation_time_ms: number;
  summary: {
    critical_issues: number;
    fixable_issues: number;
    performance_issues: number;
    security_issues: number;
  };
}

export interface ValidationOptions {
  level: 'basic' | 'strict' | 'comprehensive';
  include_performance: boolean;
  include_security: boolean;
  include_accessibility: boolean;
  auto_fix_enabled: boolean;
  custom_rules?: string[];
}

class PackageValidationService {
  private static instance: PackageValidationService;
  private validationRules: ValidationRule[];

  constructor() {
    this.validationRules = this.initializeValidationRules();
  }

  static getInstance(): PackageValidationService {
    if (!PackageValidationService.instance) {
      PackageValidationService.instance = new PackageValidationService();
    }
    return PackageValidationService.instance;
  }

  /**
   * Validate module files before packaging
   */
  async validateModule(
    moduleFiles: ModuleFiles,
    options: ValidationOptions = {
      level: 'strict',
      include_performance: true,
      include_security: true,
      include_accessibility: true,
      auto_fix_enabled: false
    }
  ): Promise<ValidationReport> {
    const startTime = Date.now();
    logger.info('Starting module validation', { options });

    const issues: ValidationIssue[] = [];

    try {
      // Validate required files
      issues.push(...await this.validateRequiredFiles(moduleFiles));

      // Validate meta.json
      if (moduleFiles['meta.json']) {
        issues.push(...await this.validateMetaJson(moduleFiles['meta.json']));
      }

      // Validate fields.json
      if (moduleFiles['fields.json']) {
        issues.push(...await this.validateFieldsJson(moduleFiles['fields.json']));
      }

      // Validate HTML structure
      if (moduleFiles['module.html']) {
        issues.push(...await this.validateHtmlStructure(moduleFiles['module.html']));
      }

      // Validate CSS
      if (moduleFiles['module.css']) {
        issues.push(...await this.validateCss(moduleFiles['module.css'], options));
      }

      // Validate JavaScript
      if (moduleFiles['module.js']) {
        issues.push(...await this.validateJavaScript(moduleFiles['module.js'], options));
      }

      // Performance validation
      if (options.include_performance) {
        issues.push(...await this.validatePerformance(moduleFiles));
      }

      // Security validation
      if (options.include_security) {
        issues.push(...await this.validateSecurity(moduleFiles));
      }

      // Accessibility validation
      if (options.include_accessibility) {
        issues.push(...await this.validateAccessibility(moduleFiles));
      }

      // HubSpot specific validation
      issues.push(...await this.validateHubSpotCompliance(moduleFiles));

      const validationTime = Date.now() - startTime;
      const report = this.generateValidationReport(issues, validationTime);

      logger.info('Module validation completed', {
        total_issues: report.total_issues,
        errors: report.errors.length,
        warnings: report.warnings.length,
        validation_time_ms: validationTime
      });

      return report;

    } catch (error) {
      logger.error('Validation failed', { error });
      throw new Error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate required files are present
   */
  private async validateRequiredFiles(moduleFiles: ModuleFiles): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const requiredFiles = ['module.html', 'fields.json', 'meta.json'];

    for (const file of requiredFiles) {
      if (!moduleFiles[file as keyof ModuleFiles]) {
        issues.push({
          rule_id: 'required-files',
          severity: 'error',
          message: `Required file '${file}' is missing`,
          file_path: file,
          suggestion: `Add the ${file} file to your module`,
          auto_fixable: false
        });
      }
    }

    return issues;
  }

  /**
   * Validate meta.json structure and content
   */
  private async validateMetaJson(metaJsonContent: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      const meta = JSON.parse(metaJsonContent);

      // Required fields
      const requiredFields = ['label', 'css_assets', 'js_assets', 'other_assets', 'content_types'];
      for (const field of requiredFields) {
        if (!meta[field]) {
          issues.push({
            rule_id: 'meta-required-fields',
            severity: 'error',
            message: `Required field '${field}' is missing in meta.json`,
            file_path: 'meta.json',
            suggestion: `Add the ${field} field to meta.json`,
            auto_fixable: true,
            context: { field, meta }
          });
        }
      }

      // Validate content_types (replaces deprecated host_template_types)
      if (meta.host_template_types) {
        issues.push({
          rule_id: 'meta-deprecated-field',
          severity: 'warning',
          message: 'host_template_types is deprecated, use content_types instead',
          file_path: 'meta.json',
          suggestion: 'Replace host_template_types with content_types',
          auto_fixable: true,
          context: { deprecated_field: 'host_template_types' }
        });
      }

      // Validate content_types values
      if (meta.content_types && Array.isArray(meta.content_types)) {
        const validContentTypes = ['page', 'email', 'blog', 'system'];
        const invalidTypes = meta.content_types.filter((type: string) => !validContentTypes.includes(type));
        
        if (invalidTypes.length > 0) {
          issues.push({
            rule_id: 'meta-invalid-content-types',
            severity: 'error',
            message: `Invalid content_types: ${invalidTypes.join(', ')}`,
            file_path: 'meta.json',
            suggestion: `Use valid content types: ${validContentTypes.join(', ')}`,
            auto_fixable: false,
            context: { invalid_types: invalidTypes, valid_types: validContentTypes }
          });
        }
      }

      // Validate label length
      if (meta.label && meta.label.length > 100) {
        issues.push({
          rule_id: 'meta-label-length',
          severity: 'warning',
          message: 'Module label should be 100 characters or less',
          file_path: 'meta.json',
          suggestion: 'Shorten the module label',
          auto_fixable: false,
          context: { current_length: meta.label.length }
        });
      }

    } catch (error) {
      issues.push({
        rule_id: 'meta-json-syntax',
        severity: 'error',
        message: 'Invalid JSON syntax in meta.json',
        file_path: 'meta.json',
        suggestion: 'Fix JSON syntax errors',
        auto_fixable: false,
        context: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }

    return issues;
  }

  /**
   * Validate fields.json structure and field definitions
   */
  private async validateFieldsJson(fieldsJsonContent: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      const fields = JSON.parse(fieldsJsonContent);

      if (!Array.isArray(fields)) {
        issues.push({
          rule_id: 'fields-array-structure',
          severity: 'error',
          message: 'fields.json must contain an array of field definitions',
          file_path: 'fields.json',
          suggestion: 'Ensure fields.json contains an array',
          auto_fixable: false
        });
        return issues;
      }

      // Validate each field
      fields.forEach((field: any, index: number) => {
        const fieldIssues = this.validateField(field, index);
        issues.push(...fieldIssues);
      });

      // Check for duplicate field names
      const fieldNames = fields.map((field: any) => field.name).filter(Boolean);
      const duplicates = fieldNames.filter((name: string, index: number) => fieldNames.indexOf(name) !== index);
      
      if (duplicates.length > 0) {
        issues.push({
          rule_id: 'fields-duplicate-names',
          severity: 'error',
          message: `Duplicate field names found: ${duplicates.join(', ')}`,
          file_path: 'fields.json',
          suggestion: 'Ensure all field names are unique',
          auto_fixable: false,
          context: { duplicates }
        });
      }

    } catch (error) {
      issues.push({
        rule_id: 'fields-json-syntax',
        severity: 'error',
        message: 'Invalid JSON syntax in fields.json',
        file_path: 'fields.json',
        suggestion: 'Fix JSON syntax errors',
        auto_fixable: false,
        context: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }

    return issues;
  }

  /**
   * Validate individual field definition
   */
  private validateField(field: any, index: number): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Required field properties
    const requiredProps = ['name', 'label', 'type'];
    for (const prop of requiredProps) {
      if (!field[prop]) {
        issues.push({
          rule_id: 'field-required-property',
          severity: 'error',
          message: `Field at index ${index} is missing required property '${prop}'`,
          file_path: 'fields.json',
          line_number: index + 1,
          suggestion: `Add the ${prop} property to the field`,
          auto_fixable: false,
          context: { field_index: index, missing_property: prop }
        });
      }
    }

    // Validate field type
    const validFieldTypes = [
      'text', 'textarea', 'richtext', 'number', 'boolean', 'choice', 'multichoice',
      'email', 'url', 'file', 'image', 'video', 'date', 'datetime', 'color',
      'font', 'icon', 'alignment', 'backgroundimage', 'border', 'spacing',
      'group', 'repeater'
    ];

    if (field.type && !validFieldTypes.includes(field.type)) {
      issues.push({
        rule_id: 'field-invalid-type',
        severity: 'error',
        message: `Invalid field type '${field.type}' at index ${index}`,
        file_path: 'fields.json',
        line_number: index + 1,
        suggestion: `Use a valid field type: ${validFieldTypes.join(', ')}`,
        auto_fixable: false,
        context: { field_index: index, invalid_type: field.type, valid_types: validFieldTypes }
      });
    }

    // Validate field name format
    if (field.name && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.name)) {
      issues.push({
        rule_id: 'field-name-format',
        severity: 'error',
        message: `Invalid field name format '${field.name}' at index ${index}`,
        file_path: 'fields.json',
        line_number: index + 1,
        suggestion: 'Field names must start with a letter and contain only letters, numbers, and underscores',
        auto_fixable: false,
        context: { field_index: index, field_name: field.name }
      });
    }

    return issues;
  }

  /**
   * Validate HTML structure and HubSpot template syntax
   */
  private async validateHtmlStructure(htmlContent: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for HubL template tags
    const hublTagPattern = /\{\{.*?\}\}/g;
    const hublTags = htmlContent.match(hublTagPattern) || [];

    // Validate HubL syntax
    hublTags.forEach((tag, index) => {
      if (!tag.includes('module.')) {
        issues.push({
          rule_id: 'html-hubl-syntax',
          severity: 'warning',
          message: `HubL tag '${tag}' should reference module fields`,
          file_path: 'module.html',
          suggestion: 'Use module.field_name syntax for field references',
          auto_fixable: false,
          context: { tag, index }
        });
      }
    });

    // Check for basic HTML structure
    if (!htmlContent.includes('<div') && !htmlContent.includes('<section') && !htmlContent.includes('<article')) {
      issues.push({
        rule_id: 'html-structure',
        severity: 'warning',
        message: 'HTML should contain structural elements (div, section, article)',
        file_path: 'module.html',
        suggestion: 'Add appropriate HTML structural elements',
        auto_fixable: false
      });
    }

    return issues;
  }

  /**
   * Validate CSS for performance and best practices
   */
  private async validateCss(cssContent: string, options: ValidationOptions): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (options.include_performance) {
      // Check for inefficient selectors
      const inefficientSelectors = cssContent.match(/\*\s*\{|\[.*\*.*\]|\..*\s+\*\s+/g);
      if (inefficientSelectors) {
        issues.push({
          rule_id: 'css-inefficient-selectors',
          severity: 'warning',
          message: 'CSS contains inefficient selectors that may impact performance',
          file_path: 'module.css',
          suggestion: 'Use more specific selectors instead of universal selectors',
          auto_fixable: false,
          context: { selectors: inefficientSelectors }
        });
      }

      // Check CSS size
      if (cssContent.length > 50000) {
        issues.push({
          rule_id: 'css-file-size',
          severity: 'warning',
          message: 'CSS file is large and may impact page load performance',
          file_path: 'module.css',
          suggestion: 'Consider splitting CSS or removing unused styles',
          auto_fixable: false,
          context: { size_bytes: cssContent.length }
        });
      }
    }

    return issues;
  }

  /**
   * Validate JavaScript for security and performance
   */
  private async validateJavaScript(jsContent: string, options: ValidationOptions): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (options.include_security) {
      // Check for potentially dangerous functions
      const dangerousFunctions = ['eval', 'innerHTML', 'document.write'];
      dangerousFunctions.forEach(func => {
        if (jsContent.includes(func)) {
          issues.push({
            rule_id: 'js-security-risk',
            severity: 'warning',
            message: `Use of '${func}' may pose security risks`,
            file_path: 'module.js',
            suggestion: `Consider safer alternatives to ${func}`,
            auto_fixable: false,
            context: { dangerous_function: func }
          });
        }
      });
    }

    if (options.include_performance) {
      // Check for console.log statements
      if (jsContent.includes('console.log')) {
        issues.push({
          rule_id: 'js-console-statements',
          severity: 'info',
          message: 'JavaScript contains console.log statements',
          file_path: 'module.js',
          suggestion: 'Remove console.log statements before production deployment',
          auto_fixable: true,
          context: { type: 'console_log' }
        });
      }
    }

    return issues;
  }

  /**
   * Validate performance aspects
   */
  private async validatePerformance(moduleFiles: ModuleFiles): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Calculate total module size
    const totalSize = Object.values(moduleFiles).reduce((size, content) => size + content.length, 0);
    
    if (totalSize > 100000) { // 100KB
      issues.push({
        rule_id: 'performance-module-size',
        severity: 'warning',
        message: 'Module size is large and may impact page load performance',
        suggestion: 'Consider optimizing assets and removing unnecessary code',
        auto_fixable: false,
        context: { total_size_bytes: totalSize }
      });
    }

    return issues;
  }

  /**
   * Validate security aspects
   */
  private async validateSecurity(moduleFiles: ModuleFiles): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for external script sources
    const htmlContent = moduleFiles['module.html'] || '';
    const externalScripts = htmlContent.match(/<script[^>]*src=["']https?:\/\/[^"']*["'][^>]*>/g);
    
    if (externalScripts) {
      issues.push({
        rule_id: 'security-external-scripts',
        severity: 'warning',
        message: 'Module contains external script references',
        file_path: 'module.html',
        suggestion: 'Ensure external scripts are from trusted sources',
        auto_fixable: false,
        context: { external_scripts: externalScripts }
      });
    }

    return issues;
  }

  /**
   * Validate accessibility
   */
  private async validateAccessibility(moduleFiles: ModuleFiles): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    const htmlContent = moduleFiles['module.html'] || '';

    // Check for images without alt attributes
    const imagesWithoutAlt = htmlContent.match(/<img(?![^>]*alt=)[^>]*>/g);
    if (imagesWithoutAlt) {
      issues.push({
        rule_id: 'accessibility-img-alt',
        severity: 'warning',
        message: 'Images should have alt attributes for accessibility',
        file_path: 'module.html',
        suggestion: 'Add alt attributes to all img elements',
        auto_fixable: false,
        context: { images_count: imagesWithoutAlt.length }
      });
    }

    return issues;
  }

  /**
   * Validate HubSpot specific compliance
   */
  private async validateHubSpotCompliance(moduleFiles: ModuleFiles): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for HubSpot required module structure
    const htmlContent = moduleFiles['module.html'] || '';
    
    // Ensure module uses HubL for dynamic content
    if (!htmlContent.includes('{{') && !htmlContent.includes('{%')) {
      issues.push({
        rule_id: 'hubspot-hubl-usage',
        severity: 'info',
        message: 'Module does not appear to use HubL for dynamic content',
        file_path: 'module.html',
        suggestion: 'Consider using HubL to make content editable in HubSpot',
        auto_fixable: false
      });
    }

    return issues;
  }

  /**
   * Generate validation report from issues
   */
  private generateValidationReport(issues: ValidationIssue[], validationTime: number): ValidationReport {
    const errors = issues.filter(issue => issue.severity === 'error');
    const warnings = issues.filter(issue => issue.severity === 'warning');
    const info = issues.filter(issue => issue.severity === 'info');

    const performanceIssues = issues.filter(issue => issue.rule_id.includes('performance'));
    const securityIssues = issues.filter(issue => issue.rule_id.includes('security'));
    const fixableIssues = issues.filter(issue => issue.auto_fixable);

    // Calculate scores (0-100)
    const performanceScore = Math.max(0, 100 - (performanceIssues.length * 10));
    const securityScore = Math.max(0, 100 - (securityIssues.length * 15));
    const hubspotComplianceScore = Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5));

    return {
      is_valid: errors.length === 0,
      total_issues: issues.length,
      errors,
      warnings,
      info,
      performance_score: performanceScore,
      security_score: securityScore,
      hubspot_compliance_score: hubspotComplianceScore,
      validation_time_ms: validationTime,
      summary: {
        critical_issues: errors.length,
        fixable_issues: fixableIssues.length,
        performance_issues: performanceIssues.length,
        security_issues: securityIssues.length
      }
    };
  }

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): ValidationRule[] {
    return [
      {
        id: 'required-files',
        name: 'Required Files',
        description: 'Ensures all required module files are present',
        severity: 'error',
        category: 'structure'
      },
      {
        id: 'meta-required-fields',
        name: 'Meta Required Fields',
        description: 'Validates required fields in meta.json',
        severity: 'error',
        category: 'hubspot'
      },
      {
        id: 'field-required-property',
        name: 'Field Required Properties',
        description: 'Validates required properties in field definitions',
        severity: 'error',
        category: 'hubspot'
      },
      {
        id: 'performance-module-size',
        name: 'Module Size',
        description: 'Checks module size for performance impact',
        severity: 'warning',
        category: 'performance'
      },
      {
        id: 'security-external-scripts',
        name: 'External Scripts',
        description: 'Identifies external script dependencies',
        severity: 'warning',
        category: 'security'
      }
      // Add more rules as needed
    ];
  }

  /**
   * Get available validation rules
   */
  getValidationRules(): ValidationRule[] {
    return this.validationRules;
  }

  /**
   * Auto-fix validation issues where possible
   */
  async autoFixIssues(moduleFiles: ModuleFiles, issues: ValidationIssue[]): Promise<{
    fixed_files: ModuleFiles;
    fixed_issues: ValidationIssue[];
    unfixed_issues: ValidationIssue[];
  }> {
    const fixedFiles = { ...moduleFiles };
    const fixedIssues: ValidationIssue[] = [];
    const unfixedIssues: ValidationIssue[] = [];

    for (const issue of issues) {
      if (issue.auto_fixable) {
        try {
          // Apply auto-fixes based on rule type
          switch (issue.rule_id) {
            case 'js-console-statements':
              if (issue.file_path === 'module.js' && fixedFiles['module.js']) {
                fixedFiles['module.js'] = fixedFiles['module.js'].replace(/console\.log\([^)]*\);?\s*/g, '');
                fixedIssues.push(issue);
              }
              break;
            case 'meta-deprecated-field':
              if (issue.file_path === 'meta.json' && fixedFiles['meta.json']) {
                const meta = JSON.parse(fixedFiles['meta.json']);
                if (meta.host_template_types) {
                  meta.content_types = meta.host_template_types;
                  delete meta.host_template_types;
                  fixedFiles['meta.json'] = JSON.stringify(meta, null, 2);
                  fixedIssues.push(issue);
                }
              }
              break;
            default:
              unfixedIssues.push(issue);
          }
        } catch (error) {
          logger.warn('Failed to auto-fix issue', { issue, error });
          unfixedIssues.push(issue);
        }
      } else {
        unfixedIssues.push(issue);
      }
    }

    return {
      fixed_files: fixedFiles,
      fixed_issues: fixedIssues,
      unfixed_issues: unfixedIssues
    };
  }
}

export const packageValidationService = PackageValidationService.getInstance();
export default packageValidationService;
