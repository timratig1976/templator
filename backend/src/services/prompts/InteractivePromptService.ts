import { createLogger } from '../../utils/logger';
import { EnhancedAIService } from '../ai/EnhancedAIService';
import path from 'path';
import fs from 'fs/promises';

const logger = createLogger();

export interface PromptContext {
  id: string;
  category: 'design' | 'accessibility' | 'performance' | 'hubspot' | 'tailwind' | 'custom';
  title: string;
  content: string;
  priority: number; // 1-10, higher = more important
  enabled: boolean;
  userAdded?: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  basePrompt: string;
  contexts: PromptContext[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    tags: string[];
    sectionType?: string;
  };
  usage: {
    timesUsed: number;
    averageRating: number;
    lastUsed?: string;
  };
}

export interface PromptGeneration {
  id: string;
  templateId: string;
  originalPrompt: string;
  enhancedPrompt: string;
  contexts: PromptContext[];
  ragKnowledge: any[];
  dynamicContext: string;
  metadata: {
    createdAt: string;
    sectionType: string;
    pipelinePhase: string;
  };
  result?: {
    html: string;
    css: string;
    quality?: any;
    userRating?: number;
  };
}

export class InteractivePromptService {
  private enhancedAI: EnhancedAIService;
  private templates: Map<string, PromptTemplate> = new Map();
  private generations: Map<string, PromptGeneration> = new Map();
  private storageDir: string;

