/**
 * Comprehensive Logger Service
 * Centralized logging with structured data, correlation IDs, and multiple output formats
 * Consolidated from the original ComprehensiveLogger with improved structure
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../../../utils/logger';

const logger = createLogger();

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  
  // Context information
  context: {
    service: string;
    operation: string;
    correlationId?: string;
    userId?: string;
    sessionId?: string;
    requestId?: string;
  };
  
  // Structured data
  data?: Record<string, any>;
  
  // Error information
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  
  // Performance metrics
  performance?: {
    duration?: number;
    memoryUsage?: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
  };
  
  // Environment information
  environment: {
    nodeVersion: string;
    platform: string;
    hostname: string;
    pid: number;
  };
}

export interface LogFilter {
  level?: string[];
  service?: string[];
  operation?: string[];
  correlationId?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
}

/**
 * Comprehensive Logger Service
 * Provides structured logging with correlation tracking and performance metrics
 */
export class ComprehensiveLogger {
  private static instance: ComprehensiveLogger;
  private logPath: string;
  private environment: LogEntry['environment'];

  public static getInstance(): ComprehensiveLogger {
    if (!ComprehensiveLogger.instance) {
      ComprehensiveLogger.instance = new ComprehensiveLogger();
    }
    return ComprehensiveLogger.instance;
  }

  private constructor() {
    const baseDir = process.env.LOGS_DIR || path.join(process.cwd(), 'logs');
    this.logPath = path.join(baseDir, 'comprehensive');
    
    this.environment = {
      nodeVersion: process.version,
      platform: process.platform,
      hostname: require('os').hostname(),
      pid: process.pid
    };
    
    this.ensureDirectories();
  }

  /**
   * Log a debug message
   */
  async debug(
    message: string,
    context: Partial<LogEntry['context']>,
    data?: Record<string, any>
  ): Promise<void> {
    await this.log('debug', message, context, data);
  }

  /**
   * Log an info message
   */
  async info(
    message: string,
    context: Partial<LogEntry['context']>,
    data?: Record<string, any>
  ): Promise<void> {
    await this.log('info', message, context, data);
  }

  /**
   * Log a warning message
   */
  async warn(
    message: string,
    context: Partial<LogEntry['context']>,
    data?: Record<string, any>
  ): Promise<void> {
    await this.log('warn', message, context, data);
  }

  /**
   * Log an error message
   */
  async error(
    message: string,
    context: Partial<LogEntry['context']>,
    error?: Error,
    data?: Record<string, any>
  ): Promise<void> {
    const errorInfo = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    } : undefined;

