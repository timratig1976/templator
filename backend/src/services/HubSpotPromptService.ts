import { createLogger } from '../utils/logger';
import { logToFrontend } from '../routes/logs';
import OpenAIService from './openaiService';

const logger = createLogger();

export interface ModuleGenerationRequest {
  designDescription?: string;
  moduleType: 'hero' | 'feature_grid' | 'contact_form' | 'navigation' | 'blog_grid' | 'testimonial' | 'product_showcase' | 'custom';
  requirements?: string;
  accessibility?: boolean;
  performance?: boolean;
  mobileFirst?: boolean;
}

export interface GeneratedModule {
  fields: any[];
  meta: any;
  template: string;
  description: string;
}

export class HubSpotPromptService {
  private static instance: HubSpotPromptService;
  private openaiService: typeof OpenAIService;

  constructor() {
    this.openaiService = OpenAIService;
  }

  public static getInstance(): HubSpotPromptService {
    if (!HubSpotPromptService.instance) {
      HubSpotPromptService.instance = new HubSpotPromptService();
    }
    return HubSpotPromptService.instance;
  }

  /**
   * Generate HubSpot module using structured prompts
   */
  async generateModule(request: ModuleGenerationRequest): Promise<GeneratedModule> {
    const startTime = Date.now();
    const requestId = `module_gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Starting HubSpot module generation', {
      requestId,
      moduleType: request.moduleType,
      hasDesignDescription: !!request.designDescription,
      hasRequirements: !!request.requirements,
      accessibility: request.accessibility,
      performance: request.performance,
      mobileFirst: request.mobileFirst
    });

    logToFrontend('info', 'openai', '🚀 Starting HubSpot module generation', {
      moduleType: request.moduleType,
      features: {
        accessibility: request.accessibility,
        performance: request.performance,
        mobileFirst: request.mobileFirst
      }
    }, requestId);

    try {
      // Build the complete prompt
      const prompt = this.buildModulePrompt(request);
      
      logToFrontend('info', 'openai', '📝 Generated structured prompt', {
        promptLength: prompt.length,
        moduleType: request.moduleType
      }, requestId);

      // Call OpenAI with the structured prompt
      const rawContent = await this.openaiService.generateHubSpotModule(prompt);
      if (!rawContent) {
        throw new Error('No content received from OpenAI');
      }

      // Parse the structured response
      const parsedModule = this.parseModuleResponse(rawContent);
      
      const duration = Date.now() - startTime;
      logger.info('HubSpot module generation completed', {
        requestId,
        fieldsCount: parsedModule.fields.length,
        templateLength: parsedModule.template.length,
        duration: `${duration}ms`
      });

      logToFrontend('success', 'openai', '✅ HubSpot module generated successfully', {
        fieldsCount: parsedModule.fields.length,
        templateLength: parsedModule.template.length,
        metaLabel: parsedModule.meta.label
      }, requestId, duration);

      return parsedModule;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Error generating HubSpot module', {
        requestId,
        error: (error as Error).message,
        duration: `${duration}ms`
      });

      logToFrontend('error', 'openai', '❌ Error generating HubSpot module', {
        error: (error as Error).message
      }, requestId, duration);

      throw error;
    }
  }

  /**
   * Build structured prompt based on module type and requirements
   */
  private buildModulePrompt(request: ModuleGenerationRequest): string {
    let prompt = this.getBaseSystemPrompt();
    
    // Add module-specific prompt
    prompt += '\n\n' + this.getModuleTypePrompt(request.moduleType, request.designDescription);
    
    // Add modifier prompts
    if (request.accessibility) {
      prompt += '\n\n' + this.getAccessibilityModifier();
    }
    
    if (request.performance) {
      prompt += '\n\n' + this.getPerformanceModifier();
    }
    
    if (request.mobileFirst) {
      prompt += '\n\n' + this.getMobileFirstModifier();
    }
    
    // Add custom requirements
    if (request.requirements) {
      prompt += `\n\nADDITIONAL REQUIREMENTS:\n${request.requirements}`;
    }
    
    return prompt;
  }

  /**
   * Base system prompt with HubSpot best practices
   */
  private getBaseSystemPrompt(): string {
    return `You are a HubSpot module generation expert. Your task is to create high-quality, production-ready HubSpot modules from design inputs or specifications.

CRITICAL REQUIREMENTS:
1. Generate valid JSON for fields.json with proper HubSpot field types
2. Create semantic, accessible HTML templates with proper HubL syntax
3. Include comprehensive meta.json with appropriate categorization
4. Follow HubSpot best practices and accessibility standards
5. Ensure all field references in templates exist in field definitions
6. Use conditional rendering for all optional fields
7. Provide meaningful default values and help text
8. Use content_types instead of deprecated host_template_types

FIELD TYPE CONSTRAINTS:
- Text fields: Use "text" type, include validation_regex when appropriate
- Rich content: Use "richtext" type with proper default HTML and enabled_features
- Images: Use "image" type with src, alt, width, height properties
- Links: Use "url" type with href, type, open_in_new_tab, no_follow properties
- Toggles: Use "boolean" type for show/hide functionality
- Selections: Use "choice" type with proper choices array format
- Colors: Use "color" type with color and opacity properties
- Repeatable content: Use "group" type with children array

TEMPLATE REQUIREMENTS:
- Always check if fields have values before rendering
- Use semantic HTML5 elements (section, article, header, etc.)
- Include proper ARIA attributes for accessibility
- Use conditional logic: {% if module.field_name %}...{% endif %}
- Handle image fields: {% if module.image.src %}
- Handle URL fields: {% if module.link.url.href %}
- Handle group fields: {% for item in module.group_field %}

META.JSON REQUIREMENTS:
- Use content_types instead of host_template_types
- Valid content_types: "ANY", "LANDING_PAGE", "SITE_PAGE", "BLOG_POST", "BLOG_LISTING", "EMAIL", "KNOWLEDGE_BASE", "QUOTE_TEMPLATE", "CUSTOMER_PORTAL", "WEB_INTERACTIVE", "SUBSCRIPTION", "MEMBERSHIP"
- Include appropriate categories and tags
- Set proper icon and description

OUTPUT FORMAT:
Provide three separate code blocks:
1. \`\`\`json (fields.json)
2. \`\`\`json (meta.json)
3. \`\`\`html (module.html)`;
  }

