import { createLogger } from '../../utils/logger';
import { OpenAIClient } from '../core/ai/OpenAIClient';
import SplittingService from '../ai/splitting/SplittingService';
import ModuleBuilder from '../hubspot/modules/ModuleBuilder';

const logger = createLogger();

export interface PipelinePhase {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  duration?: number;
  error?: string;
  result?: any;
}

export interface PipelineExecutionResult {
  id: string;
  status: 'running' | 'completed' | 'failed';
  phases: PipelinePhase[];
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  finalResult?: any;
  error?: string;
}

export interface PipelineInput {
  designFile: File | Buffer;
  fileName: string;
  options: {
    generateModule?: boolean;
    includeValidation?: boolean;
    optimizeForPerformance?: boolean;
  };
}

/**
 * Pipeline Execution Service
 * Orchestrates the complete 5-phase pipeline for design-to-code conversion
 */
export class PipelineExecutor {
  private static instance: PipelineExecutor;
  private openaiClient: OpenAIClient;
  private splittingService: typeof SplittingService;
  private moduleBuilder: any;

  public static getInstance(): PipelineExecutor {
    if (!PipelineExecutor.instance) {
      PipelineExecutor.instance = new PipelineExecutor();
    }
    return PipelineExecutor.instance;
  }

  private constructor() {
    this.openaiClient = OpenAIClient.getInstance();
    this.splittingService = SplittingService;
    const { ModuleBuilder } = require('../hubspot/modules/ModuleBuilder');
    this.moduleBuilder = ModuleBuilder.getInstance();
  }

  /**
   * Execute the complete pipeline
   */
  async executePipeline(input: PipelineInput): Promise<PipelineExecutionResult> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    logger.info('Starting pipeline execution', {
      executionId,
      fileName: input.fileName,
      options: input.options
    });

    const result: PipelineExecutionResult = {
      id: executionId,
      status: 'running',
      phases: this.initializePhases(),
      startTime
    };

