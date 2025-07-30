import { createLogger } from '../../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import openaiService from '../ai/openaiService';

const logger = createLogger();

export interface ImageContext {
  type: 'logo' | 'hero' | 'product' | 'avatar' | 'icon' | 'background' | 'generic';
  description?: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface ProcessedImage {
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  type: 'extracted' | 'placeholder' | 'generated';
  context: ImageContext;
}

class ImageHandlingService {
  private static instance: ImageHandlingService;
  private openaiService = openaiService;
  private imageDir: string;

  constructor() {
    this.imageDir = path.join(process.cwd(), 'storage', 'images');
    this.initializeImageStorage();
  }

  public static getInstance(): ImageHandlingService {
    if (!ImageHandlingService.instance) {
      ImageHandlingService.instance = new ImageHandlingService();
    }
    return ImageHandlingService.instance;
  }

  /**
   * Initialize image storage directory
   */
  private async initializeImageStorage(): Promise<void> {
    try {
      await fs.mkdir(this.imageDir, { recursive: true });
      logger.info('Image storage initialized', { imageDir: this.imageDir });
    } catch (error) {
      logger.error('Failed to initialize image storage', { error });
    }
  }

  /**
   * Process HTML to identify and replace image placeholders with actual images
   * Also proactively adds images to sections that don't have any
   */
  async processImagesInHTML(html: string, originalImageBase64?: string, sectionType?: string): Promise<string> {
    try {
      logger.info('Processing images in HTML', { sectionType });

      // First, proactively inject images if the section needs them but doesn't have any
      let enhancedHTML = await this.injectMissingImages(html, sectionType);

      // Replace any remaining external placeholder URLs with local data URIs
      enhancedHTML = this.replaceExternalPlaceholderURLs(enhancedHTML);

      // Find all img tags in the enhanced HTML
      const imgRegex = /<img[^>]*>/gi;
      const imgTags = enhancedHTML.match(imgRegex) || [];

      if (imgTags.length === 0) {
        logger.info('No image tags found in HTML after injection');
        return enhancedHTML;
      }

      let processedHTML = enhancedHTML;

      for (const imgTag of imgTags) {
        const context = this.analyzeImageContext(imgTag, processedHTML);
        const processedImage = await this.getImageForContext(context, originalImageBase64);
        
        // Replace the img tag with the processed one
        const updatedImgTag = this.updateImageTag(imgTag, processedImage);
        processedHTML = processedHTML.replace(imgTag, updatedImgTag);
      }

      logger.info('Image processing completed', { 
        originalImages: imgTags.length,
        processedImages: imgTags.length,
        sectionType
      });

      return processedHTML;
    } catch (error) {
      logger.error('Failed to process images in HTML', { error, sectionType });
      return html; // Return original HTML if processing fails
    }
  }

