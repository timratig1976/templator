/**
 * AI Metrics Logger
 * Comprehensive logging for AI interactions, prompts, outputs, and quality metrics
 * Consolidated from the original AIMetricsLogger with improved structure
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../../../utils/logger';

const logger = createLogger();

export interface AIInteractionEntry {
  id: string;
  timestamp: string;
  pipelineId: string;
  phase: 'input_processing' | 'ai_generation' | 'quality_assurance' | 'enhancement' | 'packaging';
  
  // Input data
  input: {
    type: 'image' | 'text' | 'html' | 'validation_results';
    size: number; // bytes or character count
    contentHash: string; // for deduplication
    metadata: Record<string, any>;
  };

  // AI Processing with Full Prompt Details
  ai: {
    model: string; // e.g., 'gpt-4o', 'gpt-4-turbo'
    promptVersion: string;
    promptTemplate: string;
    promptVariables: Record<string, any>;
    fullPrompt: string; // The complete prompt sent to AI
    
    // Request details
    requestParams: {
      temperature: number;
      maxTokens: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    };
    
    // Response details
    response: {
      content: string;
      finishReason: string;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
      cost: {
        inputCost: number;
        outputCost: number;
        totalCost: number;
      };
    };
    
    // Timing
    timing: {
      requestStart: string;
      requestEnd: string;
      duration: number; // milliseconds
      retries: number;
    };
  };

  // Output quality metrics
  output: {
    type: 'html' | 'css' | 'json' | 'text';
    size: number;
    contentHash: string;
    
    // Quality scores
    quality: {
      syntaxValid: boolean;
      semanticScore: number; // 0-100
      accessibilityScore: number; // 0-100
      performanceScore: number; // 0-100
      overallScore: number; // 0-100
    };
    
    // Validation results
    validation: {
      errors: Array<{ type: string; message: string; severity: string }>;
      warnings: Array<{ type: string; message: string }>;
      suggestions: string[];
    };
  };

  // Context and environment
  context: {
    userAgent?: string;
    sessionId?: string;
    userId?: string;
    projectId?: string;
    environment: 'development' | 'staging' | 'production';
    version: string;
  };
}

export interface AIMetricsSummary {
  totalInteractions: number;
  totalCost: number;
  totalTokens: number;
  averageQualityScore: number;
  modelUsage: Record<string, number>;
  phaseBreakdown: Record<string, number>;
  errorRate: number;
  averageResponseTime: number;
}

/**
 * AI Metrics Logger Service
 * Tracks all AI interactions with comprehensive metrics
 */
export class AIMetricsLogger {
  private static instance: AIMetricsLogger;
  private logPath: string;
  private metricsPath: string;

  public static getInstance(): AIMetricsLogger {
    if (!AIMetricsLogger.instance) {
      AIMetricsLogger.instance = new AIMetricsLogger();
    }
    return AIMetricsLogger.instance;
  }

  private constructor() {
    const baseDir = process.env.LOGS_DIR || path.join(process.cwd(), 'logs');
    this.logPath = path.join(baseDir, 'ai-metrics');
    this.metricsPath = path.join(baseDir, 'ai-metrics', 'summaries');
    this.ensureDirectories();
  }

  /**
   * Log an AI interaction with full details
   */
  async logInteraction(entry: AIInteractionEntry): Promise<void> {
    try {
      // Generate filename based on date for daily rotation
      const date = new Date().toISOString().split('T')[0];
      const filename = `ai-metrics-${date}.jsonl`;
      const filepath = path.join(this.logPath, filename);

      // Append to daily log file
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(filepath, logLine, 'utf8');

      // Update real-time metrics
      await this.updateMetrics(entry);

      logger.info('AI interaction logged', {
        id: entry.id,
        phase: entry.phase,
        model: entry.ai.model,
        tokens: entry.ai.response.usage.totalTokens,
        cost: entry.ai.response.cost.totalCost,
        qualityScore: entry.output.quality.overallScore
      });

    } catch (error) {
      logger.error('Failed to log AI interaction', {
        error: error instanceof Error ? error.message : 'Unknown error',
        entryId: entry.id
      });
    }
  }

