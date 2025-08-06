import { createLogger } from '../../../utils/logger';
import { OpenAIClient } from '../../core/ai/OpenAIClient';

const logger = createLogger();

export interface HubSpotModule {
  id: string;
  name: string;
  label: string;
  css: string;
  html: string;
  fields: HubSpotField[];
  meta: {
    version: string;
    created_at: string;
    updated_at: string;
  };
}

export interface HubSpotField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'richtext' | 'image' | 'url' | 'color' | 'boolean' | 'choice';
  required: boolean;
  default?: any;
  help_text?: string;
  choices?: Array<{ value: string; label: string }>;
}

export interface ModuleBuildOptions {
  includeResponsive?: boolean;
  includeAccessibility?: boolean;
  optimizeForPerformance?: boolean;
  generateFields?: boolean;
}

/**
 * HubSpot Module Builder Service
 * Consolidated from the original HubSpotModuleBuilder with improved structure
 */
export class ModuleBuilder {
  private static instance: ModuleBuilder;
  private openaiClient: OpenAIClient;

  public static getInstance(): ModuleBuilder {
    if (!ModuleBuilder.instance) {
      ModuleBuilder.instance = new ModuleBuilder();
    }
    return ModuleBuilder.instance;
  }

  private constructor() {
    this.openaiClient = OpenAIClient.getInstance();
  }

