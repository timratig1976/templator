/**
 * Schema Diff Detector Service
 * Detects and analyzes differences between schema versions
 * Provides detailed change analysis and migration guidance
 */

import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { SchemaDefinition, SchemaChange, FieldTypeDefinition } from './SchemaUpdateService';

const logger = createLogger();

export interface DiffAnalysis {
  summary: DiffSummary;
  detailed_changes: DetailedChange[];
  impact_assessment: ImpactAssessment;
  migration_plan: MigrationPlan;
  compatibility_matrix: CompatibilityMatrix;
}

export interface DiffSummary {
  total_changes: number;
  breaking_changes: number;
  non_breaking_changes: number;
  enhancements: number;
  deprecations: number;
  removals: number;
  severity_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface DetailedChange {
  change_id: string;
  change_type: 'added' | 'removed' | 'modified' | 'deprecated';
  category: 'field_type' | 'content_type' | 'validation_rule' | 'requirement' | 'property';
  path: string;
  old_value?: any;
  new_value?: any;
  description: string;
  impact: 'breaking' | 'non-breaking' | 'enhancement';
  affected_modules: string[];
  migration_required: boolean;
  migration_complexity: 'simple' | 'moderate' | 'complex';
  estimated_effort_hours: number;
}

export interface ImpactAssessment {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  affected_components: string[];
  breaking_change_details: BreakingChangeDetail[];
  backward_compatibility: boolean;
  forward_compatibility: boolean;
  recommended_action: 'immediate_update' | 'scheduled_update' | 'gradual_migration' | 'no_action';
}

export interface BreakingChangeDetail {
  component: string;
  change_description: string;
  failure_scenarios: string[];
  mitigation_strategies: string[];
  rollback_plan: string;
}

export interface MigrationPlan {
  migration_id: string;
  phases: MigrationPhase[];
  total_estimated_time: number;
  prerequisites: string[];
  rollback_strategy: string;
  testing_requirements: string[];
  validation_checkpoints: string[];
}

export interface MigrationPhase {
  phase_id: string;
  phase_name: string;
  description: string;
  tasks: MigrationTask[];
  estimated_duration_hours: number;
  dependencies: string[];
  success_criteria: string[];
}

export interface MigrationTask {
  task_id: string;
  task_name: string;
  description: string;
  task_type: 'code_change' | 'data_migration' | 'configuration' | 'testing' | 'validation';
  automated: boolean;
  script_path?: string;
  manual_steps?: string[];
  validation_steps: string[];
}

export interface CompatibilityMatrix {
  schema_versions: string[];
  compatibility_grid: CompatibilityEntry[][];
  upgrade_paths: UpgradePath[];
  downgrade_restrictions: DowngradeRestriction[];
}

export interface CompatibilityEntry {
  from_version: string;
  to_version: string;
  compatible: boolean;
  migration_required: boolean;
  risk_level: 'low' | 'medium' | 'high';
  notes: string;
}

export interface UpgradePath {
  from_version: string;
  to_version: string;
  intermediate_versions: string[];
  total_effort_hours: number;
  recommended: boolean;
}

export interface DowngradeRestriction {
  from_version: string;
  to_version: string;
  restriction_reason: string;
  data_loss_risk: boolean;
  workaround?: string;
}

export class SchemaDiffDetector {
  private static instance: SchemaDiffDetector;

  public static getInstance(): SchemaDiffDetector {
    if (!SchemaDiffDetector.instance) {
      SchemaDiffDetector.instance = new SchemaDiffDetector();
    }
    return SchemaDiffDetector.instance;
  }

