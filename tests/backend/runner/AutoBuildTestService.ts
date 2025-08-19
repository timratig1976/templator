/**
 * Auto Build Test Service
 * Periodically validates TypeScript compilation across all services
 * Detects build issues, import problems, and dependency conflicts
 */

import { createLogger } from '../../../backend/src/utils/logger';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { WebSocketService } from '../../../backend/src/services/core/websocket/WebSocketService';

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

  private ws(): WebSocketService | null {
    try {
      return WebSocketService.getInstance();
    } catch {
      return null;
    }
  }

  private emitProgress(phase: string, message: string, progress: number, details?: any) {
    try {
      this.ws()?.sendProgress('build-test', { phase, message, progress, details });
    } catch {
      // ignore socket errors
    }
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
      // Avoid background timers during Jest to prevent open handle leaks
      if (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test') {
        logger.debug('Skipping AutoBuildTestService interval in test environment');
        this.emit('started');
        return;
      }
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
    // Concurrency guard
    if (this.isRunning) {
      logger.warn('Build test already running, ignoring new request');
      const now = new Date();
      return {
        success: false,
        timestamp: now,
        duration: 0,
        errors: [{
          file: 'system',
          line: 0,
          column: 0,
          message: 'Build test already running',
          code: 'ALREADY_RUNNING',
          severity: 'warning',
          category: 'unknown'
        }],
        warnings: [],
        filesCounted: 0,
        summary: {
          totalFiles: 0,
          errorFiles: 0,
          warningFiles: 0,
          newFiles: [],
          modifiedFiles: [],
          serviceHealth: {}
        }
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    logger.info('🔍 Starting comprehensive build test...');
    this.emitProgress('start', 'Starting build test', 1);
    // Emit config so UI can render suites/filters early
    this.emitProgress('config', 'Build test configuration', 2, {
      watchDirectories: this.config.watchDirectories,
      excludePatterns: this.config.excludePatterns,
      intervalMinutes: this.config.interval,
      generateReport: this.config.generateReport
    });

    try {
      // Scan for files
      this.emitProgress('scan', 'Scanning TypeScript files', 5);
      const files = await this.scanTypeScriptFiles();
      this.emitProgress('scan:done', 'File scan complete', 12, {
        totalFiles: files.length,
        sample: files.slice(0, 25),
      });
      
      // Check for new/modified files
      this.emitProgress('changes', 'Detecting file changes', 15);
      const fileChanges = await this.detectFileChanges(files);
      this.emitProgress('changes:done', 'File change detection complete', 25, {
        newFiles: fileChanges.newFiles,
        modifiedFiles: fileChanges.modifiedFiles,
        newCount: fileChanges.newFiles.length,
        modifiedCount: fileChanges.modifiedFiles.length,
      });
      
      // Run TypeScript compilation
      this.emitProgress('compile', 'Running TypeScript compilation', 40, {
        command: 'npx -y tsc --noEmit --pretty false'
      });
      const compileResult = await this.runTypeScriptCompilation();
      this.emitProgress('compile:done', 'TypeScript compilation finished', 60, {
        success: compileResult.success,
        errorCount: compileResult.errors?.length || 0,
        warningCount: compileResult.warnings?.length || 0,
      });
      
      // Analyze errors
      this.emitProgress('analyze', 'Analyzing results', 70, { errorCount: compileResult.errors?.length || 0 });
      const analyzedErrors = this.analyzeErrors(compileResult.errors);
      this.emitProgress('analyze:done', 'Analysis complete', 80, {
        topErrors: analyzedErrors.slice(0, 10),
      });
      
      // Generate service health report
      this.emitProgress('health', 'Generating service health report', 85);
      const serviceHealth = await this.generateServiceHealthReport(analyzedErrors);
      this.emitProgress('health:done', 'Service health computed', 90, {
        phases: Object.keys(serviceHealth),
        summary: serviceHealth,
      });
      
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
        this.emitProgress('report', 'Writing build report', 92);
        const reportFile = await this.generateBuildReport(result);
        if (reportFile) {
          this.emitProgress('report:done', 'Build report written', 95, { reportFile });
        }
      }

      // Emit events
      this.emit('buildTestComplete', result);
      if (!result.success && this.config.notifyOnError) {
        this.emit('buildError', result);
      }

      this.emitProgress('complete', result.success ? 'Build test completed' : 'Build test completed with errors', 100, {
        success: result.success,
        errors: result.errors?.length || 0,
        warnings: result.warnings?.length || 0,
        files: result.filesCounted,
        summary: result.summary,
      });

      return result;

    } catch (error) {
      logger.error('Failed to run build test:', error);
      const duration = Date.now() - startTime;
      this.emitProgress('error', 'Build test failed', 100, { error: String(error) });
      
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
    } finally {
      this.isRunning = false;
      logger.info('🧹 Build test run finished, isRunning reset');
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
      const args = ['-y', 'tsc', '--noEmit', '--pretty', 'false'];
      const timeoutMs = 120000; // 2 minutes hard timeout

      logger.info('🧪 Running TypeScript compile check', { cmd: 'npx', args, timeoutMs });

      const tscProcess: ChildProcess = spawn('npx', args, {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
      });

      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        try {
          logger.error('TypeScript compilation timed out, terminating process', { timeoutMs });
          tscProcess.kill('SIGKILL');
        } catch {}
      }, timeoutMs);

      tscProcess.stdout?.on('data', (d) => { stdout += d.toString(); });
      tscProcess.stderr?.on('data', (d) => { stderr += d.toString(); });

      const finalize = (successCode: number | null, errorOverride?: string) => {
        clearTimeout(timer);
        const output = (stderr || '') + (stdout || '');
        let errors: any[] = [];
        if (errorOverride) {
          errors = [{
            file: 'system', line: 0, column: 0,
            message: errorOverride, code: 'TS_COMPILE_ERROR', severity: 'error' as const, category: 'unknown' as const
          }];
        } else {
          errors = this.parseTypeScriptErrors(output);
        }
        resolve({ success: successCode === 0 && errors.length === 0, errors, warnings: [] });
      };

      tscProcess.on('close', (code) => finalize(code ?? 0));
      tscProcess.on('error', (err) => finalize(1, `TypeScript compilation failed: ${err.message}`));
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
  private async generateBuildReport(result: BuildTestResult): Promise<string | null> {
    const baseReports = process.env.REPORTS_DIR || 'reports';
    const basePath = path.isAbsolute(baseReports)
      ? baseReports
      : path.resolve(process.cwd(), '..', baseReports);
    const reportPath = path.join(basePath, 'build');
    
    try {
      await fs.mkdir(reportPath, { recursive: true });
      
      const timestamp = result.timestamp.toISOString().replace(/[:.]/g, '-');
      const reportFile = path.join(reportPath, `build-report-${timestamp}.json`);
      
      await fs.writeFile(reportFile, JSON.stringify(result, null, 2));
      
      logger.info('📊 Build report generated', { reportFile });
      return reportFile;
    } catch (error) {
      logger.error('Failed to generate build report:', error);
      return null;
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
