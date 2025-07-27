/**
 * Schema Update Service
 * Automatically fetches and updates schemas from HubSpot API
 * Keeps local schema definitions in sync with HubSpot's latest requirements
 */

import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { HubSpotAPIService } from './HubSpotAPIService';

const logger = createLogger();

export interface SchemaDefinition {
  version: string;
  lastUpdated: Date;
  fieldTypes: FieldTypeDefinition[];
  contentTypes: string[];
  moduleRequirements: ModuleRequirements;
  validationRules: ValidationRuleDefinition[];
  deprecatedFeatures: DeprecatedFeature[];
}

export interface FieldTypeDefinition {
  type: string;
  label: string;
  description: string;
  required_properties: string[];
  optional_properties: string[];
  validation_rules: string[];
  examples: any[];
  deprecated?: boolean;
  deprecation_date?: Date;
  replacement?: string;
}

export interface ModuleRequirements {
  min_fields: number;
  max_fields: number;
  required_files: string[];
  optional_files: string[];
  naming_conventions: NamingConvention[];
  size_limits: SizeLimits;
}

export interface NamingConvention {
  target: 'field_id' | 'module_name' | 'file_name';
  pattern: string;
  description: string;
}

export interface SizeLimits {
  max_template_size_kb: number;
  max_css_size_kb: number;
  max_js_size_kb: number;
  max_total_size_kb: number;
}

export interface ValidationRuleDefinition {
  rule_id: string;
  rule_type: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  validation_logic: string;
  error_message: string;
  fix_suggestion: string;
}

export interface DeprecatedFeature {
  feature_name: string;
  deprecated_since: Date;
  removal_date?: Date;
  replacement?: string;
  migration_guide?: string;
}

export interface SchemaUpdateResult {
  success: boolean;
  updated: boolean;
  previous_version: string;
  current_version: string;
  changes_detected: SchemaChange[];
  errors: string[];
  warnings: string[];
}

export interface SchemaChange {
  change_type: 'added' | 'removed' | 'modified' | 'deprecated';
  category: 'field_type' | 'content_type' | 'validation_rule' | 'requirement';
  item_name: string;
  description: string;
  impact: 'breaking' | 'non-breaking' | 'enhancement';
  migration_required: boolean;
}

export class SchemaUpdateService {
  private static instance: SchemaUpdateService;
  private hubspotAPI: HubSpotAPIService;
  private currentSchema: SchemaDefinition | null = null;
  private updateInProgress = false;

  private constructor() {
    this.hubspotAPI = HubSpotAPIService.getInstance();
  }

  public static getInstance(): SchemaUpdateService {
    if (!SchemaUpdateService.instance) {
      SchemaUpdateService.instance = new SchemaUpdateService();
    }
    return SchemaUpdateService.instance;
  }

  /**
   * Check for and apply schema updates from HubSpot API
   */
  async updateSchema(): Promise<SchemaUpdateResult> {
    if (this.updateInProgress) {
      throw createError(
        'Schema update already in progress',
        409,
        'INTERNAL_ERROR',
        'Another schema update is currently running',
        'Wait for the current update to complete before starting a new one'
      );
    }

    this.updateInProgress = true;
    const startTime = Date.now();

    try {
      logger.info('Starting schema update from HubSpot API');

      // Get current schema version
      const currentVersion = this.currentSchema?.version || '0.0.0';
      
      // Fetch latest schema from HubSpot API
      const latestSchema = await this.fetchLatestSchema();
      
      // Compare versions
      if (this.currentSchema && latestSchema.version === currentVersion) {
        logger.info('Schema is already up to date', { version: currentVersion });
        return {
          success: true,
          updated: false,
          previous_version: currentVersion,
          current_version: latestSchema.version,
          changes_detected: [],
          errors: [],
          warnings: []
        };
      }

      // Detect changes
      const changes = this.currentSchema ? 
        await this.detectSchemaChanges(this.currentSchema, latestSchema) : [];

      // Validate new schema
      const validationResult = await this.validateSchema(latestSchema);
      if (!validationResult.valid) {
        throw createError(
          'Invalid schema received from HubSpot API',
          500,
          'INTERNAL_ERROR',
          validationResult.errors.join(', '),
          'Contact HubSpot support or retry later'
        );
      }

      // Apply schema update
      const previousVersion = this.currentSchema?.version || '0.0.0';
      this.currentSchema = latestSchema;
      
      // Save to persistent storage
      await this.saveSchema(latestSchema);

      // Log update completion
      const updateTime = Date.now() - startTime;
      logger.info('Schema update completed successfully', {
        previousVersion,
        newVersion: latestSchema.version,
        changesCount: changes.length,
        updateTimeMs: updateTime
      });

      return {
        success: true,
        updated: true,
        previous_version: previousVersion,
        current_version: latestSchema.version,
        changes_detected: changes,
        errors: [],
        warnings: this.generateUpdateWarnings(changes)
      };

    } catch (error) {
      logger.error('Schema update failed', { error });
      return {
        success: false,
        updated: false,
        previous_version: this.currentSchema?.version || '0.0.0',
        current_version: this.currentSchema?.version || '0.0.0',
        changes_detected: [],
        errors: [(error as Error).message],
        warnings: []
      };
    } finally {
      this.updateInProgress = false;
    }
  }