  /**
   * Analyze differences between two schema versions
   */
  async analyzeDifferences(oldSchema: SchemaDefinition, newSchema: SchemaDefinition): Promise<DiffAnalysis> {
    const startTime = Date.now();
    
    logger.info('Starting schema diff analysis', {
      oldVersion: oldSchema.version,
      newVersion: newSchema.version
    });

    try {
      // Detect all changes
      const detailedChanges = await this.detectDetailedChanges(oldSchema, newSchema);
      
      // Generate summary
      const summary = this.generateDiffSummary(detailedChanges);
      
      // Assess impact
      const impactAssessment = await this.assessImpact(detailedChanges, oldSchema, newSchema);
      
      // Create migration plan
      const migrationPlan = await this.createMigrationPlan(detailedChanges, impactAssessment);
      
      // Build compatibility matrix
      const compatibilityMatrix = await this.buildCompatibilityMatrix(oldSchema, newSchema);

      const analysisTime = Date.now() - startTime;
      logger.info('Schema diff analysis completed', {
        totalChanges: detailedChanges.length,
        breakingChanges: summary.breaking_changes,
        analysisTimeMs: analysisTime
      });

      return {
        summary,
        detailed_changes: detailedChanges,
        impact_assessment: impactAssessment,
        migration_plan: migrationPlan,
        compatibility_matrix: compatibilityMatrix
      };

    } catch (error) {
      logger.error('Schema diff analysis failed', { error });
      throw createError(
        'Failed to analyze schema differences',
        500,
        'INTERNAL_ERROR',
        (error as Error).message,
        'Check schema format and try again'
      );
    }
  }

  /**
   * Detect detailed changes between schemas
   */
  private async detectDetailedChanges(oldSchema: SchemaDefinition, newSchema: SchemaDefinition): Promise<DetailedChange[]> {
    const changes: DetailedChange[] = [];

    // Compare field types
    changes.push(...await this.compareFieldTypes(oldSchema.fieldTypes, newSchema.fieldTypes));
    
    // Compare content types
    changes.push(...await this.compareContentTypes(oldSchema.contentTypes, newSchema.contentTypes));
    
    // Compare validation rules
    changes.push(...await this.compareValidationRules(oldSchema.validationRules, newSchema.validationRules));
    
    // Compare module requirements
    changes.push(...await this.compareModuleRequirements(oldSchema.moduleRequirements, newSchema.moduleRequirements));

    return changes;
  }

  /**
   * Compare field types between schemas
   */
  private async compareFieldTypes(oldTypes: FieldTypeDefinition[], newTypes: FieldTypeDefinition[]): Promise<DetailedChange[]> {
    const changes: DetailedChange[] = [];
    const oldTypeMap = new Map(oldTypes.map(t => [t.type, t]));
    const newTypeMap = new Map(newTypes.map(t => [t.type, t]));

    // Detect added field types
    for (const [type, definition] of newTypeMap) {
      if (!oldTypeMap.has(type)) {
        changes.push({
          change_id: `field_type_added_${type}`,
          change_type: 'added',
          category: 'field_type',
          path: `fieldTypes.${type}`,
          new_value: definition,
          description: `New field type '${type}' added`,
          impact: 'enhancement',
          affected_modules: [],
          migration_required: false,
          migration_complexity: 'simple',
          estimated_effort_hours: 0.5
        });
      }
    }

    // Detect removed field types
    for (const [type, definition] of oldTypeMap) {
      if (!newTypeMap.has(type)) {
        changes.push({
          change_id: `field_type_removed_${type}`,
          change_type: 'removed',
          category: 'field_type',
          path: `fieldTypes.${type}`,
          old_value: definition,
          description: `Field type '${type}' removed`,
          impact: 'breaking',
          affected_modules: [], // Would be populated by analyzing existing modules
          migration_required: true,
          migration_complexity: 'complex',
          estimated_effort_hours: 4
        });
      }
    }

    // Detect modified field types
    for (const [type, newDefinition] of newTypeMap) {
      const oldDefinition = oldTypeMap.get(type);
      if (oldDefinition) {
        const fieldChanges = this.compareFieldTypeDefinitions(type, oldDefinition, newDefinition);
        changes.push(...fieldChanges);
      }
    }

    return changes;
  }

