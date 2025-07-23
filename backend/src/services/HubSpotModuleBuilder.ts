import archiver from 'archiver';
import { DetectedField, ModuleManifest } from '../../../shared/types';
import { createLogger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger();

interface ModuleGenerationResult {
  module_slug: string;
  download_url: string;
  manifest: ModuleManifest;
  zip_size: number;
}

export class HubSpotModuleBuilder {
  private moduleCache = new Map<string, Buffer>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  async generateModule(
    htmlContent: string,
    fields: DetectedField[]
  ): Promise<ModuleGenerationResult> {
    try {
      const moduleSlug = this.generateModuleSlug();
      const manifest = this.createManifest(moduleSlug, fields);
      
      // Generate module files
      const moduleHtml = this.generateModuleHtml(htmlContent, fields);
      const fieldsJson = this.generateFieldsJson(fields);
      const metaJson = this.generateMetaJson(moduleSlug);
      
      // Create ZIP buffer
      const zipBuffer = await this.createZipArchive(moduleSlug, {
        'module.html': moduleHtml,
        'fields.json': fieldsJson,
        'meta.json': metaJson,
        'module.css': '/* Custom styles can be added here */',
        'module.js': '// Custom JavaScript can be added here',
      });
      
      // Cache the ZIP file
      this.cacheModule(moduleSlug, zipBuffer);
      
      logger.info('HubSpot module generated', {
        module_slug: moduleSlug,
        fields_count: fields.length,
        zip_size: zipBuffer.length,
      });
      
      return {
        module_slug: moduleSlug,
        download_url: `/api/download/${moduleSlug}`,
        manifest,
        zip_size: zipBuffer.length,
      };
    } catch (error) {
      logger.error('Module generation failed:', error);
      throw createError(
        'Failed to generate HubSpot module',
        500,
        'EXPORT_FAILED',
        error instanceof Error ? error.message : 'Unknown error',
        'Please try again or contact support'
      );
    }
  }

  async getModuleZip(moduleSlug: string): Promise<Buffer | null> {
    // Check if module exists and is not expired
    const zipBuffer = this.moduleCache.get(moduleSlug);
    const expiry = this.cacheExpiry.get(moduleSlug);
    
    if (!zipBuffer || !expiry || Date.now() > expiry) {
      // Clean up expired entry
      this.moduleCache.delete(moduleSlug);
      this.cacheExpiry.delete(moduleSlug);
      return null;
    }
    
    return zipBuffer;
  }

  private generateModuleSlug(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `windsurf_${timestamp}_${random}`;
  }

  private createManifest(moduleSlug: string, fields: DetectedField[]): ModuleManifest {
    return {
      module_slug: moduleSlug,
      fields,
      version: '0.1.0',
      exported_at: new Date().toISOString(),
    };
  }

  private generateModuleHtml(htmlContent: string, fields: DetectedField[]): string {
    let moduleHtml = htmlContent;
    
    // Replace data-field attributes with HubL variables
    fields.forEach(field => {
      const dataFieldRegex = new RegExp(`data-field="${field.id}"`, 'g');
      moduleHtml = moduleHtml.replace(dataFieldRegex, '');
      
      // Replace content based on field type
      if (field.type === 'image') {
        // Replace img src and alt with HubL variables
        const imgRegex = new RegExp(`<img([^>]*?)src="[^"]*"([^>]*?)alt="[^"]*"([^>]*?)>`, 'g');
        moduleHtml = moduleHtml.replace(imgRegex, (match, before, middle, after) => {
          if (match.includes(`data-field="${field.id}"`)) {
            return `{% if module.${field.id}.src %}<img${before}src="{{ module.${field.id}.src }}"${middle}alt="{{ module.${field.id}.alt }}"${after}>{% endif %}`;
          }
          return match;
        });
      } else if (field.type === 'url') {
        // Replace anchor href and text with HubL variables
        const linkRegex = new RegExp(`<a([^>]*?)href="[^"]*"([^>]*?)>([^<]*?)</a>`, 'g');
        moduleHtml = moduleHtml.replace(linkRegex, (match, before, after, text) => {
          if (match.includes(`data-field="${field.id}"`)) {
            return `{% if module.${field.id}_url %}<a${before}href="{{ module.${field.id}_url }}"${after}>{{ module.${field.id}_text }}</a>{% endif %}`;
          }
          return match;
        });
      } else {
        // Replace text content with HubL variables
        const elementRegex = new RegExp(`(<[^>]*?data-field="${field.id}"[^>]*?>)([^<]*?)(<\/[^>]+>)`, 'g');
        moduleHtml = moduleHtml.replace(elementRegex, (match, openTag, content, closeTag) => {
          const cleanOpenTag = openTag.replace(`data-field="${field.id}"`, '').replace(/\s+/g, ' ');
          if (field.type === 'richtext') {
            return `{% if module.${field.id} %}${cleanOpenTag}{{ module.${field.id} }}${closeTag}{% endif %}`;
          } else {
            return `{% if module.${field.id} %}${cleanOpenTag}{{ module.${field.id} }}${closeTag}{% endif %}`;
          }
        });
      }
    });
    
    // Clean up any remaining data-field attributes
    moduleHtml = moduleHtml.replace(/\s*data-field="[^"]*"/g, '');
    
    // Add HubSpot module wrapper
    return `<!-- Windsurf Generated Module -->
<div class="windsurf-module">
${moduleHtml}
</div>`;
  }

  private generateFieldsJson(fields: DetectedField[]): string {
    const hubspotFields = fields.map(field => {
      const baseField = {
        name: field.id,
        label: field.label,
        required: field.required,
        locked: false,
        display: 'text_field',
        type: 'text',
      };

      // Map field types to HubSpot field types
      switch (field.type) {
        case 'richtext':
          return {
            ...baseField,
            type: 'richtext',
            display: 'rich_text',
          };
        case 'image':
          return {
            ...baseField,
            type: 'image',
            display: 'image',
            responsive: true,
          };
        case 'url':
          // For URL fields, we need both URL and text fields
          return [
            {
              ...baseField,
              name: `${field.id}_url`,
              label: `${field.label} URL`,
              type: 'url',
              display: 'text_field',
            },
            {
              ...baseField,
              name: `${field.id}_text`,
              label: `${field.label} Text`,
              type: 'text',
              display: 'text_field',
              default: field.default,
            }
          ];
        case 'choice':
          return {
            ...baseField,
            type: 'choice',
            display: 'select',
            choices: [
              ['sm', 'Small'],
              ['md', 'Medium'],
              ['lg', 'Large'],
            ],
            default: 'md',
          };
        default:
          return {
            ...baseField,
            default: field.default,
          };
      }
    }).flat();

    return JSON.stringify(hubspotFields, null, 2);
  }

  private generateMetaJson(moduleSlug: string): string {
    return JSON.stringify({
      label: `Windsurf Module - ${moduleSlug}`,
      css_assets: [],
      external_css: '',
      js_assets: [],
      external_js: '',
      tags: ['windsurf', 'generated', 'responsive'],
      host_template_types: ['PAGE', 'BLOG_POST', 'BLOG_LISTING'],
      module_id: null,
      is_available_for_new_content: true,
    }, null, 2);
  }

  private async createZipArchive(moduleSlug: string, files: Record<string, string>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
      
      // Add files to archive
      Object.entries(files).forEach(([filename, content]) => {
        archive.append(content, { name: `${moduleSlug}/${filename}` });
      });
      
      archive.finalize();
    });
  }

  private cacheModule(moduleSlug: string, zipBuffer: Buffer): void {
    this.moduleCache.set(moduleSlug, zipBuffer);
    this.cacheExpiry.set(moduleSlug, Date.now() + this.CACHE_TTL);
    
    // Clean up expired entries
    this.cleanupExpiredCache();
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [slug, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.moduleCache.delete(slug);
        this.cacheExpiry.delete(slug);
      }
    }
  }
}