  /**
   * Get current schema definition
   */
  getCurrentSchema(): SchemaDefinition | null {
    return this.currentSchema;
  }

  /**
   * Check if schema update is available
   */
  async checkForUpdates(): Promise<{ updateAvailable: boolean; latestVersion: string; currentVersion: string }> {
    try {
      const latestSchema = await this.fetchLatestSchema();
      const currentVersion = this.currentSchema?.version || '0.0.0';
      
      return {
        updateAvailable: latestSchema.version !== currentVersion,
        latestVersion: latestSchema.version,
        currentVersion
      };
    } catch (error) {
      logger.error('Failed to check for schema updates', { error });
      throw error;
    }
  }

  /**
   * Schedule automatic schema updates
   */
  startAutoUpdate(intervalHours: number = 24): void {
    logger.info('Starting automatic schema updates', { intervalHours });
    
    setInterval(async () => {
      try {
        logger.info('Running scheduled schema update');
        const result = await this.updateSchema();
        
        if (result.updated) {
          logger.info('Automatic schema update applied', {
            version: result.current_version,
            changes: result.changes_detected.length
          });
        }
      } catch (error) {
        logger.error('Automatic schema update failed', { error });
      }
    }, intervalHours * 60 * 60 * 1000);
  }

  /**
   * Fetch latest schema from HubSpot API
   */
  private async fetchLatestSchema(): Promise<SchemaDefinition> {
    try {
      // This would make actual API calls to HubSpot to get schema information
      // For now, we'll simulate the response structure
      
      logger.info('Fetching latest schema from HubSpot API');
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return mock schema - in real implementation, this would fetch from HubSpot
      return {
        version: '2024.1.0',
        lastUpdated: new Date(),
        fieldTypes: [
          {
            type: 'text',
            label: 'Text Field',
            description: 'Single line text input',
            required_properties: ['name', 'label'],
            optional_properties: ['default', 'placeholder', 'help_text'],
            validation_rules: ['max_length_255'],
            examples: [{ name: 'headline', label: 'Headline' }]
          },
          {
            type: 'richtext',
            label: 'Rich Text Field',
            description: 'Multi-line rich text editor',
            required_properties: ['name', 'label'],
            optional_properties: ['default', 'help_text'],
            validation_rules: ['no_script_tags'],
            examples: [{ name: 'body_content', label: 'Body Content' }]
          }
        ],
        contentTypes: ['LANDING_PAGE', 'SITE_PAGE', 'BLOG_POST', 'EMAIL'],
        moduleRequirements: {
          min_fields: 1,
          max_fields: 50,
          required_files: ['module.html', 'fields.json', 'meta.json'],
          optional_files: ['module.css', 'module.js'],
          naming_conventions: [
            {
              target: 'field_id',
              pattern: '^[a-z][a-z0-9_]*$',
              description: 'Field IDs must start with lowercase letter and contain only lowercase letters, numbers, and underscores'
            }
          ],
          size_limits: {
            max_template_size_kb: 100,
            max_css_size_kb: 50,
            max_js_size_kb: 50,
            max_total_size_kb: 200
          }
        },
        validationRules: [
          {
            rule_id: 'field_name_unique',
            rule_type: 'uniqueness',
            severity: 'error',
            description: 'Field names must be unique within a module',
            validation_logic: 'check_field_name_uniqueness',
            error_message: 'Duplicate field name detected',
            fix_suggestion: 'Use unique field names for each field in the module'
          }
        ],
        deprecatedFeatures: []
      };
    } catch (error) {
      logger.error('Failed to fetch schema from HubSpot API', { error });
      throw createError(
        'Failed to fetch latest schema from HubSpot',
        500,
        'INTERNAL_ERROR',
        (error as Error).message,
        'Check HubSpot API connectivity and credentials'
      );
    }
  }

