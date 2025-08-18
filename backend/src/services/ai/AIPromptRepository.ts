import { createLogger } from '../../utils/logger';
import prisma from '../database/prismaClient';

const logger = createLogger();
// Type workaround: Prisma client exposes models with camel-cased 'aI*' names at runtime,
// but TypeScript types may not include them. Use an any-cast alias.
const p = prisma as any;

export interface AIProcessConfig {
  name: string;
  displayName: string;
  description?: string;
  category: 'analysis' | 'generation' | 'enhancement' | 'validation';
  defaultPrompt: string;
  templateVars?: Record<string, string>;
}

export interface AIPromptVersion {
  id: string;
  processId: string;
  version: string;
  title?: string;
  description?: string;
  content: string; // Match Prisma schema field name
  isActive: boolean;
  isDefault: boolean;
  author?: string; // Optional in Prisma schema
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptTestResult {
  id: string;
  promptId: string;
  testFileName?: string;
  testFileId?: string;
  input?: any;
  output?: any;
  metrics?: Record<string, any>;
  status: string; // "success" | "failure" | "error"
  executionTime?: number; // ms
  errorMessage?: string;
  createdAt: Date;
}

export class AIPromptRepository {
  private static instance: AIPromptRepository;

  public static getInstance(): AIPromptRepository {
    if (!AIPromptRepository.instance) {
      AIPromptRepository.instance = new AIPromptRepository();
    }
    return AIPromptRepository.instance;
  }

  /**
   * Initialize AI processes with default prompts
   */
  async initializeAIProcesses(): Promise<void> {
    const processes: AIProcessConfig[] = [
      {
        name: 'split-detection',
        displayName: 'Split Detection',
        description: 'AI-powered layout section detection and boundary identification',
        category: 'analysis',
        defaultPrompt: this.getDefaultSplitDetectionPrompt(),
        templateVars: {
          'targetSectionCount': 'Target number of sections to detect (4-8)',
          'historicalInsights': 'Historical feedback from previous sessions'
        }
      },
      {
        name: 'html-generation',
        displayName: 'HTML Generation',
        description: 'Convert design sections into semantic HTML code',
        category: 'generation',
        defaultPrompt: this.getDefaultHTMLGenerationPrompt(),
        templateVars: {
          'sectionType': 'Type of section (header, hero, content, etc.)',
          'designContext': 'Design style and requirements'
        }
      },
      {
        name: 'content-enhancement',
        displayName: 'Content Enhancement',
        description: 'Improve and refine generated content quality',
        category: 'enhancement',
        defaultPrompt: this.getDefaultContentEnhancementPrompt(),
        templateVars: {
          'qualityMetrics': 'Current quality scores and issues',
          'improvementFocus': 'Areas requiring improvement'
        }
      },
      {
        name: 'quality-analysis',
        displayName: 'Quality Analysis',
        description: 'Automated quality assessment and validation',
        category: 'validation',
        defaultPrompt: this.getDefaultQualityAnalysisPrompt(),
        templateVars: {
          'validationCriteria': 'Quality criteria and thresholds',
          'contentType': 'Type of content being analyzed'
        }
      },
      {
        name: 'image-analysis',
        displayName: 'Image Analysis',
        description: 'Design complexity and pattern recognition',
        category: 'analysis',
        defaultPrompt: this.getDefaultImageAnalysisPrompt(),
        templateVars: {
          'analysisDepth': 'Level of analysis required',
          'focusAreas': 'Specific aspects to analyze'
        }
      }
    ];

    for (const processConfig of processes) {
      await this.createOrUpdateProcess(processConfig);
    }

    logger.info('AI processes initialized successfully', {
      processCount: processes.length,
      processes: processes.map(p => p.name)
    });
  }

