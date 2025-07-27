import { createLogger } from '../utils/logger';
import { ModuleComponentRepository, ModuleComponent, ComponentInterface } from './ModuleComponentRepository';
import { HubSpotValidationService } from './HubSpotValidationService';
import OpenAIService from './openaiService';

const logger = createLogger();

// Types for component assembly and composition
export interface ComponentAssemblyRequest {
  target_components: string[]; // Component IDs to assemble
  assembly_type: 'sequential' | 'nested' | 'parallel' | 'conditional';
  layout_preferences?: LayoutPreferences;
  customization_options?: ComponentCustomization[];
  validation_level: 'basic' | 'strict' | 'comprehensive';
  output_format: 'hubspot_module' | 'html_template' | 'component_library';
}

export interface LayoutPreferences {
  container_type: 'div' | 'section' | 'article' | 'main';
  responsive_breakpoints: ResponsiveBreakpoint[];
  spacing_system: 'bootstrap' | 'tailwind' | 'custom';
  grid_system?: GridSystem;
  accessibility_level: 'basic' | 'aa' | 'aaa';
}

export interface ResponsiveBreakpoint {
  name: string;
  min_width: number;
  max_width?: number;
  columns: number;
  gap: string;
}

export interface GridSystem {
  type: 'flexbox' | 'css-grid' | 'bootstrap-grid';
  columns: number;
  gap: string;
  alignment: 'start' | 'center' | 'end' | 'stretch';
}

export interface ComponentCustomization {
  component_id: string;
  field_overrides: { [fieldName: string]: any };
  style_overrides?: { [cssProperty: string]: string };
  conditional_display?: ConditionalDisplay;
}

export interface ConditionalDisplay {
  condition_type: 'field_value' | 'user_role' | 'device_type' | 'custom';
  condition_expression: string;
  show_when: boolean;
}

export interface ComponentAssemblyResult {
  success: boolean;
  assembly_id: string;
  assembled_module: AssembledModule;
  validation_results: AssemblyValidationResult[];
  performance_metrics: AssemblyPerformanceMetrics;
  recommendations: AssemblyRecommendation[];
}

export interface AssembledModule {
  module_id: string;
  name: string;
  description: string;
  html_template: string;
  css_styles: string;
  javascript_code?: string;
  fields_definition: AssembledField[];
  meta_configuration: ModuleMetaConfig;
  component_mapping: ComponentMapping[];
  dependencies: ModuleDependency[];
}

export interface AssembledField {
  field_name: string;
  field_type: string;
  required: boolean;
  default_value?: any;
  help_text?: string;
  source_component: string;
  field_group?: string;
  display_order: number;
}

export interface ModuleMetaConfig {
  label: string;
  css_assets: string[];
  js_assets: string[];
  other_assets: string[];
  smart_type: 'NOT_SMART' | 'SMART_CONTENT' | 'SMART_RULE';
  host_template_types: string[];
  module_position: string[];
}

export interface ComponentMapping {
  component_id: string;
  position_in_assembly: number;
  html_selector: string;
  field_prefix: string;
  customizations_applied: string[];
}

export interface ModuleDependency {
  dependency_name: string;
  dependency_type: 'css' | 'js' | 'hubspot_api' | 'external_service';
  source_url?: string;
  version: string;
  load_order: number;
}

export interface AssemblyValidationResult {
  validation_type: 'structure' | 'compatibility' | 'performance' | 'accessibility';
  status: 'passed' | 'warning' | 'failed';
  message: string;
  details?: any;
  suggested_fix?: string;
}

export interface AssemblyPerformanceMetrics {
  estimated_load_time_ms: number;
  html_size_bytes: number;
  css_size_bytes: number;
  js_size_bytes: number;
  complexity_score: number;
  accessibility_score: number;
  seo_score: number;
}

