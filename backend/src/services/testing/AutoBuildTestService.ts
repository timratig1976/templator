/**
 * Auto Build Test Service
 * Periodically validates TypeScript compilation across all services
 * Detects build issues, import problems, and dependency conflicts
 */

import { createLogger } from '../../utils/logger';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

const logger = createLogger();

export interface BuildTestResult {
  success: boolean;
  timestamp: Date;
  duration: number;
  errors: BuildError[];
  warnings: BuildWarning[];
  filesCounted: number;
  summary: BuildSummary;
}

export interface BuildError {
  file: string;
  line: number;
  column: number;
  message: string;
  code: string;
  severity: 'error' | 'warning';
  category: BuildErrorCategory;
}

export interface BuildWarning {
  file: string;
  message: string;
  suggestion?: string;
}

export interface BuildSummary {
  totalFiles: number;
  errorFiles: number;
  warningFiles: number;
  newFiles: string[];
  modifiedFiles: string[];
  serviceHealth: ServiceHealthReport;
}

export interface ServiceHealthReport {
  [phase: string]: {
    status: 'healthy' | 'warning' | 'error';
    fileCount: number;
    errorCount: number;
    lastChecked: Date;
  };
}

export type BuildErrorCategory = 
  | 'import_path' 
  | 'type_error' 
  | 'syntax_error' 
  | 'dependency_missing' 
  | 'circular_dependency'
  | 'unused_import'
  | 'unknown';

export interface AutoBuildTestConfig {
  interval: number; // minutes
  enabled: boolean;
  watchDirectories: string[];
  excludePatterns: string[];
  notifyOnError: boolean;
  generateReport: boolean;
  maxErrorsToReport: number;
}

export class AutoBuildTestService extends EventEmitter {
  private config: AutoBuildTestConfig;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastBuildTime: Date | null = null;
  private fileWatchers: Map<string, Date> = new Map();
  private buildHistory: BuildTestResult[] = [];

  constructor(config?: Partial<AutoBuildTestConfig>) {
    super();
    
    this.config = {
      interval: 15, // 15 minutes default
      enabled: true,
      watchDirectories: [
        'src/services',
        'src/pipeline',
        'src/routes',
        'src/controllers',
        'src/middleware',
        'src/utils'
      ],
      excludePatterns: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts'
      ],
      notifyOnError: true,
      generateReport: true,
      maxErrorsToReport: 50,
      ...config
    };