  /**
   * Get module-specific prompt based on type
   */
  private getModuleTypePrompt(moduleType: string, designDescription?: string): string {
    const baseDescription = designDescription ? `\n\nDESIGN DESCRIPTION:\n${designDescription}` : '';
    
    switch (moduleType) {
      case 'hero':
        return `Create a HubSpot hero section module with the following specifications:

DESIGN REQUIREMENTS:
- Large headline with optional subheadline
- Rich text content area
- Background image support
- Call-to-action button
- Layout alignment options (left, center, right)
- Background color customization
- Show/hide toggle for entire section

FIELD REQUIREMENTS:
- headline: Required text field with 100 character limit
- subheadline: Optional text field for supporting text
- body_content: Optional rich text for detailed content
- hero_image: Optional image field with alt text
- cta_text: Optional text for button label
- cta_link: Optional URL field with all link options
- layout_style: Choice field for alignment (left/center/right)
- background_color: Color field with opacity support
- show_section: Boolean toggle for visibility

TEMPLATE REQUIREMENTS:
- Responsive design with proper breakpoints
- Semantic HTML structure using <section>
- Proper conditional rendering for all optional fields
- Background image as CSS background-image
- Accessible button with proper ARIA attributes
- Support for overlay text on background images${baseDescription}`;

      case 'feature_grid':
        return `Create a HubSpot feature grid module with the following specifications:

DESIGN REQUIREMENTS:
- Section title
- Repeatable feature items with icons, titles, and descriptions
- Configurable column layout (2, 3, or 4 columns)
- Optional links for each feature
- Responsive grid system

FIELD REQUIREMENTS:
- section_title: Optional text field for main heading
- features: Group field with repeatable items containing:
  - icon: Icon field for feature representation
  - title: Required text field for feature name
  - description: Rich text field for feature details
  - link: Optional URL field for "learn more" links
- columns: Choice field for column count (2/3/4)

TEMPLATE REQUIREMENTS:
- CSS Grid or Flexbox layout
- Responsive design that stacks on mobile
- Icon integration with proper sizing
- Semantic HTML with proper heading hierarchy
- Accessible links with descriptive text${baseDescription}`;

      case 'contact_form':
        return `Create a HubSpot contact form module with the following specifications:

DESIGN REQUIREMENTS:
- Form title and description
- HubSpot form integration
- Customizable form styling options
- Privacy notice with toggle
- Background color customization

FIELD REQUIREMENTS:
- form_title: Optional text field for form heading
- form_description: Optional rich text for instructions
- hubspot_form: Required form field for HubSpot form selection
- form_style: Choice field for styling (standard/minimal/bordered/rounded)
- background_color: Color field for section background
- show_privacy_notice: Boolean toggle for privacy text
- privacy_text: Rich text field for privacy notice (conditional)

TEMPLATE REQUIREMENTS:
- Proper HubSpot form embedding syntax
- Conditional privacy notice display
- Form styling classes
- Accessible form labels and structure
- Responsive design${baseDescription}`;

      case 'navigation':
        return `Create a HubSpot navigation menu module with the following specifications:

DESIGN REQUIREMENTS:
- Multi-level navigation support
- Dropdown/submenu functionality
- Responsive mobile menu
- Configurable menu styles

FIELD REQUIREMENTS:
- menu_items: Group field with repeatable navigation items:
  - label: Required text for menu item
  - url: Required URL field for navigation
  - has_submenu: Boolean for dropdown functionality
  - submenu_items: Nested group for submenu items (conditional)
- menu_style: Choice field for navigation style (horizontal/vertical/mega)

TEMPLATE REQUIREMENTS:
- Semantic <nav> element with proper ARIA
- Keyboard navigation support
- Mobile-responsive menu structure
- Proper link accessibility
- JavaScript hooks for menu functionality${baseDescription}`;

      case 'blog_grid':
        return `Create a HubSpot blog post grid module with the following specifications:

DESIGN REQUIREMENTS:
- Display recent blog posts in grid layout
- Featured post option
- Post excerpts and metadata
- Read more links
- Pagination or load more functionality

FIELD REQUIREMENTS:
- section_title: Optional text for grid heading
- post_count: Number field for posts to display (1-12)
- featured_post: Optional blog field for highlighted post
- show_excerpts: Boolean toggle for post excerpts
- show_dates: Boolean toggle for publish dates
- show_authors: Boolean toggle for author names
- grid_columns: Choice field for column layout
- read_more_text: Text field for link text

TEMPLATE REQUIREMENTS:
- Blog post loop with proper HubL syntax
- Responsive grid layout
- Proper date formatting
- Author information display
- SEO-friendly post links
- Accessible card structure${baseDescription}`;

      case 'testimonial':
        return `Create a HubSpot testimonial carousel module:

DESIGN REQUIREMENTS:
- Rotating testimonial display
- Customer photos and details
- Star ratings
- Navigation controls
- Auto-play options

FIELD REQUIREMENTS:
- testimonials: Group field for testimonial items:
  - quote: Required rich text for testimonial
  - customer_name: Required text for customer name
  - customer_title: Optional text for job title
  - customer_company: Optional text for company
  - customer_photo: Optional image for headshot
  - rating: Number field for star rating (1-5)
- auto_play: Boolean for automatic rotation
- show_navigation: Boolean for nav arrows
- show_indicators: Boolean for dot indicators
- rotation_speed: Number field for timing${baseDescription}`;

      case 'product_showcase':
        return `Create a HubSpot product showcase module for e-commerce sites:

DESIGN REQUIREMENTS:
- Product grid with images and details
- Price display with currency formatting
- Add to cart functionality hooks
- Product filtering options
- Sale/discount badges

FIELD REQUIREMENTS:
- products: Group field for product items:
  - name: Required text for product name
  - image: Required image for product photo
  - price: Number field for product price
  - sale_price: Optional number for discounted price
  - description: Rich text for product details
  - product_url: URL field for product page
  - in_stock: Boolean for availability
- currency_symbol: Text field for currency display
- show_sale_badges: Boolean for discount indicators
- products_per_row: Choice field for grid layout${baseDescription}`;

      default:
        return `Create a custom HubSpot module based on the following requirements:

DESIGN REQUIREMENTS:
- Follow HubSpot best practices
- Responsive design
- Accessible markup
- Performance optimized

Please analyze the design description and create appropriate fields and template structure.${baseDescription}`;
    }
  }