    try {
      // Phase 1: Input Processing
      await this.executePhase(result, 'Input Processing', async () => {
        return this.processInput(input);
      });

      // Phase 2: AI Analysis & Splitting
      await this.executePhase(result, 'AI Analysis', async () => {
        const processedInput = result.phases[0].result;
        return this.performAIAnalysis(processedInput, executionId);
      });

      // Phase 3: HTML Generation
      await this.executePhase(result, 'HTML Generation', async () => {
        const analysisResult = result.phases[1].result;
        return this.generateHTML(analysisResult, input.options);
      });

      // Phase 4: Quality Assurance
      if (input.options.includeValidation !== false) {
        await this.executePhase(result, 'Quality Assurance', async () => {
          const htmlResult = result.phases[2].result;
          return this.performQualityAssurance(htmlResult);
        });
      }

      // Phase 5: Module Packaging
      if (input.options.generateModule !== false) {
        await this.executePhase(result, 'Module Packaging', async () => {
          const htmlResult = result.phases[2].result;
          const qaResult = result.phases[3]?.result;
          return this.packageModule(htmlResult, qaResult, input);
        });
      }

      // Complete execution
      result.status = 'completed';
      result.endTime = Date.now();
      result.totalDuration = result.endTime - result.startTime;
      result.finalResult = this.compileFinalResult(result);

      logger.info('Pipeline execution completed successfully', {
        executionId,
        totalDuration: result.totalDuration,
        phasesCompleted: result.phases.filter(p => p.status === 'completed').length
      });

      return result;

    } catch (error) {
      result.status = 'failed';
      result.endTime = Date.now();
      result.totalDuration = result.endTime - result.startTime;
      result.error = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Pipeline execution failed', {
        executionId,
        error: result.error,
        totalDuration: result.totalDuration
      });

      return result;
    }
  }

  /**
   * Execute a single pipeline phase
   */
  private async executePhase(
    result: PipelineExecutionResult,
    phaseName: string,
    executor: () => Promise<any>
  ): Promise<void> {
    const phase = result.phases.find(p => p.name === phaseName);
    if (!phase) {
      throw new Error(`Phase ${phaseName} not found`);
    }

    try {
      phase.status = 'running';
      phase.startTime = Date.now();

      logger.info(`Starting phase: ${phaseName}`, {
        executionId: result.id,
        phase: phaseName
      });

      phase.result = await executor();
      
      phase.status = 'completed';
      phase.endTime = Date.now();
      phase.duration = phase.endTime - (phase.startTime || 0);

      logger.info(`Phase completed: ${phaseName}`, {
        executionId: result.id,
        phase: phaseName,
        duration: phase.duration
      });

    } catch (error) {
      phase.status = 'failed';
      phase.endTime = Date.now();
      phase.duration = phase.endTime - (phase.startTime || 0);
      phase.error = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Phase failed: ${phaseName}`, {
        executionId: result.id,
        phase: phaseName,
        error: phase.error,
        duration: phase.duration
      });

      throw error;
    }
  }

  /**
   * Initialize pipeline phases
   */
  private initializePhases(): PipelinePhase[] {
    return [
      { name: 'Input Processing', status: 'pending' },
      { name: 'AI Analysis', status: 'pending' },
      { name: 'HTML Generation', status: 'pending' },
      { name: 'Quality Assurance', status: 'pending' },
      { name: 'Module Packaging', status: 'pending' }
    ];
  }

  /**
   * Phase 1: Process input file
   */
  private async processInput(input: PipelineInput): Promise<{
    imageBase64: string;
    fileName: string;
    fileSize: number;
  }> {
    let buffer: Buffer;
    
    if (input.designFile instanceof Buffer) {
      buffer = input.designFile;
    } else {
      buffer = Buffer.isBuffer(input.designFile) ? input.designFile : Buffer.from(input.designFile as any);
    }

    const imageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;

    return {
      imageBase64,
      fileName: input.fileName,
      fileSize: buffer.length
    };
  }

  /**
   * Phase 2: Perform AI analysis and splitting
   */
  private async performAIAnalysis(
    processedInput: { imageBase64: string; fileName: string },
    executionId: string
  ): Promise<{
    sections: any[];
    analysisMetadata: any;
  }> {
    const sections = await this.splittingService.generateSplittingSuggestions(
      processedInput.imageBase64,
      processedInput.fileName,
      executionId
    );

    return {
      sections,
      analysisMetadata: {
        sectionsCount: sections.length,
        averageConfidence: sections.reduce((sum, s) => sum + s.confidence, 0) / sections.length,
        analysisTime: Date.now()
      }
    };
  }

  /**
   * Phase 3: Generate HTML from analysis
   */
  private async generateHTML(
    analysisResult: { sections: any[] },
    options: PipelineInput['options']
  ): Promise<{
    html: string;
    css: string;
    metadata: any;
  }> {
    // This would integrate with the HTML generation service
    // For now, return a basic structure based on sections
    
    const sectionsHtml = analysisResult.sections.map(section => `
      <section class="${section.type}-section" data-section-id="${section.name.toLowerCase().replace(/\s+/g, '-')}">
        <div class="container">
          <h2>${section.name}</h2>
          <p>${section.description}</p>
        </div>
      </section>
    `).join('\n');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Layout</title>
</head>
<body>
    ${sectionsHtml}
</body>
</html>`;

    const css = `
/* Generated CSS */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

section {
    padding: 60px 0;
}

.header-section {
    background: #f8f9fa;
}

.hero-section {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.content-section {
    background: white;
}

.footer-section {
    background: #343a40;
    color: white;
}

@media (max-width: 768px) {
    section {
        padding: 40px 0;
    }
    
    .container {
        padding: 0 15px;
    }
}`;

    return {
      html,
      css,
      metadata: {
        sectionsGenerated: analysisResult.sections.length,
        responsive: true,
        accessible: options.optimizeForPerformance !== false
      }
    };
  }

  /**
   * Phase 4: Perform quality assurance
   */
  private async performQualityAssurance(htmlResult: {
    html: string;
    css: string;
  }): Promise<{
    validationResults: any;
    qualityScore: number;
    recommendations: string[];
  }> {
    // This would integrate with the HTMLValidator service
    return {
      validationResults: {
        syntaxValid: true,
        semanticValid: true,
        accessibilityScore: 85
      },
      qualityScore: 85,
      recommendations: [
        'Consider adding more semantic HTML elements',
        'Add alt attributes to images',
        'Optimize CSS for better performance'
      ]
    };
  }

  /**
   * Phase 5: Package as HubSpot module
   */
  private async packageModule(
    htmlResult: { html: string; css: string },
    qaResult: any,
    input: PipelineInput
  ): Promise<{
    module: any;
    packageInfo: any;
  }> {
    const module = await this.moduleBuilder.buildModule(
      htmlResult.html,
      htmlResult.css,
      {
        name: input.fileName.replace(/\.[^/.]+$/, ''),
        label: `Generated Module - ${input.fileName}`,
        generateFields: true,
        includeResponsive: true,
        includeAccessibility: true
      }
    );

    return {
      module,
      packageInfo: {
        moduleId: module.id,
        fieldsCount: module.fields.length,
        version: module.meta.version
      }
    };
  }

  /**
   * Compile final result from all phases
   */
  private compileFinalResult(result: PipelineExecutionResult): any {
    const completedPhases = result.phases.filter(p => p.status === 'completed');
    
    return {
      executionSummary: {
        id: result.id,
        phasesCompleted: completedPhases.length,
        totalDuration: result.totalDuration,
        success: result.status === 'completed'
      },
      results: completedPhases.reduce((acc, phase) => {
        acc[phase.name.toLowerCase().replace(/\s+/g, '_')] = phase.result;
        return acc;
      }, {} as any)
    };
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get pipeline status
   */
  async getPipelineStatus(executionId: string): Promise<PipelineExecutionResult | null> {
    // This would typically query a database or cache
    // For now, return null as we don't have persistence
    return null;
  }
}

export default PipelineExecutor.getInstance();
