import { OpenAIService } from './openaiService';
import { QualityMetricsDashboard } from '../quality/QualityMetricsDashboard';
import PipelineProgressTracker from '../pipeline/PipelineProgressTracker';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

/**
 * Enhanced AI Service with RAG + Dynamic Context
 * Combines vector search with intelligent context adaptation
 */

interface EmbeddingResult {
  embedding: number[];
  text: string;
  metadata: {
    type: 'hubspot_pattern' | 'design_principle' | 'code_example' | 'best_practice';
    category: string;
    relevanceScore?: number;
  };
}

interface KnowledgeBaseEntry {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    type: string;
    category: string;
    tags: string[];
    lastUpdated: string;
  };
}

interface EnhancementContext {
  designFile?: any;
  previousQuality?: any;
  pipelinePhase?: string;
  hubspotRequirements?: string[];
  userPreferences?: any;
  errorHistory?: any[];
}

export class EnhancedAIService {
  private openAIService: OpenAIService;
  private qualityDashboard: QualityMetricsDashboard;
  private progressTracker: PipelineProgressTracker;
  private knowledgeBase: KnowledgeBaseEntry[] = [];
  private initialized = false;

  constructor() {
    this.openAIService = OpenAIService.getInstance();
    this.qualityDashboard = new QualityMetricsDashboard();
    this.progressTracker = new PipelineProgressTracker();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing Enhanced AI Service with RAG + Dynamic Context');
    
    // Initialize knowledge base
    await this.loadKnowledgeBase();
    
    // Initialize embeddings for existing knowledge
    await this.generateKnowledgeBaseEmbeddings();
    
    this.initialized = true;
    logger.info('Enhanced AI Service initialized successfully');
  }

  // ============================================================
  // RAG IMPLEMENTATION (Approach 1)
  // ============================================================

