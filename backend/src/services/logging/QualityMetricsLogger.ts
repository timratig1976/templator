/**
 * Quality Metrics Logger
 * File-based logging system for quality trends and historical data
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

export interface QualityMetricEntry {
  timestamp: string;
  pipelineId: string;
  metrics: {
    codeQuality: number;
    testCoverage: number;
    performance: number;
    security: number;
    accessibility: number;
    hubspotCompliance: number;
  };
  metadata: {
    sectionsProcessed: number;
    processingTime: number;
    aiModel: string;
    version: string;
  };
}

export interface QualityTrendData {
  period: '24h' | '7d' | '30d';
  data: QualityMetricEntry[];
  summary: {
    averageQuality: number;
    trend: 'improving' | 'declining' | 'stable';
    totalExecutions: number;
    periodStart: string;
    periodEnd: string;
  };
}

export class QualityMetricsLogger {
  private readonly logDir: string;
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly maxFiles = 12; // Keep 12 months of data

  constructor() {
    this.logDir = path.join(process.cwd(), 'storage', 'quality-logs');
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      logger.info('Quality metrics log directory initialized', { logDir: this.logDir });
    } catch (error) {
      logger.error('Failed to create quality metrics log directory', { error, logDir: this.logDir });
      throw error;
    }
  }

  /**
   * Log quality metrics for a pipeline execution
   */
  async logQualityMetrics(entry: QualityMetricEntry): Promise<void> {
    try {
      const filename = this.getLogFilename(new Date(entry.timestamp));
      const filepath = path.join(this.logDir, filename);

      // Read existing data or create new array
      let existingData: QualityMetricEntry[] = [];
      try {
        const fileContent = await fs.readFile(filepath, 'utf-8');
        existingData = JSON.parse(fileContent);
      } catch (error) {
        // File doesn't exist or is empty, start with empty array
        existingData = [];
      }

      // Add new entry
      existingData.push(entry);

      // Sort by timestamp (newest first)
      existingData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Write back to file
      await fs.writeFile(filepath, JSON.stringify(existingData, null, 2), 'utf-8');

      logger.info('Quality metrics logged successfully', {
        pipelineId: entry.pipelineId,
        filename,
        totalEntries: existingData.length
      });

      // Check if file rotation is needed
      await this.rotateLogsIfNeeded();

    } catch (error) {
      logger.error('Failed to log quality metrics', { error, pipelineId: entry.pipelineId });
      throw error;
    }
  }

  /**
   * Get quality trends for a specific period
   */
  async getQualityTrends(period: '24h' | '7d' | '30d'): Promise<QualityTrendData> {
    try {
      const now = new Date();
      const periodStart = this.getPeriodStart(now, period);
      
      // Get all relevant log files
      const logFiles = await this.getLogFilesInPeriod(periodStart, now);
      
      // Read and aggregate data
      const allEntries: QualityMetricEntry[] = [];
      
      for (const filename of logFiles) {
        try {
          const filepath = path.join(this.logDir, filename);
          const fileContent = await fs.readFile(filepath, 'utf-8');
          const entries: QualityMetricEntry[] = JSON.parse(fileContent);
          
          // Filter entries within the period
          const filteredEntries = entries.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate >= periodStart && entryDate <= now;
          });
          
          allEntries.push(...filteredEntries);
        } catch (error) {
          logger.warn('Failed to read log file', { filename, error });
        }
      }

      // Sort by timestamp
      allEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Calculate summary
      const summary = this.calculateTrendSummary(allEntries, periodStart, now);

      return {
        period,
        data: allEntries,
        summary
      };

    } catch (error) {
      logger.error('Failed to get quality trends', { error, period });
      throw error;
    }
  }

  /**
   * Get recent quality metrics (last N entries)
   */
  async getRecentMetrics(limit: number = 10): Promise<QualityMetricEntry[]> {
    try {
      const now = new Date();
      const filename = this.getLogFilename(now);
      const filepath = path.join(this.logDir, filename);

      try {
        const fileContent = await fs.readFile(filepath, 'utf-8');
        const entries: QualityMetricEntry[] = JSON.parse(fileContent);
        
        // Return most recent entries
        return entries.slice(0, limit);
      } catch (error) {
        // File doesn't exist, return empty array
        return [];
      }

    } catch (error) {
      logger.error('Failed to get recent metrics', { error, limit });
      return [];
    }
  }

  /**
   * Get log filename for a given date
   */
  private getLogFilename(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `quality-metrics-${year}-${month}.json`;
  }

  /**
   * Get period start date
   */
  private getPeriodStart(now: Date, period: '24h' | '7d' | '30d'): Date {
    const start = new Date(now);
    
    switch (period) {
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

  /**
   * Get log files that might contain data for the given period
   */
  private async getLogFilesInPeriod(start: Date, end: Date): Promise<string[]> {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('quality-metrics-') && file.endsWith('.json'));
      
      // Filter files that might contain data in the period
      const relevantFiles = logFiles.filter(filename => {
        const match = filename.match(/quality-metrics-(\d{4})-(\d{2})\.json/);
        if (!match) return false;
        
        const fileYear = parseInt(match[1]);
        const fileMonth = parseInt(match[2]);
        const fileDate = new Date(fileYear, fileMonth - 1, 1);
        const fileEndDate = new Date(fileYear, fileMonth, 0); // Last day of month
        
        // Check if file period overlaps with requested period
        return fileDate <= end && fileEndDate >= start;
      });

      return relevantFiles.sort();
    } catch (error) {
      logger.error('Failed to get log files in period', { error, start, end });
      return [];
    }
  }

  /**
   * Calculate trend summary from entries
   */
  private calculateTrendSummary(
    entries: QualityMetricEntry[], 
    periodStart: Date, 
    periodEnd: Date
  ): QualityTrendData['summary'] {
    if (entries.length === 0) {
      return {
        averageQuality: 0,
        trend: 'stable',
        totalExecutions: 0,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString()
      };
    }

    // Calculate average quality
    const totalQuality = entries.reduce((sum, entry) => {
      const avgMetrics = (
        entry.metrics.codeQuality +
        entry.metrics.testCoverage +
        entry.metrics.performance +
        entry.metrics.security +
        entry.metrics.accessibility +
        entry.metrics.hubspotCompliance
      ) / 6;
      return sum + avgMetrics;
    }, 0);

    const averageQuality = totalQuality / entries.length;

    // Calculate trend (compare first half vs second half)
    const trend = this.calculateTrend(entries);

    return {
      averageQuality: Math.round(averageQuality * 100) / 100,
      trend,
      totalExecutions: entries.length,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    };
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(entries: QualityMetricEntry[]): 'improving' | 'declining' | 'stable' {
    if (entries.length < 4) return 'stable';

    const midpoint = Math.floor(entries.length / 2);
    const firstHalf = entries.slice(0, midpoint);
    const secondHalf = entries.slice(midpoint);

    const firstHalfAvg = this.calculateAverageQuality(firstHalf);
    const secondHalfAvg = this.calculateAverageQuality(secondHalf);

    const difference = secondHalfAvg - firstHalfAvg;

    if (difference > 2) return 'improving';
    if (difference < -2) return 'declining';
    return 'stable';
  }

  /**
   * Calculate average quality for a set of entries
   */
  private calculateAverageQuality(entries: QualityMetricEntry[]): number {
    if (entries.length === 0) return 0;

    const total = entries.reduce((sum, entry) => {
      const avgMetrics = (
        entry.metrics.codeQuality +
        entry.metrics.testCoverage +
        entry.metrics.performance +
        entry.metrics.security +
        entry.metrics.accessibility +
        entry.metrics.hubspotCompliance
      ) / 6;
      return sum + avgMetrics;
    }, 0);

    return total / entries.length;
  }

  /**
   * Rotate logs if files are too large
   */
  private async rotateLogsIfNeeded(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('quality-metrics-') && file.endsWith('.json'));

      // Check file sizes and rotate if needed
      for (const filename of logFiles) {
        const filepath = path.join(this.logDir, filename);
        const stats = await fs.stat(filepath);
        
        if (stats.size > this.maxFileSize) {
          logger.info('Log file size limit reached, considering rotation', { 
            filename, 
            size: stats.size,
            maxSize: this.maxFileSize 
          });
          // For monthly files, we don't rotate but warn about large files
          logger.warn('Large log file detected - consider archiving', { filename, size: stats.size });
        }
      }

      // Remove old files if we have too many
      if (logFiles.length > this.maxFiles) {
        const sortedFiles = logFiles.sort();
        const filesToRemove = sortedFiles.slice(0, logFiles.length - this.maxFiles);
        
        for (const filename of filesToRemove) {
          const filepath = path.join(this.logDir, filename);
          await fs.unlink(filepath);
          logger.info('Old log file removed', { filename });
        }
      }

    } catch (error) {
      logger.error('Failed to rotate logs', { error });
    }
  }

  /**
   * Get log statistics
   */
  async getLogStatistics(): Promise<{
    totalFiles: number;
    totalEntries: number;
    oldestEntry: string | null;
    newestEntry: string | null;
    diskUsage: number;
  }> {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('quality-metrics-') && file.endsWith('.json'));
      
      let totalEntries = 0;
      let oldestEntry: string | null = null;
      let newestEntry: string | null = null;
      let diskUsage = 0;

      for (const filename of logFiles) {
        const filepath = path.join(this.logDir, filename);
        const stats = await fs.stat(filepath);
        diskUsage += stats.size;

        try {
          const fileContent = await fs.readFile(filepath, 'utf-8');
          const entries: QualityMetricEntry[] = JSON.parse(fileContent);
          totalEntries += entries.length;

          for (const entry of entries) {
            if (!oldestEntry || entry.timestamp < oldestEntry) {
              oldestEntry = entry.timestamp;
            }
            if (!newestEntry || entry.timestamp > newestEntry) {
              newestEntry = entry.timestamp;
            }
          }
        } catch (error) {
          logger.warn('Failed to read log file for statistics', { filename, error });
        }
      }

      return {
        totalFiles: logFiles.length,
        totalEntries,
        oldestEntry,
        newestEntry,
        diskUsage
      };

    } catch (error) {
      logger.error('Failed to get log statistics', { error });
      return {
        totalFiles: 0,
        totalEntries: 0,
        oldestEntry: null,
        newestEntry: null,
        diskUsage: 0
      };
    }
  }
}

// Export singleton instance
export const qualityMetricsLogger = new QualityMetricsLogger();