    await this.log('error', message, context, data, errorInfo);
  }

  /**
   * Log a fatal error message
   */
  async fatal(
    message: string,
    context: Partial<LogEntry['context']>,
    error?: Error,
    data?: Record<string, any>
  ): Promise<void> {
    const errorInfo = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    } : undefined;

    await this.log('fatal', message, context, data, errorInfo);
  }

  /**
   * Log with performance metrics
   */
  async logWithPerformance(
    level: LogEntry['level'],
    message: string,
    context: Partial<LogEntry['context']>,
    startTime: [number, number],
    data?: Record<string, any>
  ): Promise<void> {
    const endTime = process.hrtime(startTime);
    const duration = endTime[0] * 1000 + endTime[1] / 1000000; // Convert to milliseconds

    const performance = {
      duration,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };

    await this.log(level, message, context, data, undefined, performance);
  }

  /**
   * Core logging method
   */
  private async log(
    level: LogEntry['level'],
    message: string,
    context: Partial<LogEntry['context']>,
    data?: Record<string, any>,
    error?: LogEntry['error'],
    performance?: LogEntry['performance']
  ): Promise<void> {
    try {
      const entry: LogEntry = {
        id: this.generateId(),
        timestamp: new Date().toISOString(),
        level,
        message,
        context: {
          service: context.service || 'unknown',
          operation: context.operation || 'unknown',
          correlationId: context.correlationId,
          userId: context.userId,
          sessionId: context.sessionId,
          requestId: context.requestId
        },
        data,
        error,
        performance,
        environment: this.environment
      };

      // Write to daily log file
      await this.writeToFile(entry);

      // Also log to console for development
      if (process.env.NODE_ENV === 'development') {
        this.logToConsole(entry);
      }

    } catch (logError) {
      // Fallback to basic console logging if structured logging fails
      console.error('Failed to write structured log:', logError);
      console.log(`[${level.toUpperCase()}] ${message}`, { context, data, error });
    }
  }

  /**
   * Write log entry to file
   */
  private async writeToFile(entry: LogEntry): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const filename = `comprehensive-${date}.jsonl`;
    const filepath = path.join(this.logPath, filename);

    const logLine = JSON.stringify(entry) + '\n';
    await fs.appendFile(filepath, logLine, 'utf8');
  }

  /**
   * Log to console for development
   */
  private logToConsole(entry: LogEntry): void {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m'  // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[entry.level] || '';

    console.log(
      `${color}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp} ` +
      `[${entry.context.service}:${entry.context.operation}] ${entry.message}`,
      entry.data ? entry.data : ''
    );

    if (entry.error) {
      console.error(`${colors.error}Error:${reset}`, entry.error);
    }
  }

  /**
   * Query logs with filters
   */
  async queryLogs(filter: LogFilter = {}): Promise<LogEntry[]> {
    try {
      const entries: LogEntry[] = [];
      const startDate = filter.startTime ? new Date(filter.startTime) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to last 7 days
      const endDate = filter.endTime ? new Date(filter.endTime) : new Date();

      // Iterate through date range
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];
        const filename = `comprehensive-${dateStr}.jsonl`;
        const filepath = path.join(this.logPath, filename);

        try {
          const content = await fs.readFile(filepath, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const entry = JSON.parse(line) as LogEntry;
              
              // Apply filters
              if (this.matchesFilter(entry, filter)) {
                entries.push(entry);
                
                if (filter.limit && entries.length >= filter.limit) {
                  return entries;
                }
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
      logger.error('Failed to query logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filter
      });
      return [];
    }
  }

  /**
   * Check if log entry matches filter criteria
   */
  private matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
    if (filter.level && !filter.level.includes(entry.level)) {
      return false;
    }

    if (filter.service && !filter.service.includes(entry.context.service)) {
      return false;
    }

    if (filter.operation && !filter.operation.includes(entry.context.operation)) {
      return false;
    }

    if (filter.correlationId && entry.context.correlationId !== filter.correlationId) {
      return false;
    }

    if (filter.startTime && entry.timestamp < filter.startTime) {
      return false;
    }

    if (filter.endTime && entry.timestamp > filter.endTime) {
      return false;
    }

    return true;
  }

  /**
   * Get log statistics
   */
  async getLogStats(days: number = 7): Promise<{
    totalEntries: number;
    levelBreakdown: Record<string, number>;
    serviceBreakdown: Record<string, number>;
    errorRate: number;
    averageEntriesPerDay: number;
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
      
      const entries = await this.queryLogs({
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString()
      });

      const levelBreakdown: Record<string, number> = {};
      const serviceBreakdown: Record<string, number> = {};
      let errorCount = 0;

      entries.forEach(entry => {
        levelBreakdown[entry.level] = (levelBreakdown[entry.level] || 0) + 1;
        serviceBreakdown[entry.context.service] = (serviceBreakdown[entry.context.service] || 0) + 1;
        
        if (entry.level === 'error' || entry.level === 'fatal') {
          errorCount++;
        }
      });

      return {
        totalEntries: entries.length,
        levelBreakdown,
        serviceBreakdown,
        errorRate: entries.length > 0 ? errorCount / entries.length : 0,
        averageEntriesPerDay: entries.length / days
      };

    } catch (error) {
      logger.error('Failed to get log stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        totalEntries: 0,
        levelBreakdown: {},
        serviceBreakdown: {},
        errorRate: 0,
        averageEntriesPerDay: 0
      };
    }
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
        if (file.startsWith('comprehensive-') && file.endsWith('.jsonl')) {
          const dateMatch = file.match(/comprehensive-(\d{4}-\d{2}-\d{2})\.jsonl/);
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

  /**
   * Ensure log directories exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.logPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create log directories', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate unique ID for log entries
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ComprehensiveLogger.getInstance();