  /**
   * Detect changes between schema versions
   */
  private async detectSchemaChanges(oldSchema: SchemaDefinition, newSchema: SchemaDefinition): Promise<SchemaChange[]> {
    const changes: SchemaChange[] = [];

    // Compare field types
    const oldFieldTypes = new Map(oldSchema.fieldTypes.map(ft => [ft.type, ft]));
    const newFieldTypes = new Map(newSchema.fieldTypes.map(ft => [ft.type, ft]));

    // Detect added field types
    for (const [type, fieldType] of newFieldTypes) {
      if (!oldFieldTypes.has(type)) {
        changes.push({
          change_type: 'added',
          category: 'field_type',
          item_name: type,
          description: `New field type '${type}' added`,
          impact: 'enhancement',
          migration_required: false
        });
      }
    }

    // Detect removed field types
    for (const [type, fieldType] of oldFieldTypes) {
      if (!newFieldTypes.has(type)) {
        changes.push({
          change_type: 'removed',
          category: 'field_type',
          item_name: type,
          description: `Field type '${type}' removed`,
          impact: 'breaking',
          migration_required: true
        });
      }
    }

    // Compare content types
    const oldContentTypes = new Set(oldSchema.contentTypes);
    const newContentTypes = new Set(newSchema.contentTypes);

    for (const contentType of newContentTypes) {
      if (!oldContentTypes.has(contentType)) {
        changes.push({
          change_type: 'added',
          category: 'content_type',
          item_name: contentType,
          description: `New content type '${contentType}' added`,
          impact: 'enhancement',
          migration_required: false
        });
      }
    }

    for (const contentType of oldContentTypes) {
      if (!newContentTypes.has(contentType)) {
        changes.push({
          change_type: 'removed',
          category: 'content_type',
          item_name: contentType,
          description: `Content type '${contentType}' removed`,
          impact: 'breaking',
          migration_required: true
        });
      }
    }

    return changes;
  }

  /**
   * Validate schema structure and content
   */
  private async validateSchema(schema: SchemaDefinition): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate version format
    if (!schema.version || !/^\d+\.\d+\.\d+$/.test(schema.version)) {
      errors.push('Invalid version format. Expected semantic version (x.y.z)');
    }

    // Validate field types
    if (!schema.fieldTypes || schema.fieldTypes.length === 0) {
      errors.push('Schema must contain at least one field type definition');
    }

    // Validate content types
    if (!schema.contentTypes || schema.contentTypes.length === 0) {
      errors.push('Schema must contain at least one content type');
    }

    // Validate module requirements
    if (!schema.moduleRequirements) {
      errors.push('Schema must contain module requirements');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Save schema to persistent storage
   */
  private async saveSchema(schema: SchemaDefinition): Promise<void> {
    // In a real implementation, this would save to a database or file system
    logger.info('Saving schema to persistent storage', { version: schema.version });
    
    // For now, just keep in memory
    // TODO: Implement actual persistence (database, file system, etc.)
  }

  /**
   * Generate warnings for schema updates
   */
  private generateUpdateWarnings(changes: SchemaChange[]): string[] {
    const warnings: string[] = [];

    const breakingChanges = changes.filter(c => c.impact === 'breaking');
    if (breakingChanges.length > 0) {
      warnings.push(`${breakingChanges.length} breaking changes detected. Review and update existing modules.`);
    }

    const migrationRequired = changes.filter(c => c.migration_required);
    if (migrationRequired.length > 0) {
      warnings.push(`${migrationRequired.length} changes require migration. Check migration guides.`);
    }

    return warnings;
  }
}

export const schemaUpdateService = SchemaUpdateService.getInstance();
export default schemaUpdateService;
