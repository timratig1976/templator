import { createLogger } from '../../utils/logger';
import { logToFrontend } from '../../routes/logs';
import { HubSpotValidationService, ValidationResult } from '../quality/HubSpotValidationService';
import { GeneratedModule } from '../deployment/HubSpotPromptService';

const logger = createLogger();

export interface ModuleTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  complexity: TemplateComplexity;
  tags: string[];
  version: string;
  created_at: Date;
  updated_at: Date;
  author: string;
  usage_count: number;
  rating: number;
  validation_score: number;
  template_data: TemplateData;
  extension_points: ExtensionPoint[];
  dependencies: string[];
  compatibility: HubSpotCompatibility;
}

export interface TemplateData {
  fields: any[];
  meta: any;
  template: string;
  css?: string;
  js?: string;
  documentation: string;
  preview_image?: string;
  demo_data: any;
}

export interface ExtensionPoint {
  id: string;
  name: string;
  description: string;
  type: 'field' | 'section' | 'style' | 'behavior';
  required: boolean;
  default_value?: any;
  validation_rules: string[];
  examples: any[];
}

export interface HubSpotCompatibility {
  min_version: string;
  max_version?: string;
  content_types: string[];
  required_features: string[];
  deprecated_features: string[];
}

export enum TemplateCategory {
  HERO = 'hero',
  NAVIGATION = 'navigation',
  CONTENT = 'content',
  FORM = 'form',
  GALLERY = 'gallery',
  TESTIMONIAL = 'testimonial',
  FEATURE = 'feature',
  FOOTER = 'footer',
  SIDEBAR = 'sidebar',
  BLOG = 'blog',
  ECOMMERCE = 'ecommerce',
  LANDING_PAGE = 'landing_page'
}

export enum TemplateComplexity {
  SIMPLE = 'simple',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export interface TemplateSearchCriteria {
  category?: TemplateCategory;
  complexity?: TemplateComplexity;
  tags?: string[];
  min_rating?: number;
  min_validation_score?: number;
  content_types?: string[];
  search_query?: string;
}

export interface TemplateRecommendation {
  template: ModuleTemplate;
  score: number;
  reasons: string[];
  customization_suggestions: string[];
}

export class TemplateLibraryService {
  private static instance: TemplateLibraryService;
  private templates: Map<string, ModuleTemplate> = new Map();
  private categoryIndex: Map<TemplateCategory, string[]> = new Map();
  private tagIndex: Map<string, string[]> = new Map();
  private validationService: HubSpotValidationService;

  constructor() {
    this.validationService = HubSpotValidationService.getInstance();
    this.initializeDefaultTemplates();
  }

  public static getInstance(): TemplateLibraryService {
    if (!TemplateLibraryService.instance) {
      TemplateLibraryService.instance = new TemplateLibraryService();
    }
    return TemplateLibraryService.instance;
  }

  /**
   * Initialize the library with pre-validated default templates
   */
  private async initializeDefaultTemplates(): Promise<void> {
    logger.info('Initializing template library with default templates');

    const defaultTemplates = [
      await this.createHeroTemplate(),
      await this.createFeatureGridTemplate(),
      await this.createContactFormTemplate(),
      await this.createNavigationTemplate(),
      await this.createTestimonialTemplate(),
      await this.createBlogGridTemplate(),
      await this.createFooterTemplate()
    ];

    for (const template of defaultTemplates) {
      await this.addTemplate(template);
    }

    logger.info(`Initialized template library with ${defaultTemplates.length} default templates`);
  }

