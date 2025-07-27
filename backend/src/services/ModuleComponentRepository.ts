import { createLogger } from '../utils/logger';
import { HubSpotValidationService } from './HubSpotValidationService';
import OpenAIService from './openaiService';

const logger = createLogger();

// Core types for component management
export interface ModuleComponent {
  component_id: string;
  name: string;
  description: string;
  category: ComponentCategory;
  type: ComponentType;
  complexity_level: 'simple' | 'intermediate' | 'advanced';
  hubspot_version_compatibility: string[];
  
  html_template: string;
  css_styles?: string;
  javascript_code?: string;
  fields_definition: ComponentField[];
  
  created_at: Date;
  updated_at: Date;
  version: string;
  author: string;
  tags: string[];
  
  quality_score: number;
  usage_count: number;
  rating: ComponentRating;
  validation_status: 'validated' | 'pending' | 'failed';
  
  dependencies: ComponentDependency[];
  interfaces: ComponentInterface[];
}

export interface ComponentField {
  field_name: string;
  field_type: string;
  required: boolean;
  default_value?: any;
  help_text?: string;
}

export interface ComponentDependency {
  dependency_id: string;
  dependency_type: 'component' | 'library' | 'api';
  version_requirement: string;
  optional: boolean;
}

export interface ComponentInterface {
  interface_name: string;
  input_parameters: InterfaceParameter[];
  output_parameters: InterfaceParameter[];
  compatibility_rules: string[];
}

export interface InterfaceParameter {
  parameter_name: string;
  parameter_type: string;
  required: boolean;
  description: string;
}

export interface ComponentRating {
  average_rating: number;
  total_ratings: number;
  rating_distribution: { [key: number]: number };
  recent_feedback: ComponentFeedback[];
}

export interface ComponentFeedback {
  feedback_id: string;
  user_id: string;
  rating: number;
  comment?: string;
  feedback_type: 'quality' | 'usability' | 'documentation' | 'performance';
  created_at: Date;
}

export type ComponentCategory = 'layout' | 'content' | 'form' | 'navigation' | 'media' | 'interactive' | 'data-display' | 'utility';
export type ComponentType = 'header' | 'footer' | 'hero' | 'card' | 'button' | 'form-field' | 'gallery' | 'testimonial' | 'pricing' | 'contact' | 'blog' | 'custom';

export interface ComponentSearchQuery {
  query?: string;
  category?: ComponentCategory;
  type?: ComponentType;
  complexity_level?: string[];
  min_quality_score?: number;
  tags?: string[];
  sort_by?: 'relevance' | 'quality' | 'popularity' | 'recent';
  limit?: number;
  offset?: number;
}

export interface ComponentSearchResult {
  components: ModuleComponent[];
  total_count: number;
  facets: {
    categories: { [key: string]: number };
    types: { [key: string]: number };
    complexity_levels: { [key: string]: number };
    tags: { [key: string]: number };
  };
  search_metadata: {
    query_time_ms: number;
    suggestions?: string[];
  };
}

export class ModuleComponentRepository {
  private static instance: ModuleComponentRepository;
  private components: Map<string, ModuleComponent> = new Map();
  private validationService: HubSpotValidationService;
  private openaiService: typeof OpenAIService;
  private componentIndex: Map<string, Set<string>> = new Map();

  constructor() {
    this.validationService = HubSpotValidationService.getInstance();
    this.openaiService = OpenAIService;
    this.initializeRepository();
  }

  public static getInstance(): ModuleComponentRepository {
    if (!ModuleComponentRepository.instance) {
      ModuleComponentRepository.instance = new ModuleComponentRepository();
    }
    return ModuleComponentRepository.instance;
  }

