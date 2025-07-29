import { createLogger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import openaiService from './openaiService';

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
   */
  async processImagesInHTML(html: string, originalImageBase64?: string): Promise<string> {
    try {
      logger.info('Processing images in HTML');

      // Find all img tags in the HTML
      const imgRegex = /<img[^>]*>/gi;
      const imgTags = html.match(imgRegex) || [];

      if (imgTags.length === 0) {
        logger.info('No image tags found in HTML');
        return html;
      }

      let processedHTML = html;

      for (const imgTag of imgTags) {
        const context = this.analyzeImageContext(imgTag, html);
        const processedImage = await this.getImageForContext(context, originalImageBase64);
        
        // Replace the img tag with the processed one
        const updatedImgTag = this.updateImageTag(imgTag, processedImage);
        processedHTML = processedHTML.replace(imgTag, updatedImgTag);
      }

      logger.info('Image processing completed', { 
        originalImages: imgTags.length,
        processedImages: imgTags.length
      });

      return processedHTML;
    } catch (error) {
      logger.error('Failed to process images in HTML', { error });
      return html; // Return original HTML if processing fails
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
    
    // Use different placeholder services based on image type
    switch (type) {
      case 'logo':
        return `https://via.placeholder.com/${Math.min(width, 200)}x${Math.min(height, 100)}/2563eb/ffffff?text=LOGO`;
      
      case 'hero':
        return `https://picsum.photos/${width}/${height}?random=1`;
      
      case 'product':
        return `https://picsum.photos/${width}/${height}?random=2`;
      
      case 'avatar':
        const avatarSize = Math.min(width, height, 150);
        return `https://i.pravatar.cc/${avatarSize}?random=${Math.floor(Math.random() * 100)}`;
      
      case 'icon':
        const iconSize = Math.min(width, height, 64);
        return `https://via.placeholder.com/${iconSize}x${iconSize}/6366f1/ffffff?text=⭐`;
      
      case 'background':
        return `https://picsum.photos/${width}/${height}?random=3&blur=2`;
      
      default:
        return `https://picsum.photos/${width}/${height}?random=${Math.floor(Math.random() * 1000)}`;
    }
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