  /**
   * Compare individual field type definitions
   */
  private compareFieldTypeDefinitions(type: string, oldDef: FieldTypeDefinition, newDef: FieldTypeDefinition): DetailedChange[] {
    const changes: DetailedChange[] = [];

    // Compare required properties
    const oldRequired = new Set(oldDef.required_properties);
    const newRequired = new Set(newDef.required_properties);

    for (const prop of newRequired) {
      if (!oldRequired.has(prop)) {
        changes.push({
          change_id: `field_type_${type}_required_added_${prop}`,
          change_type: 'added',
          category: 'property',
          path: `fieldTypes.${type}.required_properties.${prop}`,
          new_value: prop,
          description: `Required property '${prop}' added to field type '${type}'`,
          impact: 'breaking',
          affected_modules: [],
          migration_required: true,
          migration_complexity: 'moderate',
          estimated_effort_hours: 2
        });
      }
    }

    for (const prop of oldRequired) {
      if (!newRequired.has(prop)) {
        changes.push({
          change_id: `field_type_${type}_required_removed_${prop}`,
          change_type: 'removed',
          category: 'property',
          path: `fieldTypes.${type}.required_properties.${prop}`,
          old_value: prop,
          description: `Required property '${prop}' removed from field type '${type}'`,
          impact: 'non-breaking',
          affected_modules: [],
          migration_required: false,
          migration_complexity: 'simple',
          estimated_effort_hours: 0.5
        });
      }
    }

    // Check for deprecation
    if (!oldDef.deprecated && newDef.deprecated) {
      changes.push({
        change_id: `field_type_${type}_deprecated`,
        change_type: 'deprecated',
        category: 'field_type',
        path: `fieldTypes.${type}.deprecated`,
        old_value: false,
        new_value: true,
        description: `Field type '${type}' marked as deprecated`,
        impact: 'non-breaking',
        affected_modules: [],
        migration_required: true,
        migration_complexity: 'moderate',
        estimated_effort_hours: 3
      });
    }

    return changes;
  }

  /**
   * Compare content types between schemas
   */
  private async compareContentTypes(oldTypes: string[], newTypes: string[]): Promise<DetailedChange[]> {
    const changes: DetailedChange[] = [];
    const oldSet = new Set(oldTypes);
    const newSet = new Set(newTypes);

    for (const type of newSet) {
      if (!oldSet.has(type)) {
        changes.push({
          change_id: `content_type_added_${type}`,
          change_type: 'added',
          category: 'content_type',
          path: `contentTypes.${type}`,
          new_value: type,
          description: `New content type '${type}' added`,
          impact: 'enhancement',
          affected_modules: [],
          migration_required: false,
          migration_complexity: 'simple',
          estimated_effort_hours: 0.5
        });
      }
    }

    for (const type of oldSet) {
      if (!newSet.has(type)) {
        changes.push({
          change_id: `content_type_removed_${type}`,
          change_type: 'removed',
          category: 'content_type',
          path: `contentTypes.${type}`,
          old_value: type,
          description: `Content type '${type}' removed`,
          impact: 'breaking',
          affected_modules: [],
          migration_required: true,
          migration_complexity: 'complex',
          estimated_effort_hours: 6
        });
      }
    }

    return changes;
  }

  /**
   * Compare validation rules between schemas
   */
  private async compareValidationRules(oldRules: any[], newRules: any[]): Promise<DetailedChange[]> {
    const changes: DetailedChange[] = [];
    const oldRuleMap = new Map(oldRules.map(r => [r.rule_id, r]));
    const newRuleMap = new Map(newRules.map(r => [r.rule_id, r]));

    // Added rules
    for (const [ruleId, rule] of newRuleMap) {
      if (!oldRuleMap.has(ruleId)) {
        changes.push({
          change_id: `validation_rule_added_${ruleId}`,
          change_type: 'added',
          category: 'validation_rule',
          path: `validationRules.${ruleId}`,
          new_value: rule,
          description: `New validation rule '${ruleId}' added`,
          impact: rule.severity === 'error' ? 'breaking' : 'non-breaking',
          affected_modules: [],
          migration_required: rule.severity === 'error',
          migration_complexity: 'moderate',
          estimated_effort_hours: rule.severity === 'error' ? 3 : 1
        });
      }
    }

    // Removed rules
    for (const [ruleId, rule] of oldRuleMap) {
      if (!newRuleMap.has(ruleId)) {
        changes.push({
          change_id: `validation_rule_removed_${ruleId}`,
          change_type: 'removed',
          category: 'validation_rule',
          path: `validationRules.${ruleId}`,
          old_value: rule,
          description: `Validation rule '${ruleId}' removed`,
          impact: 'non-breaking',
          affected_modules: [],
          migration_required: false,
          migration_complexity: 'simple',
          estimated_effort_hours: 0.5
        });
      }
    }

    return changes;
  }