  /**
   * Accessibility enhancement modifier
   */
  private getAccessibilityModifier(): string {
    return `ACCESSIBILITY ENHANCEMENT:
Ensure the generated module meets WCAG 2.1 AA standards:
- All images have descriptive alt text
- Interactive elements have proper ARIA labels
- Color contrast ratios are sufficient
- Keyboard navigation is fully supported
- Screen reader compatibility is maintained
- Focus indicators are visible
- Semantic HTML structure is used throughout`;
  }

  /**
   * Performance optimization modifier
   */
  private getPerformanceModifier(): string {
    return `PERFORMANCE OPTIMIZATION:
Optimize the generated module for performance:
- Minimize inline styles (prefer CSS classes)
- Optimize default image sizes and formats
- Use efficient HubL expressions
- Minimize DOM complexity
- Implement lazy loading for images
- Reduce HTTP requests where possible
- Use semantic HTML to reduce markup`;
  }

  /**
   * Mobile-first design modifier
   */
  private getMobileFirstModifier(): string {
    return `MOBILE-FIRST DESIGN:
Generate the module with mobile-first responsive design:
- Start with mobile layout and scale up
- Use flexible grid systems
- Implement touch-friendly interactions
- Optimize for small screens first
- Use appropriate breakpoints
- Consider mobile performance constraints
- Test across various device sizes`;
  }

