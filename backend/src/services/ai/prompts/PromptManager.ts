/**
 * AI Prompt Manager
 * Centralized management of AI prompts with versioning and templating
 * Separates prompt logic from service implementation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../../../utils/logger';

const logger = createLogger();

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'splitting' | 'generation' | 'analysis' | 'refinement' | 'validation';
  template: string;
  variables: PromptVariable[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    author: string;
    tags: string[];
  };
}

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: any[];
  };
}

export interface PromptContext {
  [key: string]: any;
}

/**
 * Prompt Manager Service
 * Manages AI prompts with templating, versioning, and validation
 */
export class PromptManager {
  private static instance: PromptManager;
  private promptsCache: Map<string, PromptTemplate> = new Map();
  private promptsPath: string;

  public static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  private constructor() {
    this.promptsPath = path.join(__dirname, 'templates');
    this.loadPrompts();
  }

  /**
   * Get prompt by ID and render with context
   */
  async getPrompt(promptId: string, context: PromptContext = {}): Promise<string> {
    try {
      const template = this.promptsCache.get(promptId);
      if (!template) {
        throw new Error(`Prompt template not found: ${promptId}`);
      }

      // Validate required variables
      this.validateContext(template, context);

      // Render template with context
      const renderedPrompt = this.renderTemplate(template.template, context);

      logger.debug('Prompt rendered', {
        promptId,
        version: template.version,
        contextKeys: Object.keys(context)
      });

      return renderedPrompt;

    } catch (error) {
      logger.error('Failed to get prompt', {
        promptId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get design splitting prompt
   */
  async getSplittingPrompt(context: {
    includeElements?: boolean;
    focusAreas?: string[];
    layoutType?: string;
  } = {}): Promise<string> {
    return this.getPrompt('design_splitting_v2', context);
  }

  /**
   * Get HTML generation prompt
   */
  async getGenerationPrompt(context: {
    sectionType: string;
    designDescription: string;
    requirements?: string[];
    framework?: string;
  }): Promise<string> {
    return this.getPrompt('html_generation_v2', context);
  }

  /**
   * Get code refinement prompt
   */
  async getRefinementPrompt(context: {
    html: string;
    css: string;
    feedback: string;
    focusAreas?: string[];
    currentScore?: number;
    targetScore?: number;
  }): Promise<string> {
    return this.getPrompt('code_refinement_v2', context);
  }

  /**
   * Get layout analysis prompt
   */
  async getAnalysisPrompt(context: {
    includeElements?: boolean;
    analysisType?: string;
    detailLevel?: 'basic' | 'detailed' | 'comprehensive';
  } = {}): Promise<string> {
    return this.getPrompt('layout_analysis_v2', context);
  }

  /**
   * Load all prompt templates
   */
  private async loadPrompts(): Promise<void> {
    try {
      await this.ensurePromptsDirectory();
      
      // Load built-in prompts
      await this.loadBuiltInPrompts();
      
      // Load custom prompts from files
      await this.loadCustomPrompts();

      logger.info('Prompts loaded', {
        totalPrompts: this.promptsCache.size,
        categories: this.getPromptCategories()
      });

    } catch (error) {
      logger.error('Failed to load prompts', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Load built-in prompt templates
   */
  private async loadBuiltInPrompts(): Promise<void> {
    const builtInPrompts: PromptTemplate[] = [
      {
        id: 'design_splitting_v2',
        name: 'Design Section Splitting',
        version: '2.0.0',
        description: 'AI prompt for analyzing design layouts and suggesting section splits',
        category: 'splitting',
        template: `
Analyze this design image and identify logical sections that should be split for modular development.

**Your Task**: 
Identify distinct visual sections in this design and suggest optimal splitting boundaries. DO NOT generate any HTML or CSS code.

{{#if includeElements}}
**Include Element Detection**: Identify individual elements within each section (text, images, buttons, forms, navigation, logos).
{{/if}}

{{#if focusAreas}}
**Focus Areas**: Pay special attention to: {{join focusAreas ", "}}
{{/if}}

{{#if layoutType}}
**Layout Type**: This appears to be a {{layoutType}} layout.
{{/if}}

**Analysis Requirements**:

1. **Layout Classification**:
   - Determine overall layout style (modern, classic, minimal, corporate, creative, etc.)
   - Assess complexity level (simple, moderate, complex)

2. **Section Detection**:
   - Identify clear visual sections with precise percentage-based boundaries
   - Classify each section type (header, hero, content, features, testimonials, gallery, contact, footer)
   - Provide confidence scores for each detection
   - Include descriptive names and purposes

{{#if includeElements}}
3. **Element Detection**:
   - Identify individual elements within sections (text, images, buttons, forms, navigation, logos)
   - Provide precise bounds for each element
   - Extract text content where visible
   - Note element relationships and hierarchy
{{/if}}

**Response Format**:
Return a JSON object with this exact structure:

{
  "layout_style": "modern/classic/minimal/corporate/creative",
  "complexity_overall": "simple/moderate/complex",
  "sections": [
    {
      "id": "unique_section_id",
      "name": "Section Name",
      "type": "header/hero/content/features/testimonials/gallery/contact/footer",
      "bounds": {
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 25
      },
      "confidence": 0.95,
      "description": "Brief description of section content and purpose"
    }
  ]{{#if includeElements}},
  "elements": [
    {
      "id": "unique_element_id",
      "type": "text/image/button/form/navigation/logo",
      "bounds": {
        "x": 10,
        "y": 5,
        "width": 80,
        "height": 15
      },
      "content": "Visible text content if applicable",
      "attributes": {
        "fontSize": "large",
        "color": "primary",
        "alignment": "center"
      }
    }
  ]{{else}},
  "elements": []{{/if}}
}

**Important Notes**:
- Use percentage values (0-100) for all coordinates
- Y=0 is top, Y=100 is bottom; X=0 is left, X=100 is right
- Confidence should be 0.0-1.0 based on detection certainty
- Ensure sections cover the design comprehensively
- Focus on major structural elements, not decorative details
        `,
        variables: [
          {
            name: 'includeElements',
            type: 'boolean',
            required: false,
            description: 'Whether to include individual element detection',
            defaultValue: false
          },
          {
            name: 'focusAreas',
            type: 'array',
            required: false,
            description: 'Specific areas to focus analysis on'
          },
          {
            name: 'layoutType',
            type: 'string',
            required: false,
            description: 'Expected layout type hint'
          }
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          author: 'Templator Team',
          tags: ['splitting', 'vision', 'layout']
        }
      },
      {
        id: 'html_generation_v2',
        name: 'HTML/CSS Generation',
        version: '2.0.0',
        description: 'AI prompt for generating HTML and CSS from design sections',
        category: 'generation',
        template: `
Generate modern, responsive HTML and CSS code for this design section.

**Section Details**:
- **Type**: {{sectionType}}
- **Description**: {{designDescription}}

{{#if requirements}}
**Requirements**:
{{#each requirements}}
- {{this}}
{{/each}}
{{/if}}

{{#if framework}}
**Framework**: Use {{framework}} patterns and conventions
{{/if}}

**Generation Guidelines**:

1. **HTML Structure**:
   - Use semantic HTML5 elements
   - Implement proper accessibility (ARIA labels, alt text, proper heading hierarchy)
   - Ensure clean, readable markup
   - Include appropriate meta tags and structure

2. **CSS Styling**:
   - Use modern CSS features (Flexbox, Grid, Custom Properties)
   - Implement responsive design with mobile-first approach
   - Follow BEM methodology for class naming
   - Optimize for performance (minimal unused styles)

3. **Responsive Design**:
   - Mobile-first responsive design
   - Breakpoints: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
   - Flexible layouts that work on all screen sizes

4. **Accessibility**:
   - WCAG 2.1 AA compliance
   - Proper color contrast ratios
   - Keyboard navigation support
   - Screen reader compatibility

5. **Performance**:
   - Minimal CSS footprint
   - Optimized for fast loading
   - Efficient selectors

**Response Format**:
Provide your response in this exact JSON format:

{
  "html": "<!-- Generated HTML code here -->",
  "css": "/* Generated CSS code here */",
  "metadata": {
    "sectionType": "{{sectionType}}",
    "framework": "{{framework}}",
    "features": ["responsive", "accessible", "semantic"],
    "browserSupport": "Modern browsers (Chrome 90+, Firefox 88+, Safari 14+)",
    "notes": "Any important implementation notes"
  }
}
        `,
        variables: [
          {
            name: 'sectionType',
            type: 'string',
            required: true,
            description: 'Type of section to generate (header, hero, content, etc.)'
          },
          {
            name: 'designDescription',
            type: 'string',
            required: true,
            description: 'Description of the design section'
          },
          {
            name: 'requirements',
            type: 'array',
            required: false,
            description: 'Specific requirements for the section'
          },
          {
            name: 'framework',
            type: 'string',
            required: false,
            description: 'CSS framework to use (Tailwind, Bootstrap, etc.)',
            defaultValue: 'vanilla'
          }
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          author: 'Templator Team',
          tags: ['generation', 'html', 'css', 'responsive']
        }
      }
    ];

    builtInPrompts.forEach(prompt => {
      this.promptsCache.set(prompt.id, prompt);
    });
  }

  /**
   * Load custom prompts from files
   */
  private async loadCustomPrompts(): Promise<void> {
    try {
      const files = await fs.readdir(this.promptsPath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.promptsPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const prompt = JSON.parse(content) as PromptTemplate;
          
          this.promptsCache.set(prompt.id, prompt);
          logger.debug('Loaded custom prompt', { id: prompt.id, file });
        } catch (error) {
          logger.warn('Failed to load prompt file', { file, error });
        }
      }
    } catch (error) {
      // Directory doesn't exist or is empty, which is fine
    }
  }

  /**
   * Validate context against template variables
   */
  private validateContext(template: PromptTemplate, context: PromptContext): void {
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in context)) {
        throw new Error(`Required variable missing: ${variable.name}`);
      }

      if (variable.name in context) {
        const value = context[variable.name];
        
        // Type validation
        if (variable.type === 'string' && typeof value !== 'string') {
          throw new Error(`Variable ${variable.name} must be a string`);
        }
        if (variable.type === 'number' && typeof value !== 'number') {
          throw new Error(`Variable ${variable.name} must be a number`);
        }
        if (variable.type === 'boolean' && typeof value !== 'boolean') {
          throw new Error(`Variable ${variable.name} must be a boolean`);
        }
        if (variable.type === 'array' && !Array.isArray(value)) {
          throw new Error(`Variable ${variable.name} must be an array`);
        }

        // Additional validation
        if (variable.validation) {
          if (variable.validation.minLength && value.length < variable.validation.minLength) {
            throw new Error(`Variable ${variable.name} must be at least ${variable.validation.minLength} characters`);
          }
          if (variable.validation.maxLength && value.length > variable.validation.maxLength) {
            throw new Error(`Variable ${variable.name} must be at most ${variable.validation.maxLength} characters`);
          }
          if (variable.validation.enum && !variable.validation.enum.includes(value)) {
            throw new Error(`Variable ${variable.name} must be one of: ${variable.validation.enum.join(', ')}`);
          }
        }
      }
    }
  }

  /**
   * Render template with context using simple templating
   */
  private renderTemplate(template: string, context: PromptContext): string {
    let rendered = template;

    // Replace simple variables {{variable}}
    rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return context[variable] !== undefined ? String(context[variable]) : match;
    });

    // Handle conditional blocks {{#if condition}}...{{/if}}
    rendered = rendered.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      return context[condition] ? content : '';
    });