  /**
   * Compare module requirements between schemas
   */
  private async compareModuleRequirements(oldReqs: any, newReqs: any): Promise<DetailedChange[]> {
    const changes: DetailedChange[] = [];

    // Compare field limits
    if (oldReqs.max_fields !== newReqs.max_fields) {
      changes.push({
        change_id: 'module_requirements_max_fields_changed',
        change_type: 'modified',
        category: 'requirement',
        path: 'moduleRequirements.max_fields',
        old_value: oldReqs.max_fields,
        new_value: newReqs.max_fields,
        description: `Maximum fields limit changed from ${oldReqs.max_fields} to ${newReqs.max_fields}`,
        impact: newReqs.max_fields < oldReqs.max_fields ? 'breaking' : 'non-breaking',
        affected_modules: [],
        migration_required: newReqs.max_fields < oldReqs.max_fields,
        migration_complexity: 'moderate',
        estimated_effort_hours: newReqs.max_fields < oldReqs.max_fields ? 4 : 1
      });
    }

    return changes;
  }

  /**
   * Generate summary of differences
   */
  private generateDiffSummary(changes: DetailedChange[]): DiffSummary {
    const breakingChanges = changes.filter(c => c.impact === 'breaking').length;
    const nonBreakingChanges = changes.filter(c => c.impact === 'non-breaking').length;
    const enhancements = changes.filter(c => c.impact === 'enhancement').length;
    const deprecations = changes.filter(c => c.change_type === 'deprecated').length;
    const removals = changes.filter(c => c.change_type === 'removed').length;

    let severityLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (breakingChanges > 5) severityLevel = 'critical';
    else if (breakingChanges > 2) severityLevel = 'high';
    else if (breakingChanges > 0) severityLevel = 'medium';

    return {
      total_changes: changes.length,
      breaking_changes: breakingChanges,
      non_breaking_changes: nonBreakingChanges,
      enhancements,
      deprecations,
      removals,
      severity_level: severityLevel
    };
  }

  /**
   * Assess impact of changes
   */
  private async assessImpact(changes: DetailedChange[], oldSchema: SchemaDefinition, newSchema: SchemaDefinition): Promise<ImpactAssessment> {
    const breakingChanges = changes.filter(c => c.impact === 'breaking');
    const overallRisk = this.calculateOverallRisk(breakingChanges);
    
    return {
      overall_risk: overallRisk,
      affected_components: [...new Set(changes.flatMap(c => c.affected_modules))],
      breaking_change_details: breakingChanges.map(c => ({
        component: c.path,
        change_description: c.description,
        failure_scenarios: [`Modules using ${c.path} may fail validation`],
        mitigation_strategies: ['Update affected modules', 'Use compatibility layer'],
        rollback_plan: 'Revert to previous schema version'
      })),
      backward_compatibility: breakingChanges.length === 0,
      forward_compatibility: true, // Assume forward compatibility unless proven otherwise
      recommended_action: this.getRecommendedAction(overallRisk, breakingChanges.length)
    };
  }

  /**
   * Calculate overall risk level
   */
  private calculateOverallRisk(breakingChanges: DetailedChange[]): 'low' | 'medium' | 'high' | 'critical' {
    if (breakingChanges.length === 0) return 'low';
    if (breakingChanges.length <= 2) return 'medium';
    if (breakingChanges.length <= 5) return 'high';
    return 'critical';
  }

  /**
   * Get recommended action based on risk
   */
  private getRecommendedAction(risk: string, breakingChangesCount: number): 'immediate_update' | 'scheduled_update' | 'gradual_migration' | 'no_action' {
    if (risk === 'critical') return 'gradual_migration';
    if (risk === 'high') return 'scheduled_update';
    if (breakingChangesCount > 0) return 'scheduled_update';
    return 'immediate_update';
  }