export interface AssemblyRecommendation {
  recommendation_type: 'optimization' | 'enhancement' | 'alternative' | 'warning';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  implementation_effort: 'minimal' | 'moderate' | 'significant';
  expected_benefit: string;
}

export interface CompositionPattern {
  pattern_id: string;
  pattern_name: string;
  description: string;
  applicable_scenarios: string[];
  component_requirements: ComponentRequirement[];
  assembly_template: string;
  best_practices: string[];
  performance_impact: 'low' | 'medium' | 'high';
}

export interface ComponentRequirement {
  role: 'header' | 'content' | 'sidebar' | 'footer' | 'navigation' | 'utility';
  required_interfaces: string[];
  optional_interfaces: string[];
  quantity: 'one' | 'multiple' | 'optional';
}

export interface InterfaceCompatibility {
  interface_name: string;
  compatible_components: string[];
  compatibility_score: number;
  potential_conflicts: string[];
  resolution_strategies: string[];
}

export class ComponentAssemblyEngine {
  private static instance: ComponentAssemblyEngine;
  private componentRepository: ModuleComponentRepository;
  private validationService: HubSpotValidationService;
  private openaiService: typeof OpenAIService;
  private compositionPatterns: Map<string, CompositionPattern> = new Map();
  private interfaceCompatibilityCache: Map<string, InterfaceCompatibility> = new Map();

  constructor() {
    this.componentRepository = ModuleComponentRepository.getInstance();
    this.validationService = HubSpotValidationService.getInstance();
    this.openaiService = OpenAIService;
    this.initializeCompositionPatterns();
  }

  public static getInstance(): ComponentAssemblyEngine {
    if (!ComponentAssemblyEngine.instance) {
      ComponentAssemblyEngine.instance = new ComponentAssemblyEngine();
    }
    return ComponentAssemblyEngine.instance;
  }