  /**
   * Add a new template to the library
   */
  async addTemplate(template: ModuleTemplate): Promise<void> {
    // Validate the template before adding
    const validationResult = await this.validateTemplate(template);
    
    if (!validationResult.valid) {
      throw new Error(`Template validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
    }

    template.validation_score = validationResult.score;
    template.updated_at = new Date();

    this.templates.set(template.id, template);
    this.updateIndexes(template);

    logger.info('Added template to library', {
      templateId: template.id,
      name: template.name,
      category: template.category,
      validationScore: template.validation_score
    });
  }

  /**
   * Search templates based on criteria
   */
  searchTemplates(criteria: TemplateSearchCriteria): ModuleTemplate[] {
    let results = Array.from(this.templates.values());

    // Filter by category
    if (criteria.category) {
      results = results.filter(t => t.category === criteria.category);
    }

    // Filter by complexity
    if (criteria.complexity) {
      results = results.filter(t => t.complexity === criteria.complexity);
    }

    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(t => 
        criteria.tags!.some(tag => t.tags.includes(tag))
      );
    }

    // Filter by minimum rating
    if (criteria.min_rating) {
      results = results.filter(t => t.rating >= criteria.min_rating!);
    }

    // Filter by minimum validation score
    if (criteria.min_validation_score) {
      results = results.filter(t => t.validation_score >= criteria.min_validation_score!);
    }

    // Filter by content types
    if (criteria.content_types && criteria.content_types.length > 0) {
      results = results.filter(t => 
        criteria.content_types!.some(ct => t.compatibility.content_types.includes(ct))
      );
    }

    // Text search
    if (criteria.search_query) {
      const query = criteria.search_query.toLowerCase();
      results = results.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort by rating and validation score
    results.sort((a, b) => {
      const scoreA = (a.rating * 0.6) + (a.validation_score * 0.4);
      const scoreB = (b.rating * 0.6) + (b.validation_score * 0.4);
      return scoreB - scoreA;
    });

    return results;
  }

  /**
   * Get template recommendations based on requirements
   */
  getRecommendations(
    requirements: {
      purpose: string;
      content_type: string;
      complexity_preference?: TemplateComplexity;
      features?: string[];
    }
  ): TemplateRecommendation[] {
    const allTemplates = Array.from(this.templates.values());
    const recommendations: TemplateRecommendation[] = [];

    for (const template of allTemplates) {
      let score = 0;
      const reasons: string[] = [];
      const customizationSuggestions: string[] = [];

      // Content type compatibility
      if (template.compatibility.content_types.includes(requirements.content_type)) {
        score += 30;
        reasons.push('Compatible with your content type');
      }

      // Complexity preference
      if (requirements.complexity_preference) {
        if (template.complexity === requirements.complexity_preference) {
          score += 25;
          reasons.push('Matches your complexity preference');
        } else if (
          (requirements.complexity_preference === TemplateComplexity.SIMPLE && template.complexity === TemplateComplexity.INTERMEDIATE) ||
          (requirements.complexity_preference === TemplateComplexity.INTERMEDIATE && template.complexity === TemplateComplexity.SIMPLE)
        ) {
          score += 15;
          reasons.push('Close to your complexity preference');
        }
      }

      // Feature matching
      if (requirements.features && requirements.features.length > 0) {
        const matchingFeatures = requirements.features.filter(feature => 
          template.tags.includes(feature) || 
          template.description.toLowerCase().includes(feature.toLowerCase())
        );
        
        if (matchingFeatures.length > 0) {
          score += matchingFeatures.length * 10;
          reasons.push(`Includes ${matchingFeatures.length} requested features`);
        }
      }

      // Quality metrics
      score += template.rating * 2;
      score += template.validation_score * 0.5;

      // Usage popularity
      if (template.usage_count > 100) {
        score += 10;
        reasons.push('Popular template with proven track record');
      }

      // Generate customization suggestions
      if (template.extension_points.length > 0) {
        customizationSuggestions.push(`Can be customized through ${template.extension_points.length} extension points`);
      }

      if (score > 20) { // Only include templates with reasonable scores
        recommendations.push({
          template,
          score,
          reasons,
          customization_suggestions: customizationSuggestions
        });
      }
    }

    // Sort by score
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations.slice(0, 10); // Return top 10 recommendations
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): ModuleTemplate | null {
    return this.templates.get(id) || null;
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: TemplateCategory): ModuleTemplate[] {
    const templateIds = this.categoryIndex.get(category) || [];
    return templateIds.map(id => this.templates.get(id)!).filter(Boolean);
  }

  /**
   * Update template usage statistics
   */
  recordTemplateUsage(templateId: string): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.usage_count++;
      template.updated_at = new Date();
      
      logger.debug('Recorded template usage', {
        templateId,
        newUsageCount: template.usage_count
      });
    }
  }

  /**
   * Rate a template
   */
  rateTemplate(templateId: string, rating: number, userId?: string): void {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const template = this.templates.get(templateId);
    if (template) {
      // Simple average for now - could be enhanced with weighted ratings
      template.rating = ((template.rating * template.usage_count) + rating) / (template.usage_count + 1);
      template.updated_at = new Date();

      logger.info('Template rated', {
        templateId,
        rating,
        newAverageRating: template.rating,
        userId
      });
    }
  }

  /**
   * Validate a template
   */
  private async validateTemplate(template: ModuleTemplate): Promise<ValidationResult> {
    const module = {
      fields: template.template_data.fields,
      meta: template.template_data.meta,
      template: template.template_data.template
    };

    return await this.validationService.validateModule(module);
  }

  /**
   * Update search indexes
   */
  private updateIndexes(template: ModuleTemplate): void {
    // Category index
    if (!this.categoryIndex.has(template.category)) {
      this.categoryIndex.set(template.category, []);
    }
    this.categoryIndex.get(template.category)!.push(template.id);

    // Tag index
    for (const tag of template.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, []);
      }
      this.tagIndex.get(tag)!.push(template.id);
    }
  }

  /**
   * Create default hero template
   */
  private async createHeroTemplate(): Promise<ModuleTemplate> {
    return {
      id: 'hero_basic_v1',
      name: 'Basic Hero Section',
      description: 'A clean, responsive hero section with title, subtitle, and call-to-action button',
      category: TemplateCategory.HERO,
      complexity: TemplateComplexity.SIMPLE,
      tags: ['hero', 'cta', 'responsive', 'accessible'],
      version: '1.0.0',
      created_at: new Date(),
      updated_at: new Date(),
      author: 'Templator Team',
      usage_count: 0,
      rating: 4.5,
      validation_score: 95,
      template_data: {
        fields: [
          {
            id: 'hero_title',
            name: 'Hero Title',
            label: 'Hero Title',
            type: 'text',
            required: false,
            default: 'Welcome to Our Website'
          },
          {
            id: 'hero_subtitle',
            name: 'Hero Subtitle',
            label: 'Hero Subtitle',
            type: 'textarea',
            required: false,
            default: 'Discover amazing products and services'
          },
          {
            id: 'hero_cta_text',
            name: 'CTA Button Text',
            label: 'Call-to-Action Button Text',
            type: 'text',
            required: false,
            default: 'Get Started'
          },
          {
            id: 'hero_cta_url',
            name: 'CTA Button URL',
            label: 'Call-to-Action Button URL',
            type: 'url',
            required: false
          },
          {
            id: 'hero_background_image',
            name: 'Background Image',
            label: 'Hero Background Image',
            type: 'image',
            required: false
          }
        ],
        meta: {
          label: 'Hero Section',
          css_assets: [],
          js_assets: [],
          other_assets: [],
          content_types: ['page', 'blog-post', 'landing-page']
        },
        template: `
<section class="hero-section" role="banner" aria-labelledby="hero-title">
  {% if module.hero_background_image.src %}
    <div class="hero-background" style="background-image: url('{{ module.hero_background_image.src }}');" aria-hidden="true"></div>
  {% endif %}
  <div class="hero-content">
    <div class="container">
      <h1 id="hero-title" class="hero-title">{{ module.hero_title }}</h1>
      {% if module.hero_subtitle %}
        <p class="hero-subtitle">{{ module.hero_subtitle }}</p>
      {% endif %}
      {% if module.hero_cta_text and module.hero_cta_url %}
        <a href="{{ module.hero_cta_url }}" class="hero-cta btn btn-primary" aria-label="{{ module.hero_cta_text }}">
          {{ module.hero_cta_text }}
        </a>
      {% endif %}
    </div>
  </div>
</section>
        `,
        css: `
.hero-section {
  position: relative;
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.hero-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-size: cover;
  background-position: center;
  z-index: 1;
}

.hero-content {
  position: relative;
  z-index: 2;
  width: 100%;
}

.hero-title {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.hero-subtitle {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.hero-cta {
  display: inline-block;
  padding: 1rem 2rem;
  background: #ff6b6b;
  color: white;
  text-decoration: none;
  border-radius: 5px;
  font-weight: 600;
  transition: background 0.3s ease;
}

.hero-cta:hover {
  background: #ff5252;
  text-decoration: none;
  color: white;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }
  
  .hero-subtitle {
    font-size: 1rem;
  }
}
        `,
        documentation: `
# Basic Hero Section Template

A responsive hero section template with the following features:

## Features
- Responsive design that works on all devices
- Optional background image support
- Accessible markup with proper ARIA labels
- Clean, modern styling
- Call-to-action button with hover effects

## Fields
- **Hero Title**: Main headline text
- **Hero Subtitle**: Supporting text below the title
- **CTA Button Text**: Text for the call-to-action button
- **CTA Button URL**: Link destination for the button
- **Background Image**: Optional background image

## Accessibility
- Uses semantic HTML5 elements
- Proper heading hierarchy
- ARIA labels for screen readers
- Keyboard navigation support

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ with graceful degradation
        `,
        demo_data: {
          hero_title: 'Transform Your Business Today',
          hero_subtitle: 'Join thousands of companies who trust our solutions to drive growth and success',
          hero_cta_text: 'Start Free Trial',
          hero_cta_url: '/signup'
        }
      },
      extension_points: [
        {
          id: 'background_style',
          name: 'Background Style',
          description: 'Customize the hero background appearance',
          type: 'style',
          required: false,
          validation_rules: ['css_valid'],
          examples: [
            { type: 'gradient', value: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)' },
            { type: 'solid', value: '#2c3e50' },
            { type: 'image', value: 'background-image with overlay' }
          ]
        },
        {
          id: 'additional_content',
          name: 'Additional Content',
          description: 'Add extra content sections below the main hero content',
          type: 'section',
          required: false,
          validation_rules: ['html_valid', 'accessible'],
          examples: [
            { type: 'features', value: 'Feature highlights' },
            { type: 'testimonial', value: 'Customer quote' },
            { type: 'stats', value: 'Key statistics' }
          ]
        }
      ],
      dependencies: [],
      compatibility: {
        min_version: '2024.1',
        content_types: ['page', 'blog-post', 'landing-page'],
        required_features: [],
        deprecated_features: []
      }
    };
  }

  /**
   * Create default feature grid template
   */
  private async createFeatureGridTemplate(): Promise<ModuleTemplate> {
    return {
      id: 'feature_grid_v1',
      name: 'Feature Grid',
      description: 'A responsive grid layout for showcasing features with icons, titles, and descriptions',
      category: TemplateCategory.FEATURE,
      complexity: TemplateComplexity.INTERMEDIATE,
      tags: ['features', 'grid', 'responsive', 'icons'],
      version: '1.0.0',
      created_at: new Date(),
      updated_at: new Date(),
      author: 'Templator Team',
      usage_count: 0,
      rating: 4.7,
      validation_score: 92,
      template_data: {
        fields: [
          {
            id: 'section_title',
            name: 'Section Title',
            label: 'Features Section Title',
            type: 'text',
            required: false,
            default: 'Our Features'
          },
          {
            id: 'features_list',
            name: 'Features List',
            label: 'Features List',
            type: 'repeater',
            required: false,
            children: [
              {
                id: 'feature_icon',
                name: 'Feature Icon',
                label: 'Feature Icon',
                type: 'image',
                required: false
              },
              {
                id: 'feature_title',
                name: 'Feature Title',
                label: 'Feature Title',
                type: 'text',
                required: true
              },
              {
                id: 'feature_description',
                name: 'Feature Description',
                label: 'Feature Description',
                type: 'textarea',
                required: false
              }
            ]
          }
        ],
        meta: {
          label: 'Feature Grid',
          css_assets: [],
          js_assets: [],
          other_assets: [],
          content_types: ['page', 'landing-page']
        },
        template: `
<section class="features-section" aria-labelledby="features-heading">
  <div class="container">
    {% if module.section_title %}
      <h2 id="features-heading" class="features-title">{{ module.section_title }}</h2>
    {% endif %}
    <div class="features-grid" role="list">
      {% for feature in module.features_list %}
        <div class="feature-item" role="listitem">
          {% if feature.feature_icon.src %}
            <img src="{{ feature.feature_icon.src }}" alt="{{ feature.feature_icon.alt or feature.feature_title }}" class="feature-icon">
          {% endif %}
          <h3 class="feature-title">{{ feature.feature_title }}</h3>
          {% if feature.feature_description %}
            <p class="feature-description">{{ feature.feature_description }}</p>
          {% endif %}
        </div>
      {% endfor %}
    </div>
  </div>
</section>
        `,
        documentation: 'Responsive feature grid with repeater fields for dynamic content',
        demo_data: {
          section_title: 'Why Choose Us',
          features_list: [
            {
              feature_title: 'Fast Performance',
              feature_description: 'Lightning-fast loading times for better user experience'
            },
            {
              feature_title: 'Secure & Reliable',
              feature_description: 'Enterprise-grade security with 99.9% uptime guarantee'
            },
            {
              feature_title: '24/7 Support',
              feature_description: 'Round-the-clock customer support from our expert team'
            }
          ]
        }
      },
      extension_points: [
        {
          id: 'grid_columns',
          name: 'Grid Columns',
          description: 'Number of columns in the feature grid',
          type: 'style',
          required: false,
          default_value: 3,
          validation_rules: ['number', 'min:1', 'max:6'],
          examples: [
            { value: 2, description: '2 columns for simpler layouts' },
            { value: 3, description: '3 columns (default)' },
            { value: 4, description: '4 columns for more features' }
          ]
        }
      ],
      dependencies: [],
      compatibility: {
        min_version: '2024.1',
        content_types: ['page', 'landing-page'],
        required_features: ['repeater_fields'],
        deprecated_features: []
      }
    };
  }

  // Additional template creation methods would continue here...
  private async createContactFormTemplate(): Promise<ModuleTemplate> {
    // Implementation for contact form template
    return {} as ModuleTemplate; // Placeholder
  }

  private async createNavigationTemplate(): Promise<ModuleTemplate> {
    // Implementation for navigation template
    return {} as ModuleTemplate; // Placeholder
  }

  private async createTestimonialTemplate(): Promise<ModuleTemplate> {
    // Implementation for testimonial template
    return {} as ModuleTemplate; // Placeholder
  }

  private async createBlogGridTemplate(): Promise<ModuleTemplate> {
    // Implementation for blog grid template
    return {} as ModuleTemplate; // Placeholder
  }

  private async createFooterTemplate(): Promise<ModuleTemplate> {
    // Implementation for footer template
    return {} as ModuleTemplate; // Placeholder
  }

  /**
   * Get library statistics
   */
  getLibraryStats(): {
    total_templates: number;
    by_category: Record<string, number>;
    by_complexity: Record<string, number>;
    average_rating: number;
    average_validation_score: number;
  } {
    const templates = Array.from(this.templates.values());
    
    const stats = {
      total_templates: templates.length,
      by_category: {} as Record<string, number>,
      by_complexity: {} as Record<string, number>,
      average_rating: 0,
      average_validation_score: 0
    };

    // Count by category
    for (const category of Object.values(TemplateCategory)) {
      stats.by_category[category] = templates.filter(t => t.category === category).length;
    }

    // Count by complexity
    for (const complexity of Object.values(TemplateComplexity)) {
      stats.by_complexity[complexity] = templates.filter(t => t.complexity === complexity).length;
    }

    // Calculate averages
    if (templates.length > 0) {
      stats.average_rating = templates.reduce((sum, t) => sum + t.rating, 0) / templates.length;
      stats.average_validation_score = templates.reduce((sum, t) => sum + t.validation_score, 0) / templates.length;
    }

    return stats;
  }
}

// Export handled by class declaration