  private async initializeRepository(): Promise<void> {
    logger.info('Initializing Module Component Repository');
    try {
      await this.loadCoreComponents();
      await this.buildSearchIndex();
      logger.info('Repository initialized', { componentCount: this.components.size });
    } catch (error) {
      logger.error('Failed to initialize repository', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async addComponent(component: Omit<ModuleComponent, 'component_id' | 'created_at' | 'updated_at' | 'quality_score' | 'usage_count' | 'rating'>): Promise<string> {
    const componentId = this.generateComponentId();
    const now = new Date();

    const newComponent: ModuleComponent = {
      ...component,
      component_id: componentId,
      created_at: now,
      updated_at: now,
      quality_score: 0,
      usage_count: 0,
      rating: { average_rating: 0, total_ratings: 0, rating_distribution: {}, recent_feedback: [] }
    };

    const validationResult = await this.validateComponent(newComponent);
    if (!validationResult.isValid) {
      throw new Error(`Component validation failed: ${validationResult.errors.join(', ')}`);
    }

    newComponent.quality_score = await this.calculateQualityScore(newComponent);
    newComponent.validation_status = 'validated';

    this.components.set(componentId, newComponent);
    await this.updateSearchIndex(newComponent);

    logger.info('Component added', { componentId, name: component.name, category: component.category });
    return componentId;
  }

  async searchComponents(query: ComponentSearchQuery): Promise<ComponentSearchResult> {
    const startTime = Date.now();
    let filteredComponents = Array.from(this.components.values());

    // Apply filters
    if (query.category) filteredComponents = filteredComponents.filter(c => c.category === query.category);
    if (query.type) filteredComponents = filteredComponents.filter(c => c.type === query.type);
    if (query.complexity_level?.length) filteredComponents = filteredComponents.filter(c => query.complexity_level!.includes(c.complexity_level));
    if (query.min_quality_score) filteredComponents = filteredComponents.filter(c => c.quality_score >= query.min_quality_score!);
    if (query.tags?.length) filteredComponents = filteredComponents.filter(c => query.tags!.some(tag => c.tags.includes(tag)));
    if (query.query) filteredComponents = filteredComponents.filter(c => this.matchesTextQuery(c, query.query!));

    // Sort and paginate
    filteredComponents = this.sortComponents(filteredComponents, query.sort_by || 'relevance');
    const facets = this.calculateFacets(filteredComponents);
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    const paginatedComponents = filteredComponents.slice(offset, offset + limit);

    return {
      components: paginatedComponents,
      total_count: filteredComponents.length,
      facets,
      search_metadata: {
        query_time_ms: Date.now() - startTime,
        suggestions: await this.generateSearchSuggestions(query.query)
      }
    };
  }

  async getComponent(componentId: string, trackUsage: boolean = true): Promise<ModuleComponent | null> {
    const component = this.components.get(componentId);
    if (component && trackUsage) {
      component.usage_count++;
      component.updated_at = new Date();
      this.components.set(componentId, component);
    }
    return component || null;
  }

  async rateComponent(componentId: string, rating: number, feedback?: Omit<ComponentFeedback, 'feedback_id' | 'created_at'>): Promise<void> {
    const component = this.components.get(componentId);
    if (!component) throw new Error(`Component not found: ${componentId}`);

    if (feedback) {
      const newFeedback: ComponentFeedback = {
        ...feedback,
        feedback_id: this.generateFeedbackId(),
        created_at: new Date()
      };
      component.rating.recent_feedback.push(newFeedback);
      if (component.rating.recent_feedback.length > 50) {
        component.rating.recent_feedback = component.rating.recent_feedback.slice(-50);
      }
    }

    component.rating.total_ratings++;
    component.rating.rating_distribution[rating] = (component.rating.rating_distribution[rating] || 0) + 1;
    
    const totalScore = Object.entries(component.rating.rating_distribution)
      .reduce((sum, [score, count]) => sum + (parseInt(score) * count), 0);
    component.rating.average_rating = totalScore / component.rating.total_ratings;

    component.quality_score = await this.calculateQualityScore(component);
    component.updated_at = new Date();
    this.components.set(componentId, component);

    logger.info('Component rated', { componentId, rating, newAverage: component.rating.average_rating });
  }

  async getComponentsByCategory(category: ComponentCategory, limit: number = 10): Promise<ModuleComponent[]> {
    return Array.from(this.components.values())
      .filter(c => c.category === category)
      .sort((a, b) => b.quality_score - a.quality_score)
      .slice(0, limit);
  }

  async getPopularComponents(limit: number = 10): Promise<ModuleComponent[]> {
    return Array.from(this.components.values())
      .sort((a, b) => {
        const aPopularity = (a.usage_count * 0.7) + (a.rating.average_rating * a.rating.total_ratings * 0.3);
        const bPopularity = (b.usage_count * 0.7) + (b.rating.average_rating * b.rating.total_ratings * 0.3);
        return bPopularity - aPopularity;
      })
      .slice(0, limit);
  }

  // Private helper methods
  private async loadCoreComponents(): Promise<void> {
    const coreComponents = await this.createCoreComponentLibrary();
    for (const component of coreComponents) {
      await this.addComponent(component);
    }
  }

  private async createCoreComponentLibrary(): Promise<Array<Omit<ModuleComponent, 'component_id' | 'created_at' | 'updated_at' | 'quality_score' | 'usage_count' | 'rating'>>> {
    return [
      {
        name: 'Hero Section',
        description: 'Responsive hero section with customizable background and call-to-action',
        category: 'layout',
        type: 'hero',
        complexity_level: 'intermediate',
        hubspot_version_compatibility: ['2.0', '2.1', '2.2'],
        html_template: `<div class="hero-section"><div class="hero-content"><h1>{{ module.headline }}</h1><p>{{ module.subheadline }}</p><a href="{{ module.cta_url }}" class="cta-button">{{ module.cta_text }}</a></div></div>`,
        css_styles: `.hero-section { min-height: 500px; display: flex; align-items: center; justify-content: center; text-align: center; }`,
        fields_definition: [
          { field_name: 'headline', field_type: 'text', required: true, default_value: 'Welcome', help_text: 'Main headline' },
          { field_name: 'subheadline', field_type: 'text', required: false, help_text: 'Supporting text' },
          { field_name: 'cta_text', field_type: 'text', required: true, default_value: 'Get Started', help_text: 'Button text' },
          { field_name: 'cta_url', field_type: 'url', required: true, help_text: 'Button URL' }
        ],
        version: '1.0.0',
        author: 'Templator Core Team',
        tags: ['hero', 'landing', 'cta', 'responsive'],
        validation_status: 'validated',
        dependencies: [],
        interfaces: [
          {
            interface_name: 'HeroInterface',
            input_parameters: [{ parameter_name: 'content', parameter_type: 'HeroContent', required: true, description: 'Hero content config' }],
            output_parameters: [{ parameter_name: 'rendered_html', parameter_type: 'string', required: true, description: 'Rendered HTML' }],
            compatibility_rules: ['Can be used as page header', 'Compatible with navigation components']
          }
        ]
      },
      {
        name: 'Contact Form',
        description: 'Responsive contact form with validation and HubSpot integration',
        category: 'form',
        type: 'contact',
        complexity_level: 'advanced',
        hubspot_version_compatibility: ['2.0', '2.1', '2.2'],
        html_template: `<div class="contact-form-wrapper"><h2>{{ module.form_title }}</h2><form class="contact-form"><div class="form-group"><label>Name</label><input type="text" name="name" required></div><div class="form-group"><label>Email</label><input type="email" name="email" required></div><button type="submit">{{ module.submit_text }}</button></form></div>`,
        css_styles: `.contact-form-wrapper { max-width: 600px; margin: 0 auto; padding: 2rem; } .form-group { margin-bottom: 1.5rem; }`,
        fields_definition: [
          { field_name: 'form_title', field_type: 'text', required: true, default_value: 'Contact Us', help_text: 'Form title' },
          { field_name: 'submit_text', field_type: 'text', required: true, default_value: 'Send Message', help_text: 'Submit button text' }
        ],
        version: '1.0.0',
        author: 'Templator Core Team',
        tags: ['form', 'contact', 'hubspot', 'validation'],
        validation_status: 'validated',
        dependencies: [{ dependency_id: 'hubspot-forms-api', dependency_type: 'api', version_requirement: '>=2.0', optional: false }],
        interfaces: [
          {
            interface_name: 'FormInterface',
            input_parameters: [{ parameter_name: 'form_config', parameter_type: 'FormConfiguration', required: true, description: 'Form configuration' }],
            output_parameters: [{ parameter_name: 'form_html', parameter_type: 'string', required: true, description: 'Rendered form HTML' }],
            compatibility_rules: ['Requires HubSpot forms API', 'Must include CSRF protection']
          }
        ]
      }
    ];
  }

  private async validateComponent(component: ModuleComponent): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!component.name?.trim()) errors.push('Component name is required');
    if (!component.html_template?.trim()) errors.push('HTML template is required');
    if (!component.fields_definition?.length) errors.push('At least one field definition is required');
    return { isValid: errors.length === 0, errors };
  }

  private async calculateQualityScore(component: ModuleComponent): Promise<number> {
    let score = 0;
    if (component.validation_status === 'validated') score += 30;
    if (component.description?.length > 50) score += 15;
    if (component.css_styles) score += 10;
    if (component.rating.total_ratings > 0) score += component.rating.average_rating * 4;
    if (component.usage_count > 0) score += Math.min(Math.log10(component.usage_count) * 5, 10);
    return Math.min(Math.round(score), 100);
  }

  private async buildSearchIndex(): Promise<void> {
    this.componentIndex.clear();
    for (const component of this.components.values()) {
      await this.updateSearchIndex(component);
    }
  }

  private async updateSearchIndex(component: ModuleComponent): Promise<void> {
    const searchTerms = [component.name.toLowerCase(), component.description.toLowerCase(), component.category, component.type, ...component.tags.map(tag => tag.toLowerCase())];
    for (const term of searchTerms) {
      if (!this.componentIndex.has(term)) this.componentIndex.set(term, new Set());
      this.componentIndex.get(term)!.add(component.component_id);
    }
  }

  private matchesTextQuery(component: ModuleComponent, query: string): boolean {
    const searchText = `${component.name} ${component.description} ${component.tags.join(' ')}`.toLowerCase();
    return query.toLowerCase().split(' ').every(term => searchText.includes(term));
  }

  private sortComponents(components: ModuleComponent[], sortBy: string): ModuleComponent[] {
    switch (sortBy) {
      case 'quality': return components.sort((a, b) => b.quality_score - a.quality_score);
      case 'popularity': return components.sort((a, b) => b.usage_count - a.usage_count);
      case 'recent': return components.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
      default: return components.sort((a, b) => b.quality_score - a.quality_score);
    }
  }

  private calculateFacets(components: ModuleComponent[]): ComponentSearchResult['facets'] {
    const facets = { categories: {} as { [key: string]: number }, types: {} as { [key: string]: number }, complexity_levels: {} as { [key: string]: number }, tags: {} as { [key: string]: number } };
    for (const component of components) {
      facets.categories[component.category] = (facets.categories[component.category] || 0) + 1;
      facets.types[component.type] = (facets.types[component.type] || 0) + 1;
      facets.complexity_levels[component.complexity_level] = (facets.complexity_levels[component.complexity_level] || 0) + 1;
      for (const tag of component.tags) facets.tags[tag] = (facets.tags[tag] || 0) + 1;
    }
    return facets;
  }

  private async generateSearchSuggestions(query?: string): Promise<string[]> {
    if (!query) return [];
    const suggestions: string[] = [];
    const queryLower = query.toLowerCase();
    for (const component of this.components.values()) {
      if (component.name.toLowerCase().includes(queryLower) && !suggestions.includes(component.name)) {
        suggestions.push(component.name);
      }
    }
    return suggestions.slice(0, 5);
  }

  private generateComponentId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFeedbackId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ModuleComponentRepository;