    // Handle each loops {{#each array}}...{{/each}}
    rendered = rendered.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, content) => {
      const array = context[arrayName];
      if (Array.isArray(array)) {
        return array.map(item => content.replace(/\{\{this\}\}/g, String(item))).join('');
      }
      return '';
    });

    // Handle join helper {{join array ", "}}
    rendered = rendered.replace(/\{\{join (\w+) "([^"]+)"\}\}/g, (match, arrayName, separator) => {
      const array = context[arrayName];
      if (Array.isArray(array)) {
        return array.join(separator);
      }
      return '';
    });

    return rendered;
  }

  /**
   * Get all available prompts
   */
  getAvailablePrompts(): PromptTemplate[] {
    return Array.from(this.promptsCache.values());
  }

  /**
   * Get prompts by category
   */
  getPromptsByCategory(category: string): PromptTemplate[] {
    return Array.from(this.promptsCache.values()).filter(p => p.category === category);
  }

  /**
   * Get prompt categories
   */
  getPromptCategories(): string[] {
    const categories = new Set(Array.from(this.promptsCache.values()).map(p => p.category));
    return Array.from(categories);
  }

  /**
   * Ensure prompts directory exists
   */
  private async ensurePromptsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.promptsPath, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }
}

export default PromptManager.getInstance();