  /**
   * Create migration plan
   */
  private async createMigrationPlan(changes: DetailedChange[], impact: ImpactAssessment): Promise<MigrationPlan> {
    const migrationTasks = changes
      .filter(c => c.migration_required)
      .map(c => this.createMigrationTask(c));

    const phases: MigrationPhase[] = [
      {
        phase_id: 'preparation',
        phase_name: 'Preparation Phase',
        description: 'Prepare for schema migration',
        tasks: migrationTasks.filter(t => t.task_type === 'configuration'),
        estimated_duration_hours: 2,
        dependencies: [],
        success_criteria: ['Backup completed', 'Migration plan approved']
      },
      {
        phase_id: 'migration',
        phase_name: 'Migration Phase',
        description: 'Execute schema migration',
        tasks: migrationTasks.filter(t => t.task_type === 'code_change' || t.task_type === 'data_migration'),
        estimated_duration_hours: migrationTasks.reduce((sum, t) => sum + (changes.find(c => c.change_id === t.task_id)?.estimated_effort_hours || 0), 0),
        dependencies: ['preparation'],
        success_criteria: ['All modules updated', 'Validation passes']
      },
      {
        phase_id: 'validation',
        phase_name: 'Validation Phase',
        description: 'Validate migration results',
        tasks: migrationTasks.filter(t => t.task_type === 'testing' || t.task_type === 'validation'),
        estimated_duration_hours: 4,
        dependencies: ['migration'],
        success_criteria: ['All tests pass', 'Performance acceptable']
      }
    ];

    return {
      migration_id: `migration_${Date.now()}`,
      phases,
      total_estimated_time: phases.reduce((sum, p) => sum + p.estimated_duration_hours, 0),
      prerequisites: ['Schema backup', 'Module inventory', 'Testing environment'],
      rollback_strategy: 'Restore from backup and revert schema version',
      testing_requirements: ['Unit tests', 'Integration tests', 'Performance tests'],
      validation_checkpoints: ['Schema validation', 'Module validation', 'End-to-end testing']
    };
  }

  /**
   * Create migration task for a change
   */
  private createMigrationTask(change: DetailedChange): MigrationTask {
    return {
      task_id: change.change_id,
      task_name: `Migrate ${change.category}: ${change.path}`,
      description: change.description,
      task_type: this.getTaskType(change),
      automated: change.migration_complexity === 'simple',
      manual_steps: change.migration_complexity !== 'simple' ? [
        'Review affected modules',
        'Update module definitions',
        'Test changes'
      ] : undefined,
      validation_steps: [
        'Validate module structure',
        'Run validation tests',
        'Check for errors'
      ]
    };
  }

  /**
   * Get task type for a change
   */
  private getTaskType(change: DetailedChange): 'code_change' | 'data_migration' | 'configuration' | 'testing' | 'validation' {
    if (change.category === 'field_type' || change.category === 'validation_rule') {
      return 'code_change';
    }
    if (change.category === 'requirement') {
      return 'configuration';
    }
    return 'validation';
  }

  /**
   * Build compatibility matrix
   */
  private async buildCompatibilityMatrix(oldSchema: SchemaDefinition, newSchema: SchemaDefinition): Promise<CompatibilityMatrix> {
    // This would typically involve more complex logic to build a full compatibility matrix
    // For now, we'll create a simple matrix for the two versions
    
    const entry: CompatibilityEntry = {
      from_version: oldSchema.version,
      to_version: newSchema.version,
      compatible: true, // Would be determined by analysis
      migration_required: true,
      risk_level: 'medium',
      notes: 'Standard schema upgrade'
    };

    return {
      schema_versions: [oldSchema.version, newSchema.version],
      compatibility_grid: [[entry]],
      upgrade_paths: [{
        from_version: oldSchema.version,
        to_version: newSchema.version,
        intermediate_versions: [],
        total_effort_hours: 8,
        recommended: true
      }],
      downgrade_restrictions: [{
        from_version: newSchema.version,
        to_version: oldSchema.version,
        restriction_reason: 'New features not supported in older version',
        data_loss_risk: false,
        workaround: 'Remove new field types before downgrade'
      }]
    };
  }
}

export const schemaDiffDetector = SchemaDiffDetector.getInstance();
export default schemaDiffDetector;