  /**
   * Proactively inject images into sections that don't have any but should
   */
  private async injectMissingImages(html: string, sectionType?: string): Promise<string> {
    try {
      // Check if HTML already has images
      const hasImages = /<img[^>]*>/gi.test(html);
      
      if (hasImages) {
        logger.info('Section already has images, skipping injection', { sectionType });
        return html;
      }

      // Define section types that should have images
      const sectionImageRequirements = {
        header: {
          shouldHaveImage: true,
          imageType: 'logo',
          insertionPoint: 'after-first-div',
          imageHtml: '<img src="/placeholder/logo.png" alt="Company Logo" class="h-10 w-auto" loading="lazy">'
        },
        hero: {
          shouldHaveImage: true,
          imageType: 'hero',
          insertionPoint: 'before-button-or-end',
          imageHtml: '<img src="/placeholder/hero.jpg" alt="Hero Image" class="w-full h-96 object-cover rounded-lg" loading="lazy">'
        },
        content: {
          shouldHaveImage: true,
          imageType: 'content',
          insertionPoint: 'after-heading',
          imageHtml: '<img src="/placeholder/content.jpg" alt="Content Image" class="w-full h-auto rounded-lg mb-4" loading="lazy">'
        },
        footer: {
          shouldHaveImage: true,
          imageType: 'icon',
          insertionPoint: 'in-social-section',
          imageHtml: '<div class="flex space-x-4"><img src="/placeholder/facebook.png" alt="Facebook" class="w-6 h-6" loading="lazy"><img src="/placeholder/twitter.png" alt="Twitter" class="w-6 h-6" loading="lazy"><img src="/placeholder/linkedin.png" alt="LinkedIn" class="w-6 h-6" loading="lazy"></div>'
        },
        navigation: {
          shouldHaveImage: true,
          imageType: 'icon',
          insertionPoint: 'mobile-menu',
          imageHtml: '<img src="/placeholder/menu.svg" alt="Menu" class="w-6 h-6 md:hidden" loading="lazy">'
        },
        sidebar: {
          shouldHaveImage: true,
          imageType: 'widget',
          insertionPoint: 'in-widget',
          imageHtml: '<img src="/placeholder/widget.jpg" alt="Widget Image" class="w-full h-32 object-cover rounded mb-2" loading="lazy">'
        }
      };

      const requirement = sectionImageRequirements[sectionType as keyof typeof sectionImageRequirements];
      
      if (!requirement || !requirement.shouldHaveImage) {
        logger.info('Section type does not require image injection', { sectionType });
        return html;
      }

      // Inject image based on section type and insertion point
      let enhancedHTML = html;
      
      switch (requirement.insertionPoint) {
        case 'after-first-div':
          // Insert after the first div (typically for headers with logo)
          enhancedHTML = html.replace(/(<div[^>]*>)/, `$1\n      ${requirement.imageHtml}`);
          break;
          
        case 'before-button-or-end':
          // Insert before button or at the end of main content (for hero sections)
          if (html.includes('<button')) {
            enhancedHTML = html.replace(/(<button[^>]*>)/, `${requirement.imageHtml}\n      $1`);
          } else {
            enhancedHTML = html.replace(/(<\/div>\s*<\/section>)/, `  ${requirement.imageHtml}\n    $1`);
          }
          break;
          
        case 'after-heading':
          // Insert after h1, h2, or h3 (for content sections)
          enhancedHTML = html.replace(/(<\/h[1-3]>)/, `$1\n      ${requirement.imageHtml}`);
          break;
          
        case 'in-social-section':
          // Insert social media icons in footer
          if (html.includes('social') || html.includes('Social')) {
            enhancedHTML = html.replace(/(social[^>]*>)/, `$1\n        ${requirement.imageHtml}`);
          } else {
            enhancedHTML = html.replace(/(<\/div>\s*<\/footer>)/, `    ${requirement.imageHtml}\n  $1`);
          }
          break;
          
        case 'mobile-menu':
          // Insert mobile menu icon in navigation
          enhancedHTML = html.replace(/(<nav[^>]*>)/, `$1\n      ${requirement.imageHtml}`);
          break;
          
        case 'in-widget':
          // Insert widget image in sidebar
          enhancedHTML = html.replace(/(<div[^>]*class[^>]*widget[^>]*>)/, `$1\n      ${requirement.imageHtml}`);
          break;
          
        default:
          // Fallback: insert at the beginning of the main content area
          enhancedHTML = html.replace(/(<div[^>]*class[^>]*container[^>]*>)/, `$1\n    ${requirement.imageHtml}`);
      }

      if (enhancedHTML !== html) {
        logger.info('Successfully injected image into section', { 
          sectionType, 
          imageType: requirement.imageType,
          insertionPoint: requirement.insertionPoint
        });
      } else {
        logger.warn('Failed to inject image - no suitable insertion point found', { sectionType });
      }

      return enhancedHTML;
      
    } catch (error) {
      logger.error('Failed to inject missing images', { error, sectionType });
      return html; // Return original HTML if injection fails
    }
  }