  /**
   * Build a complete HubSpot module from HTML and CSS
   */
  async buildModule(
    html: string,
    css: string,
    options: ModuleBuildOptions & {
      name: string;
      label: string;
    }
  ): Promise<HubSpotModule> {
    try {
      logger.info('Building HubSpot module', {
        name: options.name,
        htmlLength: html.length,
        cssLength: css.length,
        options
      });

      // Generate editable fields if requested
      let fields: HubSpotField[] = [];
      if (options.generateFields !== false) {
        fields = await this.generateEditableFields(html);
      }

      // Process HTML for HubSpot compatibility
      const processedHtml = this.processHtmlForHubSpot(html, fields);

      // Process CSS for HubSpot compatibility
      const processedCss = this.processCssForHubSpot(css);

      // Create module structure
      const module: HubSpotModule = {
        id: this.generateModuleId(options.name),
        name: options.name,
        label: options.label,
        html: processedHtml,
        css: processedCss,
        fields,
        meta: {
          version: '1.0.0',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };

      logger.info('HubSpot module built successfully', {
        moduleId: module.id,
        fieldsCount: fields.length
      });

      return module;

    } catch (error) {
      logger.error('Failed to build HubSpot module', {
        error: error instanceof Error ? error.message : 'Unknown error',
        name: options.name
      });
      throw error;
    }
  }

  /**
   * Generate editable fields from HTML content
   */
  async generateEditableFields(html: string): Promise<HubSpotField[]> {
    try {
      const prompt = `
Analyze this HTML and identify elements that should be editable in a HubSpot module.

HTML:
${html}

Generate a JSON array of editable fields with this structure:
[
  {
    "id": "field_id",
    "name": "field_name", 
    "label": "Field Label",
    "type": "text|richtext|image|url|color|boolean|choice",
    "required": true|false,
    "default": "default_value",
    "help_text": "Help text for the field"
  }
]

Focus on:
- Text content that should be editable
- Images that should be replaceable
- Links that should be configurable
- Colors that should be customizable
- Boolean toggles for show/hide elements

Return only the JSON array, no other text.
`;

      const response = await this.openaiClient.chatCompletion([
        { role: 'user', content: prompt }
      ], { maxTokens: 1500 });

      const content = response.choices[0].message.content;
      const fields = JSON.parse(content);

      return fields.map((field: any, index: number) => ({
        id: field.id || `field_${index + 1}`,
        name: field.name || `field_${index + 1}`,
        label: field.label || `Field ${index + 1}`,
        type: field.type || 'text',
        required: field.required || false,
        default: field.default,
        help_text: field.help_text
      }));

    } catch (error) {
      logger.warn('Failed to generate editable fields, using fallback', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Fallback: create basic fields for common elements
      return this.generateBasicFields(html);
    }
  }

  /**
   * Generate basic fallback fields
   */
  private generateBasicFields(html: string): HubSpotField[] {
    const fields: HubSpotField[] = [];

    // Check for headings
    const headings = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi);
    if (headings && headings.length > 0) {
      fields.push({
        id: 'heading_text',
        name: 'heading_text',
        label: 'Heading Text',
        type: 'text',
        required: true,
        default: 'Your Heading Here'
      });
    }

    // Check for paragraphs
    const paragraphs = html.match(/<p[^>]*>(.*?)<\/p>/gi);
    if (paragraphs && paragraphs.length > 0) {
      fields.push({
        id: 'body_text',
        name: 'body_text',
        label: 'Body Text',
        type: 'richtext',
        required: false,
        default: 'Your content here...'
      });
    }

    // Check for images
    const images = html.match(/<img[^>]*>/gi);
    if (images && images.length > 0) {
      fields.push({
        id: 'image_src',
        name: 'image_src',
        label: 'Image',
        type: 'image',
        required: false
      });
    }

    // Check for links
    const links = html.match(/<a[^>]*href/gi);
    if (links && links.length > 0) {
      fields.push({
        id: 'link_url',
        name: 'link_url',
        label: 'Link URL',
        type: 'url',
        required: false
      });
    }

    return fields;
  }

  /**
   * Process HTML for HubSpot compatibility
   */
  private processHtmlForHubSpot(html: string, fields: HubSpotField[]): string {
    let processedHtml = html;

    // Replace static content with HubSpot field references
    fields.forEach(field => {
      const fieldReference = `{{ module.${field.name} }}`;
      
      switch (field.type) {
        case 'text':
          // Replace heading text
          if (field.id.includes('heading')) {
            processedHtml = processedHtml.replace(
              /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi,
              `<h$1>${fieldReference}</h$1>`
            );
          }
          break;
        
        case 'richtext':
          // Replace paragraph content
          if (field.id.includes('body')) {
            processedHtml = processedHtml.replace(
              /<p[^>]*>(.*?)<\/p>/gi,
              `<p>${fieldReference}</p>`
            );
          }
          break;
        
        case 'image':
          // Replace image sources
          processedHtml = processedHtml.replace(
            /(<img[^>]*src=")[^"]*(")/gi,
            `$1${fieldReference}$2`
          );
          break;
        
        case 'url':
          // Replace link URLs
          processedHtml = processedHtml.replace(
            /(<a[^>]*href=")[^"]*(")/gi,
            `$1${fieldReference}$2`
          );
          break;
      }
    });

    return processedHtml;
  }

  /**
   * Process CSS for HubSpot compatibility
   */
  private processCssForHubSpot(css: string): string {
    // Add HubSpot-specific CSS optimizations
    let processedCss = css;

    // Ensure responsive design
    if (!processedCss.includes('@media')) {
      processedCss += `
/* Responsive Design */
@media (max-width: 768px) {
  .container {
    padding: 0 15px;
  }
  
  h1, h2, h3 {
    font-size: 1.2em;
  }
}`;
    }

    // Add HubSpot reset styles
    processedCss = `
/* HubSpot Module Styles */
.module-wrapper {
  box-sizing: border-box;
}

.module-wrapper * {
  box-sizing: inherit;
}

${processedCss}`;

    return processedCss;
  }

  /**
   * Generate unique module ID
   */
  private generateModuleId(name: string): string {
    const timestamp = Date.now();
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${sanitizedName}_${timestamp}`;
  }

  /**
   * Validate module structure
   */
  validateModule(module: HubSpotModule): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!module.name) errors.push('Module name is required');
    if (!module.label) errors.push('Module label is required');
    if (!module.html) errors.push('Module HTML is required');

    // Check HTML structure
    if (module.html && !module.html.includes('{{')) {
      warnings.push('No HubSpot field references found in HTML');
    }

    // Check fields
    if (module.fields.length === 0) {
      warnings.push('No editable fields defined');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export default ModuleBuilder.getInstance();
