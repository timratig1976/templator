/**
 * Comprehensive Logging Service
 * Centralized logging coordination for all application areas
 */

import { QualityMetricsLogger } from './QualityMetricsLogger';
import { AIMetricsLogger } from './AIMetricsLogger';
import { createLogger } from '../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = createLogger();

// Application-wide logging interfaces
export interface PipelineExecutionLog {
  id: string;
  timestamp: string;
  userId?: string;
  sessionId: string;
  
  // Pipeline metadata
  pipeline: {
    startTime: string;
    endTime?: string;
    duration?: number;
    status: 'started' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    currentPhase?: string;
    totalPhases: number;
    completedPhases: number;
  };

  // Input details
  input: {
    fileName: string;
    fileSize: number;
    fileType: string;
    uploadTime: string;
    processingOptions?: Record<string, any>;
  };

  // Processing results
  results?: {
    htmlGenerated: boolean;
    qualityScore: number;
    hubspotCompatible: boolean;
    modulesCreated: number;
    errors: string[];
    warnings: string[];
  };

  // Performance metrics
  performance: {
    totalProcessingTime: number;
    phaseTimings: Record<string, number>;
    memoryUsage: number;
    cpuUsage?: number;
  };

  // Error tracking
  errors: Array<{
    phase: string;
    type: string;
    message: string;
    stack?: string;
    timestamp: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export interface UserActivityLog {
  id: string;
  timestamp: string;
  userId?: string;
  sessionId: string;
  
  // Activity details
  activity: {
    type: 'page_view' | 'file_upload' | 'pipeline_start' | 'dashboard_view' | 'test_run' | 'api_call';
    page?: string;
    action: string;
    details: Record<string, any>;
  };

  // User context
  context: {
    userAgent: string;
    ipAddress?: string;
    referrer?: string;
    viewport?: { width: number; height: number };
  };

  // Performance
  performance?: {
    loadTime: number;
    renderTime?: number;
    interactionTime?: number;
  };
}

export interface SystemHealthLog {
  id: string;
  timestamp: string;
  
  // System metrics
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency?: number;
  };

  // Application health
  application: {
    activeConnections: number;
    queueLength: number;
    errorRate: number;
    responseTime: number;
    uptime: number;
  };

  // Service status
  services: {
    database: 'healthy' | 'degraded' | 'down';
    openai: 'healthy' | 'degraded' | 'down';
    hubspot: 'healthy' | 'degraded' | 'down';
    fileSystem: 'healthy' | 'degraded' | 'down';
  };
}

export class ComprehensiveLogger {
  private qualityLogger: QualityMetricsLogger;
  private aiLogger: AIMetricsLogger;
  private readonly logDir: string;

  constructor() {
    this.qualityLogger = new QualityMetricsLogger();
    this.aiLogger = new AIMetricsLogger();
    this.logDir = path.join(process.cwd(), 'storage', 'app-logs');
    this.ensureLogDirectories();
  }

  /**
   * Initialize all logging directories
   */
  private async ensureLogDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      await fs.mkdir(path.join(this.logDir, 'pipeline'), { recursive: true });
      await fs.mkdir(path.join(this.logDir, 'user-activity'), { recursive: true });
      await fs.mkdir(path.join(this.logDir, 'system-health'), { recursive: true });
      