    logger.info('🔧 AutoBuildTestService initialized', {
      interval: this.config.interval,
      enabled: this.config.enabled,
      watchDirectories: this.config.watchDirectories.length
    });
  }

  /**
   * Start the auto build test service
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('AutoBuildTestService is already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting AutoBuildTestService', {
      interval: `${this.config.interval} minutes`
    });

    // Run initial build test
    await this.runBuildTest();

    // Set up periodic testing
    if (this.config.enabled) {
      this.intervalId = setInterval(async () => {
        try {
          await this.runBuildTest();
        } catch (error) {
          logger.error('Error in periodic build test:', error);
          this.emit('error', error);
        }
      }, this.config.interval * 60 * 1000);
    }

    this.emit('started');
  }

  /**
   * Stop the auto build test service
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('🛑 AutoBuildTestService stopped');
    this.emit('stopped');
  }

  /**
   * Run a comprehensive build test
   */
  public async runBuildTest(): Promise<BuildTestResult> {
    const startTime = Date.now();
    logger.info('🔍 Starting comprehensive build test...');

    try {
      // Scan for files
      const files = await this.scanTypeScriptFiles();
      
      // Check for new/modified files
      const fileChanges = await this.detectFileChanges(files);
      
      // Run TypeScript compilation
      const compileResult = await this.runTypeScriptCompilation();
      
      // Analyze errors
      const analyzedErrors = this.analyzeErrors(compileResult.errors);
      
      // Generate service health report
      const serviceHealth = await this.generateServiceHealthReport(analyzedErrors);
      
      const duration = Date.now() - startTime;
      const result: BuildTestResult = {
        success: compileResult.success,
        timestamp: new Date(),
        duration,
        errors: analyzedErrors,
        warnings: compileResult.warnings,
        filesCounted: files.length,
        summary: {
          totalFiles: files.length,
          errorFiles: this.countUniqueErrorFiles(analyzedErrors),
          warningFiles: this.countUniqueWarningFiles(compileResult.warnings),
          newFiles: fileChanges.newFiles,
          modifiedFiles: fileChanges.modifiedFiles,
          serviceHealth
        }
      };

      // Store in history
      this.buildHistory.push(result);
      if (this.buildHistory.length > 100) {
        this.buildHistory = this.buildHistory.slice(-100);
      }

      this.lastBuildTime = new Date();

      // Log results
      if (result.success) {
        logger.info('✅ Build test completed successfully', {
          duration: `${duration}ms`,
          files: files.length,
          warnings: result.warnings.length
        });
      } else {
        logger.error('❌ Build test failed', {
          duration: `${duration}ms`,
          files: files.length,
          errors: result.errors.length,
          warnings: result.warnings.length
        });
      }

      // Generate report if configured
      if (this.config.generateReport) {
        await this.generateBuildReport(result);
      }

      // Emit events
      this.emit('buildTestComplete', result);
      if (!result.success && this.config.notifyOnError) {
        this.emit('buildError', result);
      }

      return result;

    } catch (error) {
      logger.error('Failed to run build test:', error);
      const duration = Date.now() - startTime;
      
      const errorResult: BuildTestResult = {
        success: false,
        timestamp: new Date(),
        duration,
        errors: [{
          file: 'system',
          line: 0,
          column: 0,
          message: `Build test system error: ${error}`,
          code: 'SYSTEM_ERROR',
          severity: 'error',
          category: 'unknown'
        }],
        warnings: [],
        filesCounted: 0,
        summary: {
          totalFiles: 0,
          errorFiles: 1,
          warningFiles: 0,
          newFiles: [],
          modifiedFiles: [],
          serviceHealth: {}
        }
      };

      this.emit('error', error);
      return errorResult;
    }
  }

  /**
   * Scan for TypeScript files in watched directories
   */
  private async scanTypeScriptFiles(): Promise<string[]> {
    const files: string[] = [];
    
    for (const dir of this.config.watchDirectories) {
      const dirPath = path.resolve(process.cwd(), dir);
      try {
        const dirFiles = await this.scanDirectory(dirPath);
        files.push(...dirFiles);
      } catch (error) {
        logger.warn(`Failed to scan directory ${dir}:`, error);
      }
    }

    return files.filter(file => 
      file.endsWith('.ts') && 
      !this.isExcluded(file)
    );
  }

  /**
   * Recursively scan directory for files
   */
  private async scanDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }
    
    return files;
  }

  /**
   * Check if file should be excluded
   */
  private isExcluded(filePath: string): boolean {
    return this.config.excludePatterns.some(pattern => {
      // Simple glob pattern matching
      const regex = new RegExp(
        pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '.')
      );
      return regex.test(filePath);
    });
  }

  /**
   * Detect new and modified files
   */
  private async detectFileChanges(files: string[]): Promise<{
    newFiles: string[];
    modifiedFiles: string[];
  }> {
    const newFiles: string[] = [];
    const modifiedFiles: string[] = [];

    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        const lastModified = stats.mtime;
        const previousModified = this.fileWatchers.get(file);

        if (!previousModified) {
          newFiles.push(file);
        } else if (lastModified > previousModified) {
          modifiedFiles.push(file);
        }

        this.fileWatchers.set(file, lastModified);
      } catch (error) {
        // File might have been deleted
        this.fileWatchers.delete(file);
      }
    }

    return { newFiles, modifiedFiles };
  }

  /**
   * Run TypeScript compilation and capture output
   */
  private async runTypeScriptCompilation(): Promise<{
    success: boolean;
    errors: any[];
    warnings: BuildWarning[];
  }> {
    return new Promise((resolve) => {
      const tscProcess = spawn('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      tscProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      tscProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      tscProcess.on('close', (code) => {
        const success = code === 0;
        const errors = this.parseTypeScriptErrors(stderr + stdout);
        const warnings: BuildWarning[] = [];

        resolve({
          success,
          errors,
          warnings
        });
      });

      tscProcess.on('error', (error) => {
        resolve({
          success: false,
          errors: [{
            file: 'system',
            line: 0,
            column: 0,
            message: `TypeScript compilation failed: ${error.message}`,
            code: 'TS_COMPILE_ERROR',
            severity: 'error' as const,
            category: 'unknown' as const
          }],
          warnings: []
        });
      });
    });
  }

  /**
   * Parse TypeScript compiler errors
   */
  private parseTypeScriptErrors(output: string): BuildError[] {
    const errors: BuildError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Parse TypeScript error format: file(line,col): error TSxxxx: message
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);
      
      if (match) {
        const [, file, lineNum, colNum, severity, code, message] = match;
        
        errors.push({
          file: path.relative(process.cwd(), file),
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          message: message.trim(),
          code,
          severity: severity as 'error' | 'warning',
          category: this.categorizeError(message, code)
        });
      }
    }

    return errors;
  }

  /**
   * Categorize build errors for better analysis
   */
  private categorizeError(message: string, code: string): BuildErrorCategory {
    if (message.includes('Cannot find module') || message.includes('Module not found')) {
      return 'import_path';
    }
    if (message.includes('Circular dependency')) {
      return 'circular_dependency';
    }
    if (message.includes('is declared but never used')) {
      return 'unused_import';
    }
    if (code.startsWith('TS2')) {
      return 'type_error';
    }
    if (code.startsWith('TS1')) {
      return 'syntax_error';
    }
    return 'unknown';
  }

  /**
   * Analyze errors and provide insights
   */
  private analyzeErrors(errors: any[]): BuildError[] {
    return errors.slice(0, this.config.maxErrorsToReport);
  }

  /**
   * Generate service health report by phase
   */
  private async generateServiceHealthReport(errors: BuildError[]): Promise<ServiceHealthReport> {
    const report: ServiceHealthReport = {};
    const phases = ['ai', 'analysis', 'deployment', 'input', 'module', 'quality', 'schema', 'storage', 'testing'];

    for (const phase of phases) {
      const phaseErrors = errors.filter(error => 
        error.file.includes(`/services/${phase}/`)
      );

      const phaseFiles = await this.countFilesInPhase(phase);

      report[phase] = {
        status: phaseErrors.length === 0 ? 'healthy' : 
                phaseErrors.some(e => e.severity === 'error') ? 'error' : 'warning',
        fileCount: phaseFiles,
        errorCount: phaseErrors.length,
        lastChecked: new Date()
      };
    }

    return report;
  }

  /**
   * Count files in a service phase
   */
  private async countFilesInPhase(phase: string): Promise<number> {
    try {
      const phasePath = path.join(process.cwd(), 'src', 'services', phase);
      const files = await this.scanDirectory(phasePath);
      return files.filter(f => f.endsWith('.ts')).length;
    } catch {
      return 0;
    }
  }

  /**
   * Count unique files with errors
   */
  private countUniqueErrorFiles(errors: BuildError[]): number {
    const uniqueFiles = new Set(errors.map(e => e.file));
    return uniqueFiles.size;
  }

  /**
   * Count unique files with warnings
   */
  private countUniqueWarningFiles(warnings: BuildWarning[]): number {
    const uniqueFiles = new Set(warnings.map(w => w.file));
    return uniqueFiles.size;
  }

  /**
   * Generate detailed build report
   */
  private async generateBuildReport(result: BuildTestResult): Promise<void> {
    const reportPath = path.join(process.cwd(), 'build-reports');
    
    try {
      await fs.mkdir(reportPath, { recursive: true });
      
      const timestamp = result.timestamp.toISOString().replace(/[:.]/g, '-');
      const reportFile = path.join(reportPath, `build-report-${timestamp}.json`);
      
      await fs.writeFile(reportFile, JSON.stringify(result, null, 2));
      
      logger.info('📊 Build report generated', { reportFile });
    } catch (error) {
      logger.error('Failed to generate build report:', error);
    }
  }

  /**
   * Get build history
   */
  public getBuildHistory(): BuildTestResult[] {
    return [...this.buildHistory];
  }

  /**
   * Get latest build result
   */
  public getLatestBuildResult(): BuildTestResult | null {
    return this.buildHistory.length > 0 ? 
      this.buildHistory[this.buildHistory.length - 1] : null;
  }

  /**
   * Get service health summary
   */
  public getServiceHealthSummary(): ServiceHealthReport {
    const latest = this.getLatestBuildResult();
    return latest?.summary.serviceHealth || {};
  }

  /**
   * Check if service is healthy
   */
  public isServiceHealthy(): boolean {
    const latest = this.getLatestBuildResult();
    return latest?.success || false;
  }
}

export default AutoBuildTestService;