  /**
   * Assemble multiple components into a cohesive HubSpot module
   */
  async assembleComponents(request: ComponentAssemblyRequest, requestId?: string): Promise<ComponentAssemblyResult> {
    logger.info('Starting component assembly', {
      targetComponents: request.target_components,
      assemblyType: request.assembly_type,
      requestId
    });

    try {
      // Validate assembly request
      const requestValidation = await this.validateAssemblyRequest(request);
      if (!requestValidation.isValid) {
        throw new Error(`Assembly request validation failed: ${requestValidation.errors.join(', ')}`);
      }

      // Load target components
      const components = await this.loadComponents(request.target_components);
      
      // Analyze interface compatibility
      const compatibilityAnalysis = await this.analyzeInterfaceCompatibility(components);
      
      // Generate assembly strategy
      const assemblyStrategy = await this.generateAssemblyStrategy(request, components, compatibilityAnalysis);
      
      // Execute assembly
      const assembledModule = await this.executeAssembly(assemblyStrategy, request);
      
      // Validate assembled module
      const validationResults = await this.validateAssembledModule(assembledModule, request.validation_level);
      
      // Calculate performance metrics
      const performanceMetrics = await this.calculatePerformanceMetrics(assembledModule);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(assembledModule, validationResults, performanceMetrics);

      const assemblyId = this.generateAssemblyId();
      const result: ComponentAssemblyResult = {
        success: true,
        assembly_id: assemblyId,
        assembled_module: assembledModule,
        validation_results: validationResults,
        performance_metrics: performanceMetrics,
        recommendations
      };

      logger.info('Component assembly completed', {
        assemblyId,
        componentCount: components.length,
        validationStatus: validationResults.filter(v => v.status === 'failed').length === 0 ? 'passed' : 'failed',
        requestId
      });

      return result;

    } catch (error) {
      logger.error('Component assembly failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  /**
   * Suggest optimal composition patterns for given components
   */
  async suggestCompositionPatterns(componentIds: string[]): Promise<CompositionPattern[]> {
    const components = await this.loadComponents(componentIds);
    const suggestions: CompositionPattern[] = [];

    for (const pattern of this.compositionPatterns.values()) {
      const compatibility = await this.evaluatePatternCompatibility(pattern, components);
      if (compatibility.score > 0.7) {
        suggestions.push(pattern);
      }
    }

    return suggestions.sort((a, b) => b.performance_impact.localeCompare(a.performance_impact));
  }

  /**
   * Analyze interface compatibility between components
   */
  async analyzeInterfaceCompatibility(components: ModuleComponent[]): Promise<Map<string, InterfaceCompatibility>> {
    const compatibilityMap = new Map<string, InterfaceCompatibility>();

    for (const component of components) {
      for (const componentInterface of component.interfaces) {
        const cacheKey = `${component.component_id}_${componentInterface.interface_name}`;
        
        if (this.interfaceCompatibilityCache.has(cacheKey)) {
          compatibilityMap.set(cacheKey, this.interfaceCompatibilityCache.get(cacheKey)!);
          continue;
        }

        const compatibility = await this.calculateInterfaceCompatibility(componentInterface, components);
        compatibilityMap.set(cacheKey, compatibility);
        this.interfaceCompatibilityCache.set(cacheKey, compatibility);
      }
    }

    return compatibilityMap;
  }

  /**
   * Generate optimized assembly using AI
   */
  async generateOptimizedAssembly(
    components: ModuleComponent[],
    requirements: string,
    constraints?: string[]
  ): Promise<ComponentAssemblyRequest> {
    const prompt = this.buildAssemblyOptimizationPrompt(components, requirements, constraints);
    
    try {
      const response = await this.openaiService.generateHubSpotModule({
        design_description: prompt,
        module_type: 'custom',
        complexity_level: 'advanced',
        include_sample_content: false
      });

      return this.parseAssemblyResponse(response, components);
    } catch (error) {
      logger.error('AI assembly optimization failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      
      // Fallback to rule-based assembly
      return this.generateRuleBasedAssembly(components);
    }
  }

  // Private implementation methods
  private async initializeCompositionPatterns(): Promise<void> {
    const patterns = await this.createBuiltInPatterns();
    for (const pattern of patterns) {
      this.compositionPatterns.set(pattern.pattern_id, pattern);
    }
    logger.info('Composition patterns initialized', { patternCount: patterns.length });
  }

  private async createBuiltInPatterns(): Promise<CompositionPattern[]> {
    return [
      {
        pattern_id: 'hero_content_footer',
        pattern_name: 'Hero-Content-Footer Layout',
        description: 'Classic landing page layout with hero section, main content, and footer',
        applicable_scenarios: ['landing_pages', 'product_pages', 'service_pages'],
        component_requirements: [
          { role: 'header', required_interfaces: ['HeroInterface'], optional_interfaces: [], quantity: 'one' },
          { role: 'content', required_interfaces: ['ContentInterface'], optional_interfaces: ['FormInterface'], quantity: 'multiple' },
          { role: 'footer', required_interfaces: ['FooterInterface'], optional_interfaces: ['ContactInterface'], quantity: 'one' }
        ],
        assembly_template: '<div class="page-container">{{header}}{{content}}{{footer}}</div>',
        best_practices: [
          'Ensure hero section is above the fold',
          'Maintain consistent spacing between sections',
          'Use semantic HTML elements for better SEO'
        ],
        performance_impact: 'low'
      },
      {
        pattern_id: 'sidebar_layout',
        pattern_name: 'Sidebar Content Layout',
        description: 'Two-column layout with main content and sidebar',
        applicable_scenarios: ['blog_pages', 'documentation', 'resource_pages'],
        component_requirements: [
          { role: 'content', required_interfaces: ['ContentInterface'], optional_interfaces: [], quantity: 'one' },
          { role: 'sidebar', required_interfaces: ['SidebarInterface'], optional_interfaces: ['NavigationInterface'], quantity: 'one' }
        ],
        assembly_template: '<div class="layout-container"><main class="main-content">{{content}}</main><aside class="sidebar">{{sidebar}}</aside></div>',
        best_practices: [
          'Ensure responsive behavior on mobile devices',
          'Use appropriate ARIA labels for accessibility',
          'Consider sidebar content hierarchy'
        ],
        performance_impact: 'medium'
      }
    ];
  }

  private async validateAssemblyRequest(request: ComponentAssemblyRequest): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!request.target_components || request.target_components.length === 0) {
      errors.push('At least one target component is required');
    }

    if (!['sequential', 'nested', 'parallel', 'conditional'].includes(request.assembly_type)) {
      errors.push('Invalid assembly type');
    }

    if (!['basic', 'strict', 'comprehensive'].includes(request.validation_level)) {
      errors.push('Invalid validation level');
    }

    // Validate component IDs exist
    for (const componentId of request.target_components) {
      const component = await this.componentRepository.getComponent(componentId, false);
      if (!component) {
        errors.push(`Component not found: ${componentId}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  private async loadComponents(componentIds: string[]): Promise<ModuleComponent[]> {
    const components: ModuleComponent[] = [];
    
    for (const componentId of componentIds) {
      const component = await this.componentRepository.getComponent(componentId, true);
      if (component) {
        components.push(component);
      }
    }

    return components;
  }

  private async generateAssemblyStrategy(
    request: ComponentAssemblyRequest,
    components: ModuleComponent[],
    compatibilityAnalysis: Map<string, InterfaceCompatibility>
  ): Promise<any> {
    // Simplified assembly strategy generation
    return {
      assembly_order: components.map((c, index) => ({ component_id: c.component_id, order: index })),
      layout_strategy: request.assembly_type,
      compatibility_resolutions: Array.from(compatibilityAnalysis.values())
        .filter(c => c.potential_conflicts.length > 0)
        .map(c => ({ interface: c.interface_name, resolution: c.resolution_strategies[0] }))
    };
  }

  private async executeAssembly(assemblyStrategy: any, request: ComponentAssemblyRequest): Promise<AssembledModule> {
    const assemblyId = this.generateAssemblyId();
    const components = await this.loadComponents(request.target_components);
    
    // Combine HTML templates
    const htmlTemplate = this.combineHtmlTemplates(components, request.assembly_type);
    
    // Merge CSS styles
    const cssStyles = this.mergeCssStyles(components);
    
    // Combine JavaScript code
    const javascriptCode = this.combineJavaScriptCode(components);
    
    // Merge field definitions
    const fieldsDefinition = this.mergeFieldDefinitions(components);
    
    // Generate meta configuration
    const metaConfiguration = this.generateMetaConfiguration(components);
    
    // Create component mapping
    const componentMapping = this.createComponentMapping(components);
    
    // Collect dependencies
    const dependencies = this.collectDependencies(components);

    return {
      module_id: assemblyId,
      name: `Assembled Module ${assemblyId}`,
      description: `Module assembled from ${components.length} components`,
      html_template: htmlTemplate,
      css_styles: cssStyles,
      javascript_code: javascriptCode,
      fields_definition: fieldsDefinition,
      meta_configuration: metaConfiguration,
      component_mapping: componentMapping,
      dependencies: dependencies
    };
  }

  private combineHtmlTemplates(components: ModuleComponent[], assemblyType: string): string {
    const templates = components.map(c => c.html_template);
    
    switch (assemblyType) {
      case 'sequential':
        return `<div class="assembled-module">${templates.join('\n')}</div>`;
      case 'nested':
        return templates.reduce((acc, template, index) => 
          index === 0 ? template : acc.replace('</div>', `${template}</div>`), '');
      case 'parallel':
        return `<div class="parallel-container">${templates.map(t => `<div class="parallel-item">${t}</div>`).join('\n')}</div>`;
      default:
        return templates.join('\n');
    }
  }

  private mergeCssStyles(components: ModuleComponent[]): string {
    const styles = components
      .filter(c => c.css_styles)
      .map(c => c.css_styles)
      .join('\n\n');
    
    return `/* Assembled Module Styles */\n.assembled-module { width: 100%; }\n\n${styles}`;
  }

  private combineJavaScriptCode(components: ModuleComponent[]): string {
    const scripts = components
      .filter(c => c.javascript_code)
      .map(c => c.javascript_code)
      .join('\n\n');
    
    return scripts ? `// Assembled Module JavaScript\n${scripts}` : '';
  }

  private mergeFieldDefinitions(components: ModuleComponent[]): AssembledField[] {
    const fields: AssembledField[] = [];
    let displayOrder = 0;

    for (const component of components) {
      for (const field of component.fields_definition) {
        fields.push({
          field_name: `${component.component_id}_${field.field_name}`,
          field_type: field.field_type,
          required: field.required,
          default_value: field.default_value,
          help_text: field.help_text,
          source_component: component.component_id,
          field_group: component.name,
          display_order: displayOrder++
        });
      }
    }

    return fields;
  }

  private generateMetaConfiguration(components: ModuleComponent[]): ModuleMetaConfig {
    return {
      label: 'Assembled Module',
      css_assets: [],
      js_assets: [],
      other_assets: [],
      smart_type: 'NOT_SMART',
      host_template_types: ['page', 'blog_post', 'landing_page'],
      module_position: ['content']
    };
  }

  private createComponentMapping(components: ModuleComponent[]): ComponentMapping[] {
    return components.map((component, index) => ({
      component_id: component.component_id,
      position_in_assembly: index,
      html_selector: `.component-${component.component_id}`,
      field_prefix: component.component_id,
      customizations_applied: []
    }));
  }

  private collectDependencies(components: ModuleComponent[]): ModuleDependency[] {
    const dependencies: ModuleDependency[] = [];
    let loadOrder = 0;

    for (const component of components) {
      for (const dep of component.dependencies) {
        dependencies.push({
          dependency_name: dep.dependency_id,
          dependency_type: dep.dependency_type as any,
          version: dep.version_requirement,
          load_order: loadOrder++
        });
      }
    }

    return dependencies;
  }

  private async validateAssembledModule(module: AssembledModule, validationLevel: string): Promise<AssemblyValidationResult[]> {
    const results: AssemblyValidationResult[] = [];

    // Basic structure validation
    results.push({
      validation_type: 'structure',
      status: module.html_template && module.fields_definition.length > 0 ? 'passed' : 'failed',
      message: 'Module structure validation',
      suggested_fix: 'Ensure module has valid HTML template and field definitions'
    });

    // Performance validation
    const htmlSize = Buffer.byteLength(module.html_template, 'utf8');
    const cssSize = Buffer.byteLength(module.css_styles, 'utf8');
    
    results.push({
      validation_type: 'performance',
      status: htmlSize + cssSize < 100000 ? 'passed' : 'warning',
      message: `Total size: ${Math.round((htmlSize + cssSize) / 1024)}KB`,
      suggested_fix: 'Consider optimizing CSS and HTML for better performance'
    });

    return results;
  }

  private async calculatePerformanceMetrics(module: AssembledModule): Promise<AssemblyPerformanceMetrics> {
    const htmlSize = Buffer.byteLength(module.html_template, 'utf8');
    const cssSize = Buffer.byteLength(module.css_styles, 'utf8');
    const jsSize = module.javascript_code ? Buffer.byteLength(module.javascript_code, 'utf8') : 0;

    return {
      estimated_load_time_ms: Math.round((htmlSize + cssSize + jsSize) / 1000 * 10), // Rough estimate
      html_size_bytes: htmlSize,
      css_size_bytes: cssSize,
      js_size_bytes: jsSize,
      complexity_score: module.fields_definition.length * 5,
      accessibility_score: 85, // Default score
      seo_score: 80 // Default score
    };
  }

  private async generateRecommendations(
    module: AssembledModule,
    validationResults: AssemblyValidationResult[],
    performanceMetrics: AssemblyPerformanceMetrics
  ): Promise<AssemblyRecommendation[]> {
    const recommendations: AssemblyRecommendation[] = [];

    // Performance recommendations
    if (performanceMetrics.estimated_load_time_ms > 3000) {
      recommendations.push({
        recommendation_type: 'optimization',
        priority: 'high',
        title: 'Optimize Loading Performance',
        description: 'Module load time exceeds recommended threshold',
        implementation_effort: 'moderate',
        expected_benefit: 'Improved user experience and SEO rankings'
      });
    }

    // Accessibility recommendations
    if (performanceMetrics.accessibility_score < 90) {
      recommendations.push({
        recommendation_type: 'enhancement',
        priority: 'medium',
        title: 'Improve Accessibility',
        description: 'Add ARIA labels and semantic HTML elements',
        implementation_effort: 'minimal',
        expected_benefit: 'Better accessibility compliance and user experience'
      });
    }

    return recommendations;
  }

  private async calculateInterfaceCompatibility(
    componentInterface: ComponentInterface,
    components: ModuleComponent[]
  ): Promise<InterfaceCompatibility> {
    const compatibleComponents: string[] = [];
    const potentialConflicts: string[] = [];

    for (const component of components) {
      // Simplified compatibility check
      const hasCompatibleInterface = component.interfaces.some(iface => 
        iface.interface_name === componentInterface.interface_name
      );
      
      if (hasCompatibleInterface) {
        compatibleComponents.push(component.component_id);
      }
    }

    return {
      interface_name: componentInterface.interface_name,
      compatible_components: compatibleComponents,
      compatibility_score: compatibleComponents.length / components.length,
      potential_conflicts: potentialConflicts,
      resolution_strategies: ['Use interface adapters', 'Apply compatibility shims']
    };
  }

  private async evaluatePatternCompatibility(pattern: CompositionPattern, components: ModuleComponent[]): Promise<{ score: number }> {
    // Simplified pattern compatibility evaluation
    let score = 0;
    
    for (const requirement of pattern.component_requirements) {
      const matchingComponents = components.filter(c => 
        c.interfaces.some(iface => requirement.required_interfaces.includes(iface.interface_name))
      );
      
      if (matchingComponents.length > 0) {
        score += 0.3;
      }
    }

    return { score: Math.min(score, 1.0) };
  }

  private buildAssemblyOptimizationPrompt(
    components: ModuleComponent[],
    requirements: string,
    constraints?: string[]
  ): string {
    return `
Optimize the assembly of these HubSpot module components:

Components:
${components.map(c => `- ${c.name}: ${c.description}`).join('\n')}

Requirements: ${requirements}

Constraints: ${constraints?.join(', ') || 'None'}

Generate an optimal assembly strategy considering:
1. Component compatibility
2. Performance optimization
3. User experience
4. HubSpot best practices

Provide assembly configuration in JSON format.
    `.trim();
  }

  private parseAssemblyResponse(response: any, components: ModuleComponent[]): ComponentAssemblyRequest {
    // Simplified response parsing - would be enhanced with proper AI response parsing
    return {
      target_components: components.map(c => c.component_id),
      assembly_type: 'sequential',
      validation_level: 'strict',
      output_format: 'hubspot_module'
    };
  }

  private generateRuleBasedAssembly(components: ModuleComponent[]): ComponentAssemblyRequest {
    return {
      target_components: components.map(c => c.component_id),
      assembly_type: 'sequential',
      validation_level: 'basic',
      output_format: 'hubspot_module'
    };
  }

  private generateAssemblyId(): string {
    return `assembly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ComponentAssemblyEngine;