      logger.info('Comprehensive logging directories initialized', { logDir: this.logDir });
    } catch (error) {
      logger.error('Failed to create comprehensive log directories', { error });
      throw error;
    }
  }

  /**
   * Log pipeline execution
   */
  async logPipelineExecution(entry: PipelineExecutionLog): Promise<void> {
    try {
      const filename = this.getDateBasedFilename('pipeline', new Date(entry.timestamp));
      const filepath = path.join(this.logDir, 'pipeline', filename);

      await this.appendToLogFile(filepath, entry);
      
      logger.info('Pipeline execution logged', {
        id: entry.id,
        status: entry.pipeline.status,
        duration: entry.pipeline.duration,
        qualityScore: entry.results?.qualityScore
      });

    } catch (error) {
      logger.error('Failed to log pipeline execution', { error, entryId: entry.id });
    }
  }

  /**
   * Log user activity
   */
  async logUserActivity(entry: UserActivityLog): Promise<void> {
    try {
      const filename = this.getDateBasedFilename('user-activity', new Date(entry.timestamp));
      const filepath = path.join(this.logDir, 'user-activity', filename);

      await this.appendToLogFile(filepath, entry);
      
      logger.debug('User activity logged', {
        id: entry.id,
        type: entry.activity.type,
        action: entry.activity.action
      });

    } catch (error) {
      logger.error('Failed to log user activity', { error, entryId: entry.id });
    }
  }

  /**
   * Log system health metrics
   */
  async logSystemHealth(entry: SystemHealthLog): Promise<void> {
    try {
      const filename = this.getDateBasedFilename('system-health', new Date(entry.timestamp));
      const filepath = path.join(this.logDir, 'system-health', filename);

      await this.appendToLogFile(filepath, entry);
      
      // Only log if there are issues or significant changes
      if (entry.system.cpuUsage > 80 || entry.system.memoryUsage > 80 || entry.application.errorRate > 0.05) {
        logger.warn('System health metrics logged - attention needed', {
          cpuUsage: entry.system.cpuUsage,
          memoryUsage: entry.system.memoryUsage,
          errorRate: entry.application.errorRate
        });
      }

    } catch (error) {
      logger.error('Failed to log system health', { error, entryId: entry.id });
    }
  }

  /**
   * Get comprehensive application insights
   */
  async getApplicationInsights(period: '24h' | '7d' | '30d' = '24h'): Promise<{
    qualityMetrics: any;
    aiMetrics: any;
    pipelineStats: any;
    userActivity: any;
    systemHealth: any;
  }> {
    try {
      const [qualityTrends, aiMetrics, pipelineStats, userActivity, systemHealth] = await Promise.all([
        this.qualityLogger.getQualityTrends(period),
        this.aiLogger.getAIMetricsSummary(period),
        this.getPipelineStats(period),
        this.getUserActivityStats(period),
        this.getSystemHealthStats(period)
      ]);

      return {
        qualityMetrics: qualityTrends,
        aiMetrics,
        pipelineStats,
        userActivity,
        systemHealth
      };

    } catch (error) {
      logger.error('Failed to get application insights', { error, period });
      throw error;
    }
  }

  /**
   * Get pipeline execution statistics
   */
  private async getPipelineStats(period: string): Promise<any> {
    try {
      const now = new Date();
      const periodStart = this.getPeriodStart(now, period);
      
      const logFiles = await this.getLogFilesInPeriod('pipeline', periodStart, now);
      const allEntries: PipelineExecutionLog[] = [];
      
      for (const filename of logFiles) {
        try {
          const filepath = path.join(this.logDir, 'pipeline', filename);
          const fileContent = await fs.readFile(filepath, 'utf-8');
          const entries = fileContent.split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line))
            .filter(entry => {
              const entryDate = new Date(entry.timestamp);
              return entryDate >= periodStart && entryDate <= now;
            });
          
          allEntries.push(...entries);
        } catch (error) {
          logger.warn('Failed to read pipeline log file', { filename, error });
        }
      }

      // Calculate statistics
      const totalExecutions = allEntries.length;
      const completedExecutions = allEntries.filter(e => e.pipeline.status === 'completed').length;
      const failedExecutions = allEntries.filter(e => e.pipeline.status === 'failed').length;
      const averageProcessingTime = allEntries.length > 0 
        ? allEntries.reduce((sum, e) => sum + (e.performance?.totalProcessingTime || 0), 0) / allEntries.length 
        : 0;
      const averageQualityScore = allEntries.length > 0
        ? allEntries.reduce((sum, e) => sum + (e.results?.qualityScore || 0), 0) / allEntries.length
        : 0;

      return {
        period,
        totalExecutions,
        completedExecutions,
        failedExecutions,
        successRate: totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 0,
        averageProcessingTime: Math.round(averageProcessingTime),
        averageQualityScore: Math.round(averageQualityScore * 100) / 100
      };

    } catch (error) {
      logger.error('Failed to get pipeline stats', { error, period });
      return { period, error: 'Failed to calculate pipeline statistics' };
    }
  }

  /**
   * Get user activity statistics
   */
  private async getUserActivityStats(period: string): Promise<any> {
    try {
      const now = new Date();
      const periodStart = this.getPeriodStart(now, period);
      
      const logFiles = await this.getLogFilesInPeriod('user-activity', periodStart, now);
      const allEntries: UserActivityLog[] = [];
      
      for (const filename of logFiles) {
        try {
          const filepath = path.join(this.logDir, 'user-activity', filename);
          const fileContent = await fs.readFile(filepath, 'utf-8');
          const entries = fileContent.split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line))
            .filter(entry => {
              const entryDate = new Date(entry.timestamp);
              return entryDate >= periodStart && entryDate <= now;
            });
          
          allEntries.push(...entries);
        } catch (error) {
          logger.warn('Failed to read user activity log file', { filename, error });
        }
      }

      // Calculate statistics
      const totalActivities = allEntries.length;
      const uniqueSessions = new Set(allEntries.map(e => e.sessionId)).size;
      const activityTypes = allEntries.reduce((acc, entry) => {
        acc[entry.activity.type] = (acc[entry.activity.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        period,
        totalActivities,
        uniqueSessions,
        activityTypes,
        averageActivitiesPerSession: uniqueSessions > 0 ? Math.round(totalActivities / uniqueSessions) : 0
      };

    } catch (error) {
      logger.error('Failed to get user activity stats', { error, period });
      return { period, error: 'Failed to calculate user activity statistics' };
    }
  }

  /**
   * Get system health statistics
   */
  private async getSystemHealthStats(period: string): Promise<any> {
    try {
      const now = new Date();
      const periodStart = this.getPeriodStart(now, period);
      
      const logFiles = await this.getLogFilesInPeriod('system-health', periodStart, now);
      const allEntries: SystemHealthLog[] = [];
      
      for (const filename of logFiles) {
        try {
          const filepath = path.join(this.logDir, 'system-health', filename);
          const fileContent = await fs.readFile(filepath, 'utf-8');
          const entries = fileContent.split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line))
            .filter(entry => {
              const entryDate = new Date(entry.timestamp);
              return entryDate >= periodStart && entryDate <= now;
            });
          
          allEntries.push(...entries);
        } catch (error) {
          logger.warn('Failed to read system health log file', { filename, error });
        }
      }

      if (allEntries.length === 0) {
        return { period, error: 'No system health data available' };
      }

      // Calculate averages
      const avgCpuUsage = allEntries.reduce((sum, e) => sum + e.system.cpuUsage, 0) / allEntries.length;
      const avgMemoryUsage = allEntries.reduce((sum, e) => sum + e.system.memoryUsage, 0) / allEntries.length;
      const avgResponseTime = allEntries.reduce((sum, e) => sum + e.application.responseTime, 0) / allEntries.length;
      const avgErrorRate = allEntries.reduce((sum, e) => sum + e.application.errorRate, 0) / allEntries.length;

      return {
        period,
        averages: {
          cpuUsage: Math.round(avgCpuUsage * 100) / 100,
          memoryUsage: Math.round(avgMemoryUsage * 100) / 100,
          responseTime: Math.round(avgResponseTime),
          errorRate: Math.round(avgErrorRate * 10000) / 10000
        },
        healthChecks: allEntries.length
      };

    } catch (error) {
      logger.error('Failed to get system health stats', { error, period });
      return { period, error: 'Failed to calculate system health statistics' };
    }
  }

  /**
   * Helper methods
   */
  private async appendToLogFile(filepath: string, entry: any): Promise<void> {
    const logLine = JSON.stringify(entry) + '\n';
    await fs.appendFile(filepath, logLine, 'utf-8');
  }

  private getDateBasedFilename(type: string, date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${type}-${year}-${month}-${day}.jsonl`;
  }

  private getPeriodStart(now: Date, period: string): Date {
    const start = new Date(now);
    
    switch (period) {
      case '1h':
        start.setHours(start.getHours() - 1);
        break;
      case '24h':
        start.setHours(start.getHours() - 24);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
    }
    
    return start;
  }

  private async getLogFilesInPeriod(type: string, start: Date, end: Date): Promise<string[]> {
    try {
      const typeDir = path.join(this.logDir, type);
      const files = await fs.readdir(typeDir);
      const logFiles = files.filter(file => file.startsWith(`${type}-`) && file.endsWith('.jsonl'));
      
      // Filter files that might contain data in the period
      const relevantFiles = logFiles.filter(filename => {
        const match = filename.match(new RegExp(`${type}-(\\d{4})-(\\d{2})-(\\d{2})\\.jsonl`));
        if (!match) return false;
        
        const fileYear = parseInt(match[1]);
        const fileMonth = parseInt(match[2]);
        const fileDay = parseInt(match[3]);
        const fileDate = new Date(fileYear, fileMonth - 1, fileDay);
        
        return fileDate >= start && fileDate <= end;
      });

      return relevantFiles.sort();
    } catch (error) {
      logger.error('Failed to get log files in period', { error, type, start, end });
      return [];
    }
  }

  /**
   * Delegate methods to specialized loggers
   */
  async logQualityMetric(entry: any): Promise<void> {
    return this.qualityLogger.logQualityMetrics(entry);
  }

  async logAIInteraction(entry: any): Promise<void> {
    return this.aiLogger.logAIInteraction(entry);
  }

  async getQualityMetricsSummary(period: any): Promise<any> {
    return this.qualityLogger.getQualityTrends(period);
  }

  async getAIMetricsSummary(period: any): Promise<any> {
    return this.aiLogger.getAIMetricsSummary(period);
  }
}