  /**
   * Parse the structured response from OpenAI
   */
  private parseModuleResponse(content: string): GeneratedModule {
    const codeBlocks = this.extractCodeBlocks(content);
    
    if (codeBlocks.length < 3) {
      throw new Error('Invalid response format: Expected 3 code blocks (fields.json, meta.json, module.html)');
    }

    let fields: any[];
    let meta: any;
    let template: string;

    try {
      // Parse fields.json
      fields = JSON.parse(codeBlocks[0].content);
      if (!Array.isArray(fields)) {
        throw new Error('fields.json must be an array');
      }

      // Parse meta.json
      meta = JSON.parse(codeBlocks[1].content);
      if (typeof meta !== 'object') {
        throw new Error('meta.json must be an object');
      }

      // Get template
      template = codeBlocks[2].content;
      if (!template || typeof template !== 'string') {
        throw new Error('module.html template is required');
      }

    } catch (error) {
      logger.error('Error parsing module response', { error });
      throw new Error(`Failed to parse module response: ${(error as Error).message}`);
    }

    return {
      fields,
      meta,
      template,
      description: meta.description || 'Generated HubSpot module'
    };
  }

  /**
   * Extract code blocks from markdown response
   */
  private extractCodeBlocks(content: string): Array<{ language: string; content: string }> {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: Array<{ language: string; content: string }> = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        content: match[2].trim()
      });
    }

    return blocks;
  }

  /**
   * Generate validation prompt for quality assurance
   */
  async generateValidationPrompt(module: GeneratedModule): Promise<string> {
    return `Review the following HubSpot module for quality and compliance:

VALIDATION CHECKLIST:
1. Field Definitions:
   - All field IDs are unique and follow naming conventions
   - Required fields have appropriate defaults
   - Field types match their usage in templates
   - Help text is provided for complex fields

2. Template Quality:
   - All field references exist in fields.json
   - Conditional rendering is used for optional fields
   - HTML is semantic and accessible
   - HubL syntax is correct

3. Metadata:
   - Label and description are clear and descriptive
   - Appropriate categories and tags are assigned
   - content_types are correctly specified

4. Best Practices:
   - Follows HubSpot coding standards
   - Implements accessibility requirements
   - Uses performance optimization techniques
   - Maintains consistent code style

FIELDS.JSON:
\`\`\`json
${JSON.stringify(module.fields, null, 2)}
\`\`\`

META.JSON:
\`\`\`json
${JSON.stringify(module.meta, null, 2)}
\`\`\`

MODULE.HTML:
\`\`\`html
${module.template}
\`\`\`

Provide a detailed quality assessment and suggest improvements.`;
  }
}

// Export handled by class declaration