  /**
   * Create or update an AI process
   */
  async createOrUpdateProcess(config: AIProcessConfig): Promise<void> {
    try {
      // Upsert the process
      const process = await p.aIProcess.upsert({
        where: { name: config.name },
        update: {
          displayName: config.displayName,
          description: config.description,
          category: config.category,
          updatedAt: new Date()
        },
        create: {
          name: config.name,
          displayName: config.displayName,
          description: config.description,
          category: config.category,
          isActive: true
        }
      });

      // Check if default prompt exists
      const existingPrompt = await p.aIPrompt.findFirst({
        where: {
          processId: process.id,
          isDefault: true
        }
      });

      // Create default prompt if it doesn't exist
      if (!existingPrompt) {
        await p.aIPrompt.create({
          data: {
            processId: process.id,
            version: 'v1.0.0',
            title: 'Default Prompt',
            description: 'Initial default prompt for ' + config.displayName,
            content: config.defaultPrompt,
            isActive: true,
            isDefault: true,
            author: 'System',
            tags: ['default', 'system'],
            metadata: {
              createdBy: 'initialization',
              promptType: 'default'
            }
          }
        });
      }

    } catch (error) {
      logger.error('Failed to create/update AI process', {
        processName: config.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get all AI processes
   */
  async getAllProcesses(): Promise<any[]> {
    try {
      return await p.aIProcess.findMany({
        include: {
          prompts: {
            where: { isActive: true },
            take: 1,
            orderBy: { createdAt: 'desc' }
          },
          _count: {
            select: {
              prompts: true,
            }
          }
        },
        orderBy: { displayName: 'asc' }
      });
    } catch (error) {
      logger.error('AIPromptRepository.getAllProcesses failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get active prompt for a process
   */
  async getActivePrompt(processName: string): Promise<AIPromptVersion | null> {
    const result = await p.aIPrompt.findFirst({
      where: {
        process: { name: processName },
        isActive: true
      },
      include: {
        process: true
      }
    });

    return result as AIPromptVersion | null;
  }

  /**
   * Get all prompt versions for a process
   */
  async getPromptVersions(processName: string): Promise<AIPromptVersion[]> {
    const results = await p.aIPrompt.findMany({
      where: {
        process: { name: processName }
      },
      include: {
        process: true,
        metrics: {
          orderBy: { calculatedAt: 'desc' },
          take: 10
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return results as AIPromptVersion[];
  }

  /**
   * Create new prompt version
   */
  async createPromptVersion(
    processName: string,
    version: string,
    promptContent: string,
    options: {
      title?: string;
      description?: string;
      author: string;
      tags?: string[];
      metadata?: Record<string, any>;
      setAsActive?: boolean;
    }
  ): Promise<AIPromptVersion> {
    const existingProcess = await p.aIProcess.findUnique({
      where: { name: processName }
    });

    if (!existingProcess) {
      throw new Error(`AI process '${processName}' not found`);
    }

    // If setting as active, deactivate current active prompt
    if (options.setAsActive) {
      await p.aIPrompt.updateMany({
        where: {
          processId: existingProcess.id,
          isActive: true
        },
        data: { isActive: false }
      });
    }

    const newPrompt = await p.aIPrompt.create({
      data: {
        processId: existingProcess.id,
        version,
        title: options.title,
        description: options.description,
        content: promptContent,
        isActive: options.setAsActive || false,
        isDefault: false,
        author: options.author,
        tags: options.tags || [],
        metadata: options.metadata || {}
      },
      include: {
        process: true
      }
    });

    logger.info('Created new prompt version', {
      processName,
      version,
      promptId: newPrompt.id,
      isActive: newPrompt.isActive
    });

    return newPrompt as AIPromptVersion;
  }

  /**
   * Set prompt as active
   */
  async setActivePrompt(promptId: string): Promise<void> {
    const prompt = await p.aIPrompt.findUnique({
      where: { id: promptId },
      include: { process: true }
    });

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    // Deactivate current active prompt
    await p.aIPrompt.updateMany({
      where: {
        processId: prompt.processId,
        isActive: true
      },
      data: { isActive: false }
    });

    // Activate the selected prompt
    await p.aIPrompt.update({
      where: { id: promptId },
      data: { isActive: true }
    });

    logger.info('Set prompt as active', {
      promptId,
      processName: prompt.process.name,
      version: prompt.version
    });
  }

  /**
   * Record test result
   */
  async recordTestResult(result: Omit<PromptTestResult, 'id' | 'createdAt'>): Promise<PromptTestResult> {
    const testResult = await p.aIPromptTestResult.create({
      data: {
        promptId: result.promptId,
        testFileName: result.testFileName,
        testFileId: result.testFileId,
        input: result.input,
        output: result.output,
        metrics: result.metrics,
        status: result.status,
        executionTime: result.executionTime,
        errorMessage: result.errorMessage
      }
    });

    return testResult as PromptTestResult;
  }

  /**
   * Get test results for a prompt
   */
  async getTestResults(promptId: string, limit: number = 50): Promise<PromptTestResult[]> {
    const results = await p.aIPromptTestResult.findMany({
      where: { promptId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return results as PromptTestResult[];
  }

  /**
   * Delete prompt version
   */
  async deletePromptVersion(promptId: string): Promise<void> {
    const prompt = await p.aIPrompt.findUnique({
      where: { id: promptId }
    });

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    if (prompt.isDefault) {
      throw new Error('Cannot delete default prompt');
    }

    if (prompt.isActive) {
      throw new Error('Cannot delete active prompt. Set another prompt as active first.');
    }

    await p.aIPrompt.delete({
      where: { id: promptId }
    });

    logger.info('Deleted prompt version', {
      promptId,
      version: prompt.version
    });
  }

  // Default prompt templates
  private getDefaultSplitDetectionPrompt(): string {
    return `ENHANCED LAYOUT SECTION DETECTION

Analyze this design image and identify distinct layout sections with high precision. Use these enhanced guidelines:

## SECTION DETECTION PRIORITIES:
1. **Visual Hierarchy**: Identify sections based on visual grouping, spacing, and hierarchy
2. **Semantic Meaning**: Recognize common web layout patterns (header, hero, features, testimonials, footer)
3. **Content Boundaries**: Detect natural content boundaries and logical groupings
4. **Responsive Considerations**: Consider how sections would adapt across screen sizes

## REQUIRED SECTION TYPES:
- **header**: Top navigation, logo, main menu
- **hero**: Primary banner, main value proposition, call-to-action
- **content**: Main content areas, text blocks, information sections
- **feature**: Feature highlights, service offerings, product showcases
- **testimonial**: Customer reviews, social proof, quotes
- **contact**: Contact forms, contact information, location details
- **footer**: Bottom navigation, copyright, secondary links
- **navigation**: Standalone navigation elements
- **sidebar**: Secondary content, widgets, complementary information
- **gallery**: Image galleries, portfolios, media collections

## ENHANCED ANALYSIS REQUIREMENTS:
1. **Bounding Box Accuracy**: Provide precise x, y, width, height coordinates
2. **Confidence Scoring**: Rate detection confidence (0.0-1.0) based on:
   - Visual clarity of section boundaries
   - Typical web layout patterns
   - Content coherence within section
3. **Detection Reasoning**: Explain why each section was identified
4. **Improvement Suggestions**: Suggest potential adjustments or alternatives

## HISTORICAL FEEDBACK INTEGRATION:
{{historicalInsights}}

## TARGET SECTION COUNT:
Aim for {{targetSectionCount}} well-defined sections. Avoid over-segmentation.

Return enhanced JSON with this structure:
{
  "sections": [
    {
      "id": "section_1",
      "name": "Descriptive Section Name",
      "type": "header|hero|content|feature|testimonial|contact|footer|navigation|sidebar|gallery",
      "bounds": {
        "x": 0,
        "y": 0,
        "width": 800,
        "height": 100
      },
      "html": "Generated HTML for this section",
      "editableFields": [...],
      "aiConfidence": 0.85,
      "detectionReason": "Clear visual boundary with distinct header elements including logo and navigation",
      "suggestedImprovements": ["Consider adjusting height for better mobile responsiveness"]
    }
  ],
  "imageAnalysis": {
    "complexity": "medium",
    "layoutStyle": "modern|traditional|minimal|complex",
    "primaryColors": ["#color1", "#color2"],
    "designPatterns": ["grid-layout", "card-design", "hero-banner"]
  }
}`;
  }

  private getDefaultHTMLGenerationPrompt(): string {
    return `HTML GENERATION FOR {{sectionType}} SECTION

Generate semantic, accessible HTML for a {{sectionType}} section based on the provided design analysis.

## GENERATION REQUIREMENTS:
1. **Semantic HTML**: Use appropriate HTML5 semantic elements
2. **Accessibility**: Include ARIA labels, alt text, and keyboard navigation
3. **Modern CSS**: Use modern CSS features (Grid, Flexbox, Custom Properties)
4. **Responsive Design**: Mobile-first approach with responsive breakpoints
5. **Performance**: Optimize for fast loading and rendering

## DESIGN CONTEXT:
{{designContext}}

## OUTPUT STRUCTURE:
Return JSON with:
{
  "html": "Complete HTML structure",
  "css": "Associated CSS styles",
  "editableFields": [
    {
      "id": "field_1",
      "type": "text|image|link|color",
      "label": "Field Label",
      "defaultValue": "Default content",
      "validation": "validation rules"
    }
  ],
  "accessibility": {
    "score": 95,
    "issues": [],
    "improvements": []
  },
  "metadata": {
    "complexity": "low|medium|high",
    "estimatedLoadTime": "milliseconds",
    "dependencies": []
  }
}`;
  }

  private getDefaultContentEnhancementPrompt(): string {
    return `CONTENT ENHANCEMENT AND REFINEMENT

Analyze and improve the provided content based on quality metrics and user feedback.

## ENHANCEMENT FOCUS:
{{improvementFocus}}

## CURRENT QUALITY METRICS:
{{qualityMetrics}}

## ENHANCEMENT AREAS:
1. **Content Quality**: Grammar, clarity, engagement
2. **SEO Optimization**: Keywords, meta descriptions, structure
3. **Accessibility**: Screen reader compatibility, language clarity
4. **Performance**: Content size, loading optimization
5. **User Experience**: Readability, visual hierarchy

## OUTPUT REQUIREMENTS:
Return enhanced content with improvement tracking:
{
  "enhancedContent": "Improved content",
  "improvements": [
    {
      "type": "grammar|seo|accessibility|performance|ux",
      "description": "What was improved",
      "impact": "Expected impact",
      "confidence": 0.85
    }
  ],
  "qualityScore": {
    "overall": 92,
    "breakdown": {
      "readability": 95,
      "seo": 88,
      "accessibility": 94,
      "engagement": 90
    }
  }
}`;
  }

  private getDefaultQualityAnalysisPrompt(): string {
    return `QUALITY ANALYSIS AND VALIDATION

Perform comprehensive quality assessment of {{contentType}} content.

## VALIDATION CRITERIA:
{{validationCriteria}}

## ANALYSIS DIMENSIONS:
1. **Technical Quality**: Code validity, performance, security
2. **Content Quality**: Accuracy, completeness, relevance
3. **User Experience**: Usability, accessibility, design
4. **SEO Quality**: Search optimization, meta data, structure
5. **Brand Compliance**: Style guide adherence, consistency

## OUTPUT FORMAT:
{
  "overallScore": 85,
  "dimensionScores": {
    "technical": 90,
    "content": 85,
    "userExperience": 88,
    "seo": 82,
    "brandCompliance": 87
  },
  "issues": [
    {
      "severity": "high|medium|low",
      "category": "technical|content|ux|seo|brand",
      "description": "Issue description",
      "recommendation": "How to fix",
      "impact": "Expected impact of fix"
    }
  ],
  "strengths": ["What's working well"],
  "recommendations": ["Priority improvements"]
}`;
  }

  private getDefaultImageAnalysisPrompt(): string {
    return `IMAGE ANALYSIS AND PATTERN RECOGNITION

Analyze the design image for complexity, patterns, and structural elements.

## ANALYSIS DEPTH:
{{analysisDepth}}

## FOCUS AREAS:
{{focusAreas}}

## ANALYSIS COMPONENTS:
1. **Visual Complexity**: Layout density, element count, visual hierarchy
2. **Design Patterns**: Common UI patterns, component types
3. **Color Analysis**: Palette extraction, contrast ratios
4. **Typography**: Font analysis, text hierarchy
5. **Layout Structure**: Grid systems, spacing, alignment

## OUTPUT STRUCTURE:
{
  "complexity": {
    "level": "low|medium|high",
    "score": 0.75,
    "factors": ["Dense layout", "Multiple sections", "Complex navigation"]
  },
  "designPatterns": [
    {
      "type": "hero-banner|card-grid|navigation|form",
      "confidence": 0.92,
      "location": {"x": 0, "y": 0, "width": 100, "height": 20}
    }
  ],
  "colorPalette": {
    "primary": ["#1a365d", "#2d3748"],
    "secondary": ["#4a5568", "#718096"],
    "accent": ["#3182ce", "#63b3ed"]
  },
  "typography": {
    "headingLevels": 3,
    "bodyTextSize": "medium",
    "fontStyles": ["sans-serif", "bold", "italic"]
  },
  "layoutStructure": {
    "gridSystem": "12-column",
    "breakpoints": ["mobile", "tablet", "desktop"],
    "spacing": "consistent"
  }
}`;
  }
}

export const aiPromptRepository = AIPromptRepository.getInstance();
export default aiPromptRepository;