  constructor() {
    this.enhancedAI = new EnhancedAIService();
    this.storageDir = path.join(process.cwd(), 'storage', 'prompts');
    this.ensureStorageDirectory();
    this.loadDefaultTemplates();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.mkdir(path.join(this.storageDir, 'templates'), { recursive: true });
      await fs.mkdir(path.join(this.storageDir, 'generations'), { recursive: true });
    } catch (error) {
      logger.error('Failed to create prompt storage directories', { error });
    }
  }

  /**
   * Load default prompt templates
   */
  private loadDefaultTemplates(): void {
    const defaultTemplates: PromptTemplate[] = [
      {
        id: 'hero-section',
        name: 'Hero Section Generator',
        description: 'Generate compelling hero sections with strong visual impact',
        basePrompt: 'Create a modern, engaging hero section that captures attention and clearly communicates the value proposition.',
        contexts: [
          {
            id: 'hero-design',
            category: 'design',
            title: 'Hero Design Principles',
            content: 'Hero sections should have a clear hierarchy, compelling headline, supporting text, and prominent call-to-action. Use whitespace effectively and ensure visual balance.',
            priority: 9,
            enabled: true
          },
          {
            id: 'hero-accessibility',
            category: 'accessibility',
            title: 'Hero Accessibility',
            content: 'Ensure sufficient color contrast, readable font sizes, proper heading hierarchy (h1), and alternative text for hero images.',
            priority: 8,
            enabled: true
          },
          {
            id: 'hero-tailwind',
            category: 'tailwind',
            title: 'Hero Tailwind Patterns',
            content: 'Use responsive utilities (sm:, md:, lg:), flexbox for centering, gradient backgrounds, and proper spacing classes. Consider dark mode variants.',
            priority: 9,
            enabled: true
          }
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          tags: ['hero', 'landing', 'cta'],
          sectionType: 'hero'
        },
        usage: {
          timesUsed: 0,
          averageRating: 0
        }
      },
      {
        id: 'navigation',
        name: 'Navigation Generator',
        description: 'Create responsive, accessible navigation components',
        basePrompt: 'Design a clean, intuitive navigation that works across all devices and provides excellent user experience.',
        contexts: [
          {
            id: 'nav-responsive',
            category: 'design',
            title: 'Responsive Navigation',
            content: 'Navigation should collapse to hamburger menu on mobile, have clear active states, and support keyboard navigation.',
            priority: 9,
            enabled: true
          },
          {
            id: 'nav-accessibility',
            category: 'accessibility',
            title: 'Navigation Accessibility',
            content: 'Use proper ARIA labels, ensure keyboard navigation, provide skip links, and maintain logical tab order.',
            priority: 10,
            enabled: true
          }
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          tags: ['navigation', 'menu', 'responsive'],
          sectionType: 'navigation'
        },
        usage: {
          timesUsed: 0,
          averageRating: 0
        }
      },
      {
        id: 'form',
        name: 'Form Generator',
        description: 'Build accessible, user-friendly forms with proper validation',
        basePrompt: 'Create a well-structured form with clear labels, helpful validation, and excellent user experience.',
        contexts: [
          {
            id: 'form-ux',
            category: 'design',
            title: 'Form UX Best Practices',
            content: 'Group related fields, use clear labels, provide helpful error messages, and minimize required fields.',
            priority: 9,
            enabled: true
          },
          {
            id: 'form-validation',
            category: 'performance',
            title: 'Form Validation',
            content: 'Implement client-side validation with clear error states, real-time feedback, and proper form submission handling.',
            priority: 8,
            enabled: true
          },
          {
            id: 'form-hubspot',
            category: 'hubspot',
            title: 'HubSpot Form Integration',
            content: 'Ensure forms are compatible with HubSpot form fields, use proper field types, and include necessary tracking.',
            priority: 7,
            enabled: true
          }
        ],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          tags: ['form', 'validation', 'hubspot'],
          sectionType: 'form'
        },
        usage: {
          timesUsed: 0,
          averageRating: 0
        }
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });

    logger.info('Default prompt templates loaded', { count: defaultTemplates.length });
  }

  /**
   * Get all available prompt templates
   */
  getTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): PromptTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * Create custom prompt template
   */
  async createTemplate(data: {
    name: string;
    description: string;
    basePrompt: string;
    sectionType?: string;
    tags?: string[];
  }): Promise<PromptTemplate> {
    const templateId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const template: PromptTemplate = {
      id: templateId,
      name: data.name,
      description: data.description,
      basePrompt: data.basePrompt,
      contexts: [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        tags: data.tags || [],
        sectionType: data.sectionType
      },
      usage: {
        timesUsed: 0,
        averageRating: 0
      }
    };

    this.templates.set(templateId, template);
    await this.saveTemplate(template);

    logger.info('Custom template created', { templateId, name: data.name });

    return template;
  }

  /**
   * Add context to template
   */
  async addContextToTemplate(
    templateId: string, 
    context: Omit<PromptContext, 'id'>
  ): Promise<PromptTemplate | null> {
    const template = this.templates.get(templateId);
    if (!template) {
      logger.warn('Template not found for context addition', { templateId });
      return null;
    }

    const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newContext: PromptContext = {
      ...context,
      id: contextId,
      userAdded: true
    };

    template.contexts.push(newContext);
    template.metadata.updatedAt = new Date().toISOString();
    
    await this.saveTemplate(template);

    logger.info('Context added to template', { templateId, contextId, category: context.category });

    return template;
  }

  /**
   * Update context in template
   */
  async updateContext(
    templateId: string, 
    contextId: string, 
    updates: Partial<PromptContext>
  ): Promise<PromptTemplate | null> {
    const template = this.templates.get(templateId);
    if (!template) {
      logger.warn('Template not found for context update', { templateId });
      return null;
    }

    const contextIndex = template.contexts.findIndex(ctx => ctx.id === contextId);
    if (contextIndex === -1) {
      logger.warn('Context not found for update', { templateId, contextId });
      return null;
    }

    template.contexts[contextIndex] = {
      ...template.contexts[contextIndex],
      ...updates
    };
    template.metadata.updatedAt = new Date().toISOString();
    
    await this.saveTemplate(template);

    logger.info('Context updated', { templateId, contextId });

    return template;
  }

  /**
   * Generate enhanced prompt with full visibility
   */
  async generateInteractivePrompt(
    templateId: string,
    additionalContext: {
      designFile?: any;
      sectionType?: string;
      pipelinePhase?: string;
      userRequirements?: string;
      customContexts?: PromptContext[];
    } = {}
  ): Promise<PromptGeneration | null> {
    const template = this.templates.get(templateId);
    if (!template) {
      logger.warn('Template not found for prompt generation', { templateId });
      return null;
    }

    // Combine template contexts with custom contexts
    const allContexts = [
      ...template.contexts.filter(ctx => ctx.enabled),
      ...(additionalContext.customContexts || [])
    ].sort((a, b) => b.priority - a.priority);

    // Build the base prompt with user requirements
    let basePrompt = template.basePrompt;
    if (additionalContext.userRequirements) {
      basePrompt += `\n\nAdditional Requirements:\n${additionalContext.userRequirements}`;
    }

    // Create enhancement context for RAG
    const enhancementContext = {
      designFile: additionalContext.designFile,
      pipelinePhase: additionalContext.pipelinePhase || 'ai_generation',
      hubspotRequirements: ['semantic_html', 'accessibility', 'responsive_design']
    };

    // Get enhanced prompt from RAG system
    const enhancedPrompt = await this.enhancedAI.enhancePrompt(basePrompt, enhancementContext);

    // Create prompt generation record
    const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const generation: PromptGeneration = {
      id: generationId,
      templateId,
      originalPrompt: basePrompt,
      enhancedPrompt,
      contexts: allContexts,
      ragKnowledge: [], // Will be populated by RAG system
      dynamicContext: '', // Will be populated by RAG system
      metadata: {
        createdAt: new Date().toISOString(),
        sectionType: additionalContext.sectionType || template.metadata.sectionType || 'unknown',
        pipelinePhase: additionalContext.pipelinePhase || 'ai_generation'
      }
    };

    this.generations.set(generationId, generation);
    await this.saveGeneration(generation);

    // Update template usage
    template.usage.timesUsed++;
    template.usage.lastUsed = new Date().toISOString();
    await this.saveTemplate(template);

    logger.info('Interactive prompt generated', { 
      generationId, 
      templateId, 
      contextsCount: allContexts.length 
    });

    return generation;
  }

  /**
   * Update prompt generation with results
   */
  async updateGenerationResult(
    generationId: string,
    result: {
      html: string;
      css: string;
      quality?: any;
      userRating?: number;
    }
  ): Promise<PromptGeneration | null> {
    const generation = this.generations.get(generationId);
    if (!generation) {
      logger.warn('Generation not found for result update', { generationId });
      return null;
    }

    generation.result = result;
    await this.saveGeneration(generation);

    // Update template average rating
    if (result.userRating) {
      const template = this.templates.get(generation.templateId);
      if (template) {
        const currentAvg = template.usage.averageRating;
        const timesUsed = template.usage.timesUsed;
        template.usage.averageRating = ((currentAvg * (timesUsed - 1)) + result.userRating) / timesUsed;
        await this.saveTemplate(template);
      }
    }

    logger.info('Generation result updated', { generationId, userRating: result.userRating });

    return generation;
  }

  /**
   * Get generation by ID
   */
  getGeneration(generationId: string): PromptGeneration | null {
    return this.generations.get(generationId) || null;
  }

  /**
   * Get generations for a template
   */
  getGenerationsForTemplate(templateId: string): PromptGeneration[] {
    return Array.from(this.generations.values())
      .filter(gen => gen.templateId === templateId)
      .sort((a, b) => new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime());
  }

  /**
   * Get best performing prompts for learning
   */
  getBestPrompts(minRating: number = 4, limit: number = 10): PromptGeneration[] {
    return Array.from(this.generations.values())
      .filter(gen => gen.result?.userRating && gen.result.userRating >= minRating)
      .sort((a, b) => (b.result?.userRating || 0) - (a.result?.userRating || 0))
      .slice(0, limit);
  }

  /**
   * Analyze prompt performance
   */
  getPromptAnalytics(): {
    totalGenerations: number;
    averageRating: number;
    bestTemplates: { templateId: string; name: string; averageRating: number; timesUsed: number }[];
    contextEffectiveness: { [category: string]: number };
    improvementSuggestions: string[];
  } {
    const generations = Array.from(this.generations.values());
    const ratedGenerations = generations.filter(g => g.result?.userRating);
    
    const averageRating = ratedGenerations.length > 0
      ? ratedGenerations.reduce((sum, g) => sum + (g.result?.userRating || 0), 0) / ratedGenerations.length
      : 0;

    const bestTemplates = Array.from(this.templates.values())
      .filter(t => t.usage.timesUsed > 0)
      .sort((a, b) => b.usage.averageRating - a.usage.averageRating)
      .slice(0, 5)
      .map(t => ({
        templateId: t.id,
        name: t.name,
        averageRating: t.usage.averageRating,
        timesUsed: t.usage.timesUsed
      }));

    // Analyze context effectiveness
    const contextEffectiveness: { [category: string]: number } = {};
    const contextCounts: { [category: string]: number } = {};

    ratedGenerations.forEach(gen => {
      gen.contexts.forEach(ctx => {
        if (!contextEffectiveness[ctx.category]) {
          contextEffectiveness[ctx.category] = 0;
          contextCounts[ctx.category] = 0;
        }
        contextEffectiveness[ctx.category] += gen.result?.userRating || 0;
        contextCounts[ctx.category]++;
      });
    });

    // Calculate averages
    Object.keys(contextEffectiveness).forEach(category => {
      contextEffectiveness[category] = contextEffectiveness[category] / contextCounts[category];
    });

    return {
      totalGenerations: generations.length,
      averageRating,
      bestTemplates,
      contextEffectiveness,
      improvementSuggestions: [
        'Add more specific context for better results',
        'Use higher-rated templates as starting points',
        'Include accessibility context for better scores',
        'Test different prompt variations'
      ]
    };
  }

  /**
   * Save template to disk
   */
  private async saveTemplate(template: PromptTemplate): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, 'templates', `${template.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(template, null, 2));
    } catch (error) {
      logger.error('Failed to save template', { error, templateId: template.id });
    }
  }

  /**
   * Save generation to disk
   */
  private async saveGeneration(generation: PromptGeneration): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, 'generations', `${generation.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(generation, null, 2));
    } catch (error) {
      logger.error('Failed to save generation', { error, generationId: generation.id });
    }
  }

  /**
   * Load all templates and generations from disk
   */
  async loadFromStorage(): Promise<void> {
    try {
      // Load templates
      const templatesDir = path.join(this.storageDir, 'templates');
      try {
        const templateFiles = await fs.readdir(templatesDir);
        for (const file of templateFiles) {
          if (file.endsWith('.json')) {
            try {
              const filePath = path.join(templatesDir, file);
              const content = await fs.readFile(filePath, 'utf8');
              const template: PromptTemplate = JSON.parse(content);
              this.templates.set(template.id, template);
            } catch (error) {
              logger.warn('Failed to load template file', { file, error });
            }
          }
        }
      } catch (error) {
        logger.info('Templates directory not found, using defaults');
      }

      // Load generations
      const generationsDir = path.join(this.storageDir, 'generations');
      try {
        const generationFiles = await fs.readdir(generationsDir);
        for (const file of generationFiles) {
          if (file.endsWith('.json')) {
            try {
              const filePath = path.join(generationsDir, file);
              const content = await fs.readFile(filePath, 'utf8');
              const generation: PromptGeneration = JSON.parse(content);
              this.generations.set(generation.id, generation);
            } catch (error) {
              logger.warn('Failed to load generation file', { file, error });
            }
          }
        }
      } catch (error) {
        logger.info('Generations directory not found, will be created on first use');
      }

      logger.info('Prompt data loaded from storage', {
        templates: this.templates.size,
        generations: this.generations.size
      });

    } catch (error) {
      logger.error('Failed to load prompt data from storage', { error });
    }
  }
}

export default InteractivePromptService;