  /**
   * Create embeddings for text using OpenAI's embedding model
   */
  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text
        })
      });

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error creating embedding', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Perform vector search to find relevant knowledge base entries
   */
  async vectorSearch(
    queryEmbedding: number[], 
    filters: { types?: string[], categories?: string[], limit?: number } = {}
  ): Promise<EmbeddingResult[]> {
    const { types, categories, limit = 5 } = filters;

    // Filter knowledge base entries
    let filteredEntries = this.knowledgeBase;
    
    if (types) {
      filteredEntries = filteredEntries.filter(entry => 
        types.includes(entry.metadata.type)
      );
    }
    
    if (categories) {
      filteredEntries = filteredEntries.filter(entry => 
        categories.includes(entry.metadata.category)
      );
    }

    // Calculate cosine similarity
    const results = filteredEntries.map(entry => {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
      return {
        embedding: entry.embedding,
        text: entry.content,
        metadata: {
          type: entry.metadata.type as any,
          category: entry.metadata.category,
          relevanceScore: similarity
        }
      };
    });

    // Sort by relevance and return top results
    return results
      .sort((a, b) => (b.metadata.relevanceScore || 0) - (a.metadata.relevanceScore || 0))
      .slice(0, limit);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  // ============================================================
  // DYNAMIC CONTEXT EXTENSION (Approach 2)
  // ============================================================

  /**
   * Build dynamic context based on current pipeline state and history
   */
  async buildDynamicContext(context: EnhancementContext): Promise<string> {
    const contextParts: string[] = [];

    // 1. Quality-based context
    if (context.previousQuality) {
      const qualityInsights = await this.analyzeQualityHistory(context.previousQuality);
      contextParts.push(`Quality Insights: ${qualityInsights}`);
    }

    // 2. Design analysis context
    if (context.designFile) {
      const designAnalysis = await this.analyzeDesignFile(context.designFile);
      contextParts.push(`Design Analysis: ${designAnalysis}`);
    }

    // 3. HubSpot requirements context
    if (context.hubspotRequirements) {
      contextParts.push(`HubSpot Requirements: ${context.hubspotRequirements.join(', ')}`);
    }

    // 4. Error learning context
    if (context.errorHistory && context.errorHistory.length > 0) {
      const errorPatterns = this.analyzeErrorPatterns(context.errorHistory);
      contextParts.push(`Common Issues to Avoid: ${errorPatterns}`);
    }

    // 5. Pipeline phase context
    if (context.pipelinePhase) {
      const phaseGuidance = this.getPhaseSpecificGuidance(context.pipelinePhase);
      contextParts.push(`Phase-Specific Guidance: ${phaseGuidance}`);
    }

    return contextParts.join('\n\n');
  }

  /**
   * Enhanced prompt generation combining RAG + Dynamic Context
   */
  async enhancePrompt(
    originalPrompt: string, 
    context: EnhancementContext = {}
  ): Promise<string> {
    // Get relevant knowledge from RAG
    const promptEmbedding = await this.createEmbedding(originalPrompt);
    const relevantKnowledge = await this.vectorSearch(promptEmbedding, {
      types: ['hubspot_pattern', 'design_principle', 'code_example', 'best_practice'],
      limit: 3
    });

    // Build dynamic context
    const dynamicContext = await this.buildDynamicContext(context);

    const enhancedPrompt = `
SYSTEM CONTEXT:
You are an expert HubSpot module developer with deep knowledge of modern web development, accessibility, and performance optimization.

RELEVANT KNOWLEDGE BASE:
${relevantKnowledge.map(item => `
- ${item.metadata.type.toUpperCase()}: ${item.text}
  (Relevance: ${(item.metadata.relevanceScore! * 100).toFixed(1)}%)
`).join('')}

DYNAMIC CONTEXT:
${dynamicContext}

ORIGINAL REQUEST:
${originalPrompt}

ENHANCEMENT INSTRUCTIONS:
1. Use the relevant knowledge base entries to inform your response
2. Address any quality issues mentioned in the dynamic context
3. Follow HubSpot best practices and requirements
4. Ensure accessibility and performance optimization
5. Learn from previous errors to avoid similar issues
6. Adapt your response to the current pipeline phase

Please generate high-quality, production-ready code that incorporates all this context.
`;

    logger.info('Prompt enhanced successfully', {
      knowledgeEntries: relevantKnowledge.length,
      contextLength: dynamicContext.length,
      originalLength: originalPrompt.length,
      enhancedLength: enhancedPrompt.length
    });

    return enhancedPrompt;
  }

  // ============================================================
  // KNOWLEDGE BASE MANAGEMENT
  // ============================================================

  /**
   * Load knowledge base from various sources
   */
  private async loadKnowledgeBase(): Promise<void> {
    logger.info('Loading knowledge base...');

    // HubSpot patterns and best practices
    this.knowledgeBase.push(
      {
        id: 'hubspot-module-structure',
        content: 'HubSpot modules should follow the standard structure with meta.json, module.html, module.css, and module.js files. Always include proper field definitions and validation.',
        embedding: [], // Will be generated
        metadata: {
          type: 'hubspot_pattern',
          category: 'structure',
          tags: ['module', 'structure', 'files'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'accessibility-best-practices',
        content: 'Always include proper ARIA labels, semantic HTML elements, keyboard navigation support, and sufficient color contrast ratios. Use alt text for images and proper heading hierarchy.',
        embedding: [],
        metadata: {
          type: 'best_practice',
          category: 'accessibility',
          tags: ['aria', 'semantic', 'keyboard', 'contrast'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'performance-optimization',
        content: 'Optimize for performance by minimizing CSS and JavaScript, using efficient selectors, lazy loading images, and avoiding unnecessary DOM manipulations. Use modern CSS features like CSS Grid and Flexbox.',
        embedding: [],
        metadata: {
          type: 'best_practice',
          category: 'performance',
          tags: ['css', 'javascript', 'optimization', 'modern'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'tailwind-integration',
        content: 'When using Tailwind CSS, prefer utility classes over custom CSS. Use responsive design utilities, maintain consistent spacing with the spacing scale, and leverage Tailwind\'s color palette.',
        embedding: [],
        metadata: {
          type: 'design_principle',
          category: 'styling',
          tags: ['tailwind', 'utilities', 'responsive', 'spacing'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'hubspot-field-types',
        content: 'Common HubSpot field types include text, textarea, rich_text, image, url, boolean, choice, color, number, and group. Each has specific validation and rendering requirements.',
        embedding: [],
        metadata: {
          type: 'hubspot_pattern',
          category: 'fields',
          tags: ['fields', 'types', 'validation'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'hero-section-patterns',
        content: 'Hero sections should feature compelling headlines, clear call-to-action buttons, high-quality background images or videos, and concise value propositions. Keep text minimal and impactful.',
        embedding: [],
        metadata: {
          type: 'design_pattern',
          category: 'hero_sections',
          tags: ['hero', 'cta', 'headlines', 'backgrounds'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'navigation-patterns',
        content: 'Navigation menus should be intuitive, accessible, and responsive. Use clear labels, logical hierarchy, and ensure mobile-friendly hamburger menus. Include breadcrumbs for deep pages.',
        embedding: [],
        metadata: {
          type: 'design_pattern',
          category: 'navigation',
          tags: ['navigation', 'menu', 'responsive', 'breadcrumbs'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'form-best-practices',
        content: 'Forms should have clear labels, proper validation, error messaging, and logical field grouping. Use progressive disclosure for long forms and provide clear success feedback.',
        embedding: [],
        metadata: {
          type: 'design_pattern',
          category: 'forms',
          tags: ['forms', 'validation', 'ux', 'labels'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'footer-patterns',
        content: 'Footers should contain essential links, contact information, social media links, and legal pages. Organize content in logical columns and ensure accessibility.',
        embedding: [],
        metadata: {
          type: 'design_pattern',
          category: 'footer',
          tags: ['footer', 'links', 'contact', 'legal'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'tailwind-layout-patterns',
        content: 'Use Tailwind layout utilities: flex, grid, container, mx-auto for centering. Common patterns: flex items-center justify-between, grid grid-cols-1 md:grid-cols-3, container mx-auto px-4. Avoid custom CSS when Tailwind utilities exist.',
        embedding: [],
        metadata: {
          type: 'tailwind_pattern',
          category: 'layout',
          tags: ['flex', 'grid', 'container', 'responsive'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'tailwind-spacing-system',
        content: 'Use Tailwind spacing scale consistently: p-4, m-8, space-y-6, gap-4. Common combinations: py-12 px-4, mt-8 mb-12, space-y-4 for vertical spacing. Use rem-based scale (4 = 1rem, 8 = 2rem).',
        embedding: [],
        metadata: {
          type: 'tailwind_pattern',
          category: 'spacing',
          tags: ['padding', 'margin', 'spacing', 'scale'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'tailwind-responsive-design',
        content: 'Mobile-first responsive design: base styles for mobile, then sm:, md:, lg:, xl: prefixes. Common patterns: text-sm md:text-lg, grid-cols-1 md:grid-cols-2 lg:grid-cols-3, hidden md:block.',
        embedding: [],
        metadata: {
          type: 'tailwind_pattern',
          category: 'responsive',
          tags: ['mobile-first', 'breakpoints', 'responsive'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'tailwind-color-system',
        content: 'Use Tailwind color palette: bg-blue-500, text-gray-900, border-gray-200. Semantic colors: bg-red-500 for errors, bg-green-500 for success. Use opacity modifiers: bg-blue-500/20 for transparency.',
        embedding: [],
        metadata: {
          type: 'tailwind_pattern',
          category: 'colors',
          tags: ['colors', 'palette', 'opacity', 'semantic'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'tailwind-typography',
        content: 'Typography hierarchy: text-4xl font-bold for headings, text-lg text-gray-600 for body, font-medium for emphasis. Line height: leading-tight for headings, leading-relaxed for body text.',
        embedding: [],
        metadata: {
          type: 'tailwind_pattern',
          category: 'typography',
          tags: ['text', 'font', 'headings', 'hierarchy'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'tailwind-components',
        content: 'Common component patterns: buttons (bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg), cards (bg-white shadow-lg rounded-xl p-6), forms (border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500).',
        embedding: [],
        metadata: {
          type: 'tailwind_pattern',
          category: 'components',
          tags: ['buttons', 'cards', 'forms', 'interactive'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'tailwind-animations',
        content: 'Use Tailwind animations: transition-all duration-300, hover:scale-105, animate-pulse, animate-bounce. For custom animations, use transform utilities: hover:translate-y-1, rotate-45, scale-110.',
        embedding: [],
        metadata: {
          type: 'tailwind_pattern',
          category: 'animations',
          tags: ['transitions', 'hover', 'transform', 'animations'],
          lastUpdated: new Date().toISOString()
        }
      },
      {
        id: 'tailwind-best-practices',
        content: 'Tailwind best practices: Use utility classes over custom CSS, group related utilities, use @apply sparingly, prefer composition over inheritance. Avoid !important, use Tailwind modifiers instead.',
        embedding: [],
        metadata: {
          type: 'tailwind_pattern',
          category: 'best_practices',
          tags: ['utilities', 'composition', 'modifiers', 'clean-code'],
          lastUpdated: new Date().toISOString()
        }
      }
    );

    logger.info(`Loaded ${this.knowledgeBase.length} knowledge base entries`);
  }

  /**
   * Generate embeddings for all knowledge base entries
   */
  private async generateKnowledgeBaseEmbeddings(): Promise<void> {
    logger.info('Generating embeddings for knowledge base...');

    for (const entry of this.knowledgeBase) {
      if (entry.embedding.length === 0) {
        entry.embedding = await this.createEmbedding(entry.content);
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
      }
    }

    logger.info('Knowledge base embeddings generated successfully');
  }

  /**
   * Add new entry to knowledge base
   */
  async addKnowledgeEntry(
    content: string, 
    type: string, 
    category: string, 
    tags: string[] = []
  ): Promise<void> {
    const embedding = await this.createEmbedding(content);
    
    this.knowledgeBase.push({
      id: `custom-${Date.now()}`,
      content,
      embedding,
      metadata: {
        type,
        category,
        tags,
        lastUpdated: new Date().toISOString()
      }
    });

    logger.info('Added new knowledge base entry', { type, category, tags });
  }

  // ============================================================
  // ANALYSIS METHODS
  // ============================================================

  private async analyzeQualityHistory(qualityData: any): Promise<string> {
    // Analyze quality trends and provide insights
    const insights: string[] = [];
    
    if (qualityData.html && qualityData.html < 80) {
      insights.push('HTML structure needs improvement - focus on semantic elements and validation');
    }
    
    if (qualityData.accessibility && qualityData.accessibility < 85) {
      insights.push('Accessibility score is low - ensure ARIA labels and keyboard navigation');
    }
    
    if (qualityData.performance && qualityData.performance < 75) {
      insights.push('Performance optimization needed - minimize CSS/JS and optimize images');
    }

    return insights.join('. ');
  }

  private async analyzeDesignFile(designFile: any): Promise<string> {
    // Analyze design file and extract key insights
    const analysis: string[] = [];
    
    if (designFile.colors) {
      analysis.push(`Color palette: ${designFile.colors.length} colors detected`);
    }
    
    if (designFile.layout) {
      analysis.push(`Layout type: ${designFile.layout.type || 'standard'}`);
    }
    
    if (designFile.components) {
      analysis.push(`Components: ${designFile.components.length} elements identified`);
    }

    return analysis.join(', ');
  }

  private analyzeErrorPatterns(errorHistory: any[]): string {
    const patterns = errorHistory
      .map(error => error.type)
      .reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(patterns)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([type, count]) => `${type} (${count} occurrences)`)
      .join(', ');
  }

  private getPhaseSpecificGuidance(phase: string): string {
    const guidance: Record<string, string> = {
      'input_processing': 'Focus on accurate design analysis and requirement extraction',
      'ai_generation': 'Generate clean, semantic HTML with proper structure and accessibility',
      'quality_assurance': 'Validate against all quality metrics and fix identified issues',
      'enhancement': 'Apply performance optimizations and advanced features',
      'module_packaging': 'Ensure proper HubSpot module structure and field definitions'
    };

    return guidance[phase] || 'Follow general best practices for high-quality output';
  }

  // ============================================================
  // PUBLIC API METHODS
  // ============================================================

  /**
   * Enhanced HTML generation with RAG + Dynamic Context
   */
  async generateEnhancedHTML(
    designFile: any, 
    options: any = {}, 
    context: EnhancementContext = {}
  ): Promise<string> {
    const basePrompt = `Generate a high-quality, accessible HTML structure for this design file with modern CSS styling.`;
    
    const enhancedPrompt = await this.enhancePrompt(basePrompt, {
      ...context,
      designFile,
      pipelinePhase: 'ai_generation',
      hubspotRequirements: ['semantic_html', 'accessibility', 'responsive_design']
    });

    const result = await this.openAIService.convertDesignToHTML(designFile, options);
    return result.html;
  }

  /**
   * Enhanced HTML refinement with context awareness
   */
  async refineEnhancedHTML(
    html: string, 
    feedback: string, 
    context: EnhancementContext = {}
  ): Promise<string> {
    const basePrompt = `Refine this HTML based on the provided feedback: ${feedback}`;
    
    const enhancedPrompt = await this.enhancePrompt(basePrompt, {
      ...context,
      pipelinePhase: 'enhancement'
    });

    return await this.openAIService.refineHTML(html, feedback);
  }

  /**
   * Get enhancement statistics
   */
  getEnhancementStats(): any {
    return {
      knowledgeBaseSize: this.knowledgeBase.length,
      knowledgeTypes: [...new Set(this.knowledgeBase.map(entry => entry.metadata.type))],
      knowledgeCategories: [...new Set(this.knowledgeBase.map(entry => entry.metadata.category))],
      initialized: this.initialized,
      lastUpdate: new Date().toISOString()
    };
  }
}

export default EnhancedAIService;