  /**
   * Analyze image context from img tag and surrounding HTML
   */
  private analyzeImageContext(imgTag: string, html: string): ImageContext {
    const srcMatch = imgTag.match(/src=["']([^"']*)["']/i);
    const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
    const classMatch = imgTag.match(/class=["']([^"']*)["']/i);
    
    const src = srcMatch?.[1] || '';
    const alt = altMatch?.[1] || '';
    const classes = classMatch?.[1] || '';

    // Analyze context based on attributes and surrounding content
    let type: ImageContext['type'] = 'generic';
    
    if (alt.toLowerCase().includes('logo') || classes.includes('logo') || src.includes('logo')) {
      type = 'logo';
    } else if (alt.toLowerCase().includes('hero') || classes.includes('hero') || classes.includes('banner')) {
      type = 'hero';
    } else if (alt.toLowerCase().includes('product') || classes.includes('product')) {
      type = 'product';
    } else if (alt.toLowerCase().includes('avatar') || alt.toLowerCase().includes('profile') || classes.includes('avatar')) {
      type = 'avatar';
    } else if (alt.toLowerCase().includes('icon') || classes.includes('icon')) {
      type = 'icon';
    } else if (classes.includes('background') || classes.includes('bg-')) {
      type = 'background';
    }

    // Extract dimensions if available
    const widthMatch = imgTag.match(/width=["']?(\d+)["']?/i);
    const heightMatch = imgTag.match(/height=["']?(\d+)["']?/i);

    return {
      type,
      description: alt || `${type} image`,
      width: widthMatch ? parseInt(widthMatch[1]) : undefined,
      height: heightMatch ? parseInt(heightMatch[1]) : undefined,
      alt: alt || `${type} image`
    };
  }

  /**
   * Get appropriate image for the given context
   */
  private async getImageForContext(context: ImageContext, originalImageBase64?: string): Promise<ProcessedImage> {
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Try to extract from original design first
    if (originalImageBase64) {
      try {
        const extractedImage = await this.extractImageFromDesign(context, originalImageBase64);
        if (extractedImage) {
          return {
            id: imageId,
            src: extractedImage,
            alt: context.alt || context.description || 'Extracted image',
            width: context.width,
            height: context.height,
            type: 'extracted',
            context
          };
        }
      } catch (error) {
        logger.warn('Failed to extract image from design, using placeholder', { error });
      }
    }

    // Fallback to smart placeholder
    const placeholderSrc = this.getSmartPlaceholder(context);
    
    return {
      id: imageId,
      src: placeholderSrc,
      alt: context.alt || context.description || 'Placeholder image',
      width: context.width,
      height: context.height,
      type: 'placeholder',
      context
    };
  }

  /**
   * Extract image from original design using OpenAI Vision
   */
  private async extractImageFromDesign(context: ImageContext, originalImageBase64: string): Promise<string | null> {
    try {
      // This would use OpenAI Vision API to identify and extract specific image regions
      // For now, we'll return null to use placeholders
      // TODO: Implement actual image extraction logic
      logger.info('Image extraction from design not yet implemented, using placeholder');
      return null;
    } catch (error) {
      logger.error('Failed to extract image from design', { error });
      return null;
    }
  }

  /**
   * Get smart placeholder image based on context
   */
  private getSmartPlaceholder(context: ImageContext): string {
    const { type, width = 400, height = 300 } = context;
    
    // Use reliable local data URIs and CSS-based placeholders
    switch (type) {
      case 'logo':
        return this.generateDataURI(Math.min(width, 200), Math.min(height, 100), '#2563eb', '#ffffff', 'LOGO');
      
      case 'hero':
        return this.generateDataURI(width, height, '#6366f1', '#ffffff', 'HERO');
      
      case 'product':
        return this.generateDataURI(width, height, '#10b981', '#ffffff', 'PRODUCT');
      
      case 'avatar':
        const avatarSize = Math.min(width, height, 150);
        return this.generateDataURI(avatarSize, avatarSize, '#f59e0b', '#ffffff', '👤');
      
      case 'icon':
        const iconSize = Math.min(width, height, 64);
        return this.generateDataURI(iconSize, iconSize, '#6366f1', '#ffffff', '⭐');
      
      case 'background':
        return this.generateDataURI(width, height, '#e5e7eb', '#6b7280', 'BG');
      
      default:
        return this.generateDataURI(width, height, '#9ca3af', '#ffffff', 'IMAGE');
    }
  }

  /**
   * Replace ALL problematic image references with robust SVG data URIs
   * This method is bulletproof and catches every possible image reference issue
   */
  private replaceExternalPlaceholderURLs(html: string): string {
    let processedHTML = html;
    let replacementCount = 0;
    
    logger.info('Starting comprehensive image replacement', {
      originalLength: html.length,
      hasImgTags: /<img[^>]*>/gi.test(html)
    });
    
    // BULLETPROOF APPROACH: Replace ALL src attributes that are not already our SVG data URIs
    processedHTML = processedHTML.replace(
      /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
      (fullMatch: string, beforeSrc: string, srcValue: string, afterSrc: string) => {
        // Skip if it's already our processed SVG data URI
        if (srcValue.startsWith('data:image/svg+xml;base64,')) {
          return fullMatch;
        }
        
        // Log what we're replacing for debugging
        logger.info(`Found problematic image src: ${srcValue}`);
        
        // Determine image context from src value and surrounding attributes
        const context = this.determineImageContextFromSrc(srcValue, fullMatch);
        const dataUri = this.generateContextualDataURI(context);
        
        replacementCount++;
        logger.info(`Replaced: ${srcValue} -> ${context.type.toUpperCase()} SVG (${context.width}x${context.height})`);
        
        // Reconstruct the img tag with the new src
        return `<img${beforeSrc}src="${dataUri}"${afterSrc}>`;
      }
    );
    
    // Additional safety net: catch any remaining problematic patterns
    const problematicPatterns = [
      // Template variables like {{ logo_url }}
      /\{\{[^}]*\}\}/g,
      // Relative paths that might slip through
      /src=["'](?!\/|http|data:)([^"']*\.(jpg|jpeg|png|gif|svg|webp))["']/gi,
      // Localhost references
      /src=["']http:\/\/localhost:[0-9]+\/[^"']*["']/gi
    ];
    
    problematicPatterns.forEach((pattern, index) => {
      processedHTML = processedHTML.replace(pattern, (match) => {
        if (match.includes('{{')) {
          // Replace template variables with generic placeholder
          const genericDataUri = this.generateContextualDataURI({ 
            type: 'generic', 
            width: 200, 
            height: 80,
            bgColor: '#e5e7eb',
            textColor: '#6b7280',
            text: 'LOGO'
          });
          replacementCount++;
          logger.info(`Replaced template variable: ${match}`);
          return `src="${genericDataUri}"`;
        } else {
          // Replace other problematic patterns
          const genericDataUri = this.generateContextualDataURI({ 
            type: 'generic', 
            width: 400, 
            height: 300,
            bgColor: '#e5e7eb',
            textColor: '#6b7280',
            text: 'IMAGE'
          });
          replacementCount++;
          logger.info(`Replaced problematic pattern ${index}: ${match}`);
          return `src="${genericDataUri}"`;
        }
      });
    });
    
    logger.info('Comprehensive image replacement completed', {
      originalLength: html.length,
      processedLength: processedHTML.length,
      replacementCount,
      hasChanges: html !== processedHTML
    });
    
    return processedHTML;
  }
  
  /**
   * Determine image context from src value and img tag attributes
   */
  private determineImageContextFromSrc(srcValue: string, fullImgTag: string): {
    type: 'logo' | 'hero' | 'product' | 'avatar' | 'icon' | 'background' | 'feature' | 'generic';
    width: number;
    height: number;
    bgColor: string;
    textColor: string;
    text: string;
  } {
    const src = srcValue.toLowerCase();
    const imgTag = fullImgTag.toLowerCase();
    
    // Check for logo
    if (src.includes('logo') || imgTag.includes('logo') || imgTag.includes('brand')) {
      return {
        type: 'logo',
        width: 200,
        height: 80,
        bgColor: '#1f2937',
        textColor: '#ffffff',
        text: 'LOGO'
      };
    }
    
    // Check for hero images
    if (src.includes('hero') || src.includes('banner') || imgTag.includes('hero')) {
      return {
        type: 'hero',
        width: 800,
        height: 400,
        bgColor: '#6366f1',
        textColor: '#ffffff',
        text: 'HERO'
      };
    }
    
    // Check for feature images
    if (src.includes('feature') || imgTag.includes('feature')) {
      return {
        type: 'feature',
        width: 400,
        height: 250,
        bgColor: '#f3f4f6',
        textColor: '#374151',
        text: 'FEATURE'
      };
    }
    
    // Check for product images
    if (src.includes('product') || imgTag.includes('product')) {
      return {
        type: 'product',
        width: 300,
        height: 300,
        bgColor: '#f59e0b',
        textColor: '#ffffff',
        text: 'PRODUCT'
      };
    }
    
    // Check for avatar/profile images
    if (src.includes('avatar') || src.includes('profile') || imgTag.includes('avatar')) {
      return {
        type: 'avatar',
        width: 100,
        height: 100,
        bgColor: '#10b981',
        textColor: '#ffffff',
        text: '👤'
      };
    }
    
    // Check for icons
    if (src.includes('icon') || imgTag.includes('icon') || imgTag.includes('w-4') || imgTag.includes('h-4')) {
      return {
        type: 'icon',
        width: 32,
        height: 32,
        bgColor: '#3b82f6',
        textColor: '#ffffff',
        text: '⭐'
      };
    }
    
    // Check for background images
    if (src.includes('background') || src.includes('bg-') || imgTag.includes('background')) {
      return {
        type: 'background',
        width: 1200,
        height: 600,
        bgColor: '#6b7280',
        textColor: '#ffffff',
        text: 'BG'
      };
    }
    
    // Default generic image
    return {
      type: 'generic',
      width: 400,
      height: 300,
      bgColor: '#e5e7eb',
      textColor: '#6b7280',
      text: 'IMAGE'
    };
  }
  
  /**
   * Generate contextual data URI based on image context
   */
  private generateContextualDataURI(context: {
    type: string;
    width: number;
    height: number;
    bgColor: string;
    textColor: string;
    text: string;
  }): string {
    return this.generateDataURI(
      context.width,
      context.height,
      context.bgColor,
      context.textColor,
      context.text
    );
  }

  /**
   * Generate a data URI for a placeholder image using SVG
   */
  private generateDataURI(width: number, height: number, bgColor: string, textColor: string, text: string): string {
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${bgColor}"/>
        <text x="50%" y="50%" text-anchor="middle" dy="0.35em" 
              font-family="system-ui, -apple-system, sans-serif" 
              font-size="${Math.min(width, height) / 8}" 
              fill="${textColor}">${text}</text>
      </svg>
    `;
    
    const base64 = Buffer.from(svg.trim()).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }

  /**
   * Update img tag with processed image information
   */
  private updateImageTag(originalTag: string, processedImage: ProcessedImage): string {
    let updatedTag = originalTag;
    
    // Update src
    updatedTag = updatedTag.replace(/src=["'][^"']*["']/i, `src="${processedImage.src}"`);
    
    // Update alt if not present or generic
    if (!originalTag.match(/alt=["'][^"']*["']/i) || originalTag.includes('alt=""')) {
      updatedTag = updatedTag.replace(/<img/, `<img alt="${processedImage.alt}"`);
    }
    
    // Add loading="lazy" for performance
    if (!updatedTag.includes('loading=')) {
      updatedTag = updatedTag.replace(/<img/, '<img loading="lazy"');
    }
    
    // Add dimensions if available and not present
    if (processedImage.width && !updatedTag.includes('width=')) {
      updatedTag = updatedTag.replace(/<img/, `<img width="${processedImage.width}"`);
    }
    
    if (processedImage.height && !updatedTag.includes('height=')) {
      updatedTag = updatedTag.replace(/<img/, `<img height="${processedImage.height}"`);
    }

    return updatedTag;
  }

  /**
   * Generate contextual dummy images for common website elements
   */
  generateContextualImage(context: ImageContext): ProcessedImage {
    const imageId = `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const src = this.getSmartPlaceholder(context);
    
    return {
      id: imageId,
      src,
      alt: context.alt || context.description || 'Generated image',
      width: context.width,
      height: context.height,
      type: 'placeholder',
      context
    };
  }

  /**
   * Get image statistics for reporting
   */
  async getImageStats(): Promise<{
    totalImages: number;
    extractedImages: number;
    placeholderImages: number;
    generatedImages: number;
  }> {
    // This would track image usage statistics
    return {
      totalImages: 0,
      extractedImages: 0,
      placeholderImages: 0,
      generatedImages: 0
    };
  }
}

export default ImageHandlingService;