  /**
   * Get AI metrics summary for a date range
   */
  async getMetricsSummary(
    startDate: string,
    endDate: string
  ): Promise<AIMetricsSummary> {
    try {
      const entries = await this.getInteractions(startDate, endDate);
      
      if (entries.length === 0) {
        return this.getEmptyMetrics();
      }

      const totalCost = entries.reduce((sum, e) => sum + e.ai.response.cost.totalCost, 0);
      const totalTokens = entries.reduce((sum, e) => sum + e.ai.response.usage.totalTokens, 0);
      const totalQuality = entries.reduce((sum, e) => sum + e.output.quality.overallScore, 0);
      const totalResponseTime = entries.reduce((sum, e) => sum + e.ai.timing.duration, 0);
      
      const modelUsage: Record<string, number> = {};
      const phaseBreakdown: Record<string, number> = {};
      let errorCount = 0;

      entries.forEach(entry => {
        // Model usage
        modelUsage[entry.ai.model] = (modelUsage[entry.ai.model] || 0) + 1;
        
        // Phase breakdown
        phaseBreakdown[entry.phase] = (phaseBreakdown[entry.phase] || 0) + 1;
        
        // Error counting
        if (entry.output.validation.errors.length > 0) {
          errorCount++;
        }
      });

      return {
        totalInteractions: entries.length,
        totalCost,
        totalTokens,
        averageQualityScore: totalQuality / entries.length,
        modelUsage,
        phaseBreakdown,
        errorRate: errorCount / entries.length,
        averageResponseTime: totalResponseTime / entries.length
      };

    } catch (error) {
      logger.error('Failed to get metrics summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate,
        endDate
      });
      return this.getEmptyMetrics();
    }
  }

  /**
   * Get AI interactions for a date range
   */
  async getInteractions(
    startDate: string,
    endDate: string,
    limit?: number
  ): Promise<AIInteractionEntry[]> {
    try {
      const entries: AIInteractionEntry[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Iterate through date range
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];
        const filename = `ai-metrics-${dateStr}.jsonl`;
        const filepath = path.join(this.logPath, filename);
        
        try {
          const content = await fs.readFile(filepath, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const entry = JSON.parse(line) as AIInteractionEntry;
              entries.push(entry);
              
              if (limit && entries.length >= limit) {
                return entries;
              }
            } catch (parseError) {
              logger.warn('Failed to parse log line', { line, parseError });
            }
          }
        } catch (fileError) {
          // File doesn't exist for this date, continue
        }
      }

      return entries.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

    } catch (error) {
      logger.error('Failed to get interactions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate,
        endDate
      });
      return [];
    }
  }

  /**
   * Update real-time metrics
   */
  private async updateMetrics(entry: AIInteractionEntry): Promise<void> {
    try {
      const date = new Date().toISOString().split('T')[0];
      const metricsFile = path.join(this.metricsPath, `metrics-${date}.json`);
      
      let metrics: any = {};
      try {
        const content = await fs.readFile(metricsFile, 'utf8');
        metrics = JSON.parse(content);
      } catch (error) {
        // File doesn't exist, start with empty metrics
      }

      // Update metrics
      metrics.totalInteractions = (metrics.totalInteractions || 0) + 1;
      metrics.totalCost = (metrics.totalCost || 0) + entry.ai.response.cost.totalCost;
      metrics.totalTokens = (metrics.totalTokens || 0) + entry.ai.response.usage.totalTokens;
      
      if (!metrics.modelUsage) metrics.modelUsage = {};
      metrics.modelUsage[entry.ai.model] = (metrics.modelUsage[entry.ai.model] || 0) + 1;
      
      if (!metrics.phaseBreakdown) metrics.phaseBreakdown = {};
      metrics.phaseBreakdown[entry.phase] = (metrics.phaseBreakdown[entry.phase] || 0) + 1;

      metrics.lastUpdated = new Date().toISOString();

      await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2), 'utf8');

    } catch (error) {
      logger.warn('Failed to update real-time metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Ensure log directories exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.logPath, { recursive: true });
      await fs.mkdir(this.metricsPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create log directories', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get empty metrics structure
   */
  private getEmptyMetrics(): AIMetricsSummary {
    return {
      totalInteractions: 0,
      totalCost: 0,
      totalTokens: 0,
      averageQualityScore: 0,
      modelUsage: {},
      phaseBreakdown: {},
      errorRate: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const files = await fs.readdir(this.logPath);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      for (const file of files) {
        if (file.startsWith('ai-metrics-') && file.endsWith('.jsonl')) {
          const dateMatch = file.match(/ai-metrics-(\d{4}-\d{2}-\d{2})\.jsonl/);
          if (dateMatch) {
            const fileDate = new Date(dateMatch[1]);
            if (fileDate < cutoffDate) {
              await fs.unlink(path.join(this.logPath, file));
              logger.info('Cleaned up old log file', { file });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old logs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default AIMetricsLogger.getInstance();
