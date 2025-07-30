import { JSDOM } from 'jsdom';
import { createError } from '../../middleware/errorHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

export class ParserService {
  private tailwindClasses = {
    // Container and layout
    container: 'container mx-auto px-4',
    section: 'py-12 md:py-20',
    
    // Typography
    h1: 'text-3xl md:text-5xl font-bold',
    h2: 'text-2xl md:text-4xl font-semibold',
    h3: 'text-xl md:text-2xl font-medium',
    p: 'text-base md:text-lg',
    
    // Spacing
    mb: 'mb-4 md:mb-6',
    mt: 'mt-4 md:mt-6',
    
    // Buttons
    btn: 'inline-block px-6 py-3 rounded-lg font-medium transition-colors',
    'btn-primary': 'bg-blue-600 text-white hover:bg-blue-700',
    'btn-secondary': 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    
    // Images
    img: 'max-w-full h-auto rounded-lg',
    
    // Flex and Grid
    flex: 'flex',
    'flex-col': 'flex-col',
    'items-center': 'items-center',
    'justify-center': 'justify-center',
    'text-center': 'text-center',
    grid: 'grid',
    'grid-cols-1': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    gap: 'gap-6',
  };

  async parseAndNormalize(payload: string, sourceType: 'html' | 'json_component'): Promise<string> {
    try {
      if (sourceType === 'json_component') {
        return this.parseJsonComponent(payload);
      }
      
      return this.parseHtml(payload);
    } catch (error) {
      logger.error('Parse error:', error);
      throw createError(
        'Failed to parse input',
        400,
        'INPUT_INVALID',
        error instanceof Error ? error.message : 'Unknown parsing error',
        'Please check your HTML syntax and try again'
      );
    }
  }

  private parseHtml(htmlString: string): string {
    // Create DOM from HTML string
    const dom = new JSDOM(htmlString);
    const document = dom.window.document;
    
    // Remove script tags for security
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // Remove inline event handlers
    const allElements = document.querySelectorAll('*');
    allElements.forEach(element => {
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          element.removeAttribute(attr.name);
        }
      });
    });
    
    // Normalize structure - ensure we have a proper container
    let rootElement = document.body || document.documentElement;
    
    // If no body, create one
    if (!document.body) {
      const body = document.createElement('body');
      while (rootElement.firstChild) {
        body.appendChild(rootElement.firstChild);
      }
      rootElement = body;
    }
    
    // Apply mobile-first responsive classes
    this.applyResponsiveClasses(rootElement);
    
    // Clean up and return HTML
    return this.cleanupHtml(rootElement.innerHTML);
  }

  private parseJsonComponent(jsonString: string): string {
    // For MVP, we'll implement basic JSON to HTML conversion
    // This can be expanded later for more complex design systems
    try {
      const component = JSON.parse(jsonString);
      return this.jsonToHtml(component);
    } catch (error) {
      throw createError(
        'Invalid JSON format',
        400,
        'INPUT_INVALID',
        'The provided JSON is not valid',
        'Please check your JSON syntax'
      );
    }
  }

  private jsonToHtml(component: any): string {
    // Basic JSON to HTML conversion for MVP
    // This is a simplified implementation
    if (typeof component === 'string') {
      return `<p>${component}</p>`;
    }
    
    if (component.type === 'section') {
      const children = component.children?.map((child: any) => this.jsonToHtml(child)).join('') || '';
      return `<section class="py-12 md:py-20">${children}</section>`;
    }
    
    if (component.type === 'heading') {
      const level = component.level || 1;
      const text = component.text || 'Heading';
      return `<h${level} data-field="headline" class="${this.tailwindClasses[`h${level}` as keyof typeof this.tailwindClasses] || this.tailwindClasses.h1}">${text}</h${level}>`;
    }
    
    if (component.type === 'text') {
      const text = component.text || 'Text content';
      return `<p data-field="body" class="${this.tailwindClasses.p}">${text}</p>`;
    }
    
    if (component.type === 'image') {
      const src = component.src || '/placeholder.jpg';
      const alt = component.alt || 'Image';
      return `<img data-field="image_main" src="${src}" alt="${alt}" class="${this.tailwindClasses.img}" />`;
    }
    
    if (component.type === 'button') {
      const text = component.text || 'Button';
      const href = component.href || '#';
      const variant = component.variant || 'primary';
      return `<a data-field="cta_primary" href="${href}" class="${this.tailwindClasses.btn} ${this.tailwindClasses[`btn-${variant}` as keyof typeof this.tailwindClasses]}">${text}</a>`;
    }
    
    return '<div>Unknown component type</div>';
  }

  private applyResponsiveClasses(element: Element): void {
    const tagName = element.tagName.toLowerCase();
    
    // Apply container classes to sections
    if (tagName === 'section' || element.classList.contains('section')) {
      if (!element.classList.contains('container') && !element.querySelector('.container')) {
        element.classList.add('py-12', 'md:py-20');
        
        // Wrap content in container if not already present
        const containerDiv = element.ownerDocument.createElement('div');
        containerDiv.className = 'container mx-auto px-4';
        
        while (element.firstChild) {
          containerDiv.appendChild(element.firstChild);
        }
        element.appendChild(containerDiv);
      }
    }
    
    // Apply typography classes
    if (tagName === 'h1' && !this.hasResponsiveClasses(element)) {
      element.classList.add(...this.tailwindClasses.h1.split(' '));
    } else if (tagName === 'h2' && !this.hasResponsiveClasses(element)) {
      element.classList.add(...this.tailwindClasses.h2.split(' '));
    } else if (tagName === 'h3' && !this.hasResponsiveClasses(element)) {
      element.classList.add(...this.tailwindClasses.h3.split(' '));
    } else if (tagName === 'p' && !this.hasResponsiveClasses(element)) {
      element.classList.add(...this.tailwindClasses.p.split(' '));
    }
    
    // Apply button classes
    if ((tagName === 'a' && (element.classList.contains('btn') || element.classList.contains('button'))) ||
        (tagName === 'button')) {
      if (!this.hasResponsiveClasses(element)) {
        element.classList.add(...this.tailwindClasses.btn.split(' '));
        if (!element.classList.contains('btn-secondary')) {
          element.classList.add(...this.tailwindClasses['btn-primary'].split(' '));
        }
      }
    }
    
    // Apply image classes
    if (tagName === 'img' && !this.hasResponsiveClasses(element)) {
      element.classList.add(...this.tailwindClasses.img.split(' '));
    }
    
    // Recursively apply to children
    Array.from(element.children).forEach(child => {
      this.applyResponsiveClasses(child);
    });
  }

  private hasResponsiveClasses(element: Element): boolean {
    const classList = Array.from(element.classList);
    return classList.some(cls => 
      cls.includes('md:') || 
      cls.includes('lg:') || 
      cls.includes('sm:') ||
      cls.includes('text-') ||
      cls.includes('font-') ||
      cls.includes('px-') ||
      cls.includes('py-') ||
      cls.includes('bg-')
    );
  }

  private cleanupHtml(html: string): string {
    // Remove empty attributes and clean up whitespace
    return html
      .replace(/\s+class=""/g, '')
      .replace(/\s+style=""/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
