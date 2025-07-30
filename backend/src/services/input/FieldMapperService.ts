import { JSDOM } from 'jsdom';
import { DetectedField, DEFAULT_FIELD_MAPPING_RULES } from '../../../../shared/types';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

export class FieldMapperService {
  async detectFields(htmlContent: string): Promise<DetectedField[]> {
    try {
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;
      const detectedFields: DetectedField[] = [];
      const usedIds = new Set<string>();

      // First pass: Look for explicit data-field attributes
      const explicitFields = document.querySelectorAll('[data-field]');
      explicitFields.forEach(element => {
        const fieldId = element.getAttribute('data-field');
        if (!fieldId || usedIds.has(fieldId)) return;

        const field = this.createFieldFromElement(element, fieldId);
        if (field) {
          detectedFields.push(field);
          usedIds.add(fieldId);
        }
      });

      // Second pass: Apply heuristic rules for elements without data-field
      for (const rule of DEFAULT_FIELD_MAPPING_RULES) {
        const elements = document.querySelectorAll(rule.selector);
        
        elements.forEach((element, index) => {
          // Skip if element already has data-field attribute
          if (element.hasAttribute('data-field')) return;
          
          // Generate unique field ID
          let fieldId = rule.fieldId;
          if (index > 0 || usedIds.has(fieldId)) {
            fieldId = `${rule.fieldId}_${index + 1}`;
          }
          
          // Skip if ID is still in use
          if (usedIds.has(fieldId)) return;

          const field = this.createFieldFromRule(element, rule, fieldId);
          if (field) {
            detectedFields.push(field);
            usedIds.add(fieldId);
          }
        });
      }

      logger.info('Field detection completed', {
        total_fields: detectedFields.length,
        explicit_fields: explicitFields.length,
        heuristic_fields: detectedFields.length - explicitFields.length,
      });

      return detectedFields;
    } catch (error) {
      logger.error('Field detection error:', error);
      return [];
    }
  }

  private createFieldFromElement(element: Element, fieldId: string): DetectedField | null {
    const tagName = element.tagName.toLowerCase();
    const textContent = element.textContent?.trim() || '';
    
    // Determine field type based on element
    let fieldType: DetectedField['type'] = 'text';
    let label = this.generateLabel(fieldId);
    
    if (tagName === 'img') {
      fieldType = 'image';
      label = element.getAttribute('alt') || 'Image';
    } else if (tagName === 'a' || element.classList.contains('btn') || element.classList.contains('button')) {
      fieldType = 'url';
      label = 'Link';
    } else if (tagName === 'p' || element.classList.contains('copy') || element.classList.contains('text')) {
      fieldType = 'richtext';
    } else if (tagName.match(/^h[1-6]$/)) {
      fieldType = 'text';
    }

    return {
      id: fieldId,
      label,
      type: fieldType,
      selector: `[data-field="${fieldId}"]`,
      required: this.isRequiredField(fieldId, tagName),
      default: this.getDefaultValue(element, fieldType),
    };
  }

  private createFieldFromRule(element: Element, rule: any, fieldId: string): DetectedField | null {
    return {
      id: fieldId,
      label: rule.label,
      type: rule.fieldType,
      selector: rule.selector,
      required: rule.required || false,
      default: this.getDefaultValue(element, rule.fieldType),
    };
  }

  private generateLabel(fieldId: string): string {
    // Convert field ID to human-readable label
    return fieldId
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private isRequiredField(fieldId: string, tagName: string): boolean {
    // Headlines are typically required
    if (fieldId.includes('headline') || tagName === 'h1') {
      return true;
    }
    
    // Main images are often required
    if (fieldId.includes('image_main')) {
      return true;
    }
    
    return false;
  }

  private getDefaultValue(element: Element, fieldType: DetectedField['type']): string {
    const tagName = element.tagName.toLowerCase();
    
    // Handle field types first
    switch (fieldType) {
      case 'image': {
        const alt = element.getAttribute('alt');
        return alt || 'Image placeholder';
      }
      case 'url': {
        const href = element.getAttribute('href');
        return href || '#';
      }
      case 'choice':
        return 'md';
    }
    
    // For text and richtext fields, try to use existing content
    const textContent = element.textContent?.trim() || '';
    
    if (textContent) {
      // Limit default text length
      return textContent.length > 100 
        ? textContent.substring(0, 100) + '...' 
        : textContent;
    }
    
    // Generate appropriate placeholder based on tag
    if (tagName === 'h1') return 'Main Headline';
    if (tagName === 'h2') return 'Section Headline';
    if (tagName === 'h3') return 'Subheading';
    if (tagName === 'p') return 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
    
    return 'Content placeholder';
  }

  // Helper method to validate and clean field configurations
  validateFieldConfig(fields: Partial<DetectedField>[]): DetectedField[] {
    return fields
      .filter(field => field.id && field.type)
      .map(field => ({
        id: field.id!,
        label: field.label || this.generateLabel(field.id!),
        type: field.type!,
        selector: field.selector || `[data-field="${field.id}"]`,
        required: field.required || false,
        default: field.default || '',
      }));
  }
}
