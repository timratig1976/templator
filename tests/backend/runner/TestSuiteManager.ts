/**
 * Test Suite Manager
 * Advanced test execution, monitoring, and reporting system
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { createLogger } from '../../shared/logger';
import { EventEmitter } from 'events';

const logger = createLogger();

// Local TestConfig definition and loader replacing removed '../../config/test-config'
export interface TestConfig {
  testTimeout: number;
  maxConcurrentTests: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | string;
  reportOutputDir: string;
  categories: Record<string, boolean>;
}

function loadTestConfig(): TestConfig {
  // Determine a root-level reports directory, defaulting to <repo>/reports
  // __dirname = backend/src/services/testing -> go up 3 levels to repo root
  const rootReportsBase = process.env.REPORTS_DIR
    ? (path.isAbsolute(process.env.REPORTS_DIR) ? process.env.REPORTS_DIR : path.resolve(__dirname, '../../..', process.env.REPORTS_DIR))
    : path.resolve(__dirname, '../../..', 'reports');

  // Place backend test artifacts under reports/backend/testing
  const reportOutputDir = path.resolve(rootReportsBase, 'backend', 'testing');

  return {
    testTimeout: 30000,
    maxConcurrentTests: 5,
    logLevel: process.env.TEST_LOG_LEVEL || 'info',
    reportOutputDir,
    categories: {
      unit: true,
      integration: true,
      e2e: true,
      performance: false,
      validation: false,
      api: false
    }
  };
}

export interface TestExecutionResult {
  id: string;
  name: string;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  output: string[];
  errors: string[];
  coverage?: CoverageReport;
  performance?: PerformanceMetrics;
}

export interface CoverageReport {
  lines: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  statements: { total: number; covered: number; percentage: number };
}

export interface PerformanceMetrics {
  memoryUsage: { heapUsed: number; heapTotal: number; external: number };
  executionTime: number;
  cpuUsage: number;
  responseTime?: number;
}

export interface TestSuiteResult {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  coverage: CoverageReport | null;
  performance: PerformanceMetrics | null;
  tests: TestExecutionResult[];
  summary: string;
}

export class TestSuiteManager extends EventEmitter {
  private config: TestConfig;
  private runningTests: Map<string, ChildProcess> = new Map();
  private testResults: Map<string, TestSuiteResult> = new Map();
  private currentExecution: string | null = null;

  constructor(customConfig?: Partial<TestConfig>) {
    super();
    this.config = loadTestConfig();
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  // Execute comprehensive test suite
  async executeTestSuite(categories?: string[]): Promise<TestSuiteResult> {
    const executionId = this.generateExecutionId();
    this.currentExecution = executionId;

    const suiteResult: TestSuiteResult = {
      id: executionId,
      name: 'Comprehensive Test Suite',
      status: 'running',
      startTime: new Date(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      coverage: null,
      performance: null,
      tests: [],
      summary: ''
    };

    this.testResults.set(executionId, suiteResult);
    this.emit('suite-started', suiteResult);

    try {
      // Determine which test categories to run
      const categoriesToRun = categories || this.getEnabledCategories();
      
      logger.info('Starting test suite execution', {
        executionId,
        categories: categoriesToRun,
        config: this.config
      });

      // Execute tests by category
      for (const category of categoriesToRun) {
        await this.executeTestCategory(executionId, category);
      }

      // Generate final coverage report
      suiteResult.coverage = await this.generateCoverageReport(executionId);
      
      // Calculate performance metrics
      suiteResult.performance = await this.calculatePerformanceMetrics(executionId);

      // Finalize results
      suiteResult.status = suiteResult.failedTests > 0 ? 'failed' : 'completed';
      suiteResult.endTime = new Date();
      suiteResult.summary = this.generateSummary(suiteResult);

      this.emit('suite-completed', suiteResult);
      logger.info('Test suite execution completed', {
        executionId,
        status: suiteResult.status,
        totalTests: suiteResult.totalTests,
        passedTests: suiteResult.passedTests,
        failedTests: suiteResult.failedTests
      });

      return suiteResult;

    } catch (error) {
      suiteResult.status = 'failed';
      suiteResult.endTime = new Date();
      suiteResult.summary = `Test suite failed: ${(error as Error).message}`;
      
      this.emit('suite-failed', suiteResult, error);
      logger.error('Test suite execution failed', { executionId, error });
      
      throw error;
    } finally {
      this.currentExecution = null;
    }
  }

  // Execute tests for a specific category
  private async executeTestCategory(executionId: string, category: string): Promise<void> {
    const testPattern = this.getTestPattern(category);
    const testName = `${category}-tests`;

    logger.info(`Executing ${category} tests`, { executionId, pattern: testPattern });

    const testResult: TestExecutionResult = {
      id: `${executionId}-${category}`,
      name: testName,
      status: 'running',
      startTime: new Date(),
      output: [],
      errors: []
    };

    const suiteResult = this.testResults.get(executionId)!;
    suiteResult.tests.push(testResult);

    this.emit('test-started', testResult);

    try {
      const jestProcess = await this.spawnJestProcess(testPattern, {
        category,
        executionId
      });

      const result = await this.monitorTestExecution(jestProcess, testResult);
      
      // Update suite totals
      suiteResult.totalTests += result.totalTests || 0;
      suiteResult.passedTests += result.passedTests || 0;
      suiteResult.failedTests += result.failedTests || 0;
      suiteResult.skippedTests += result.skippedTests || 0;

      testResult.status = result.success ? 'passed' : 'failed';
      testResult.endTime = new Date();
      testResult.duration = testResult.endTime.getTime() - testResult.startTime.getTime();

      this.emit('test-completed', testResult);

    } catch (error) {
      testResult.status = 'failed';
      testResult.endTime = new Date();
      testResult.duration = testResult.endTime.getTime() - testResult.startTime.getTime();
      testResult.errors.push((error as Error).message);

      this.emit('test-failed', testResult, error);
      logger.error(`${category} tests failed`, { executionId, error });
    }
  }

  // Spawn Jest process with specific configuration
  private async spawnJestProcess(testPattern: string, context: any): Promise<ChildProcess> {
    const jestConfig = this.generateJestConfig(context);
    const configPath = await this.writeTemporaryJestConfig(jestConfig);

    const args = [
      'jest',
      testPattern,
      '--config', configPath,
      '--json',
      '--verbose',
      '--coverage',
      '--forceExit'
    ];

    const process = spawn('npx', args, {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.runningTests.set(context.executionId, process);

    return process;
  }

  // Monitor test execution and collect results
  private async monitorTestExecution(process: ChildProcess, testResult: TestExecutionResult): Promise<any> {
    return new Promise((resolve, reject) => {
      let outputBuffer = '';
      let errorBuffer = '';

      process.stdout?.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        testResult.output.push(output);
        this.emit('test-output', testResult, output);
      });

      process.stderr?.on('data', (data) => {
        const error = data.toString();
        errorBuffer += error;
        testResult.errors.push(error);
        this.emit('test-error', testResult, error);
      });

      process.on('close', (code) => {
        try {
          // Parse Jest JSON output
          const jsonMatch = outputBuffer.match(/\{[\s\S]*\}$/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            resolve(result);
          } else {
            resolve({ success: code === 0, totalTests: 0, passedTests: 0, failedTests: 0 });
          }
        } catch (error) {
          reject(new Error(`Failed to parse test results: ${error}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Generate Jest configuration for specific test execution
  private generateJestConfig(context: any): any {
    return {
      testTimeout: this.config.testTimeout,
      maxConcurrency: this.config.maxConcurrentTests,
      verbose: this.config.logLevel === 'debug',
      collectCoverage: true,
      coverageDirectory: path.join(this.config.reportOutputDir, `coverage-${context.category}`),
      coverageReporters: ['json', 'html', 'text'],
      setupFilesAfterEnv: [
        '<rootDir>/tests/jest/unit/setup.ts',
        '<rootDir>/tests/tests/unit/setup.ts'
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1'
      },
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      transform: {
        '^.+\\.ts$': 'ts-jest'
      }
    };
  }

  // Write temporary Jest configuration file
  private async writeTemporaryJestConfig(config: any): Promise<string> {
    const configPath = path.join(__dirname, `../../jest.config.temp.${Date.now()}.json`);
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  // Generate coverage report
  private async generateCoverageReport(executionId: string): Promise<CoverageReport | null> {
    try {
      // Prefer a common coverage summary if present
      const commonCoverageDir = path.join(this.config.reportOutputDir, 'coverage');
      const commonCoverageFile = path.join(commonCoverageDir, 'coverage-summary.json');

      const readSummary = async (filePath: string) => {
        const coverageData = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
        const total = coverageData.total;
        return {
          lines: { total: total.lines.total, covered: total.lines.covered, percentage: total.lines.pct },
          functions: { total: total.functions.total, covered: total.functions.covered, percentage: total.functions.pct },
          branches: { total: total.branches.total, covered: total.branches.covered, percentage: total.branches.pct },
          statements: { total: total.statements.total, covered: total.statements.covered, percentage: total.statements.pct }
        } as CoverageReport;
      };

      if (fs.existsSync(commonCoverageFile)) {
        return await readSummary(commonCoverageFile);
      }

      // Fallback: find the most recent coverage-* folder and read its summary
      const entries = await fs.promises.readdir(this.config.reportOutputDir, { withFileTypes: true });
      const coverageDirs = entries
        .filter(e => e.isDirectory() && e.name.startsWith('coverage-'))
        .map(e => path.join(this.config.reportOutputDir, e.name));

      if (coverageDirs.length > 0) {
        // Sort by mtime desc
        const sorted = await Promise.all(
          coverageDirs.map(async d => ({ dir: d, time: (await fs.promises.stat(d)).mtimeMs }))
        );
        sorted.sort((a, b) => b.time - a.time);
        const latest = sorted[0].dir;
        const latestSummary = path.join(latest, 'coverage-summary.json');
        if (fs.existsSync(latestSummary)) {
          return await readSummary(latestSummary);
        }
      }
    } catch (error) {
      logger.warn('Failed to generate coverage report', { executionId, error });
    }

    return null;
  }

  // Calculate performance metrics
  private async calculatePerformanceMetrics(executionId: string): Promise<PerformanceMetrics | null> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      return {
        memoryUsage: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external
        },
        executionTime: Date.now(),
        cpuUsage: cpuUsage.user + cpuUsage.system
      };
    } catch (error) {
      logger.warn('Failed to calculate performance metrics', { executionId, error });
      return null;
    }
  }

  // Generate test summary
  private generateSummary(result: TestSuiteResult): string {
    const successRate = result.totalTests > 0 ? 
      (result.passedTests / result.totalTests * 100).toFixed(1) : '0';

    const duration = result.endTime && result.startTime ? 
      ((result.endTime.getTime() - result.startTime.getTime()) / 1000).toFixed(1) : '0';

    let summary = `Test Suite Execution Summary:\n`;
    summary += `• Total Tests: ${result.totalTests}\n`;
    summary += `• Passed: ${result.passedTests}\n`;
    summary += `• Failed: ${result.failedTests}\n`;
    summary += `• Skipped: ${result.skippedTests}\n`;
    summary += `• Success Rate: ${successRate}%\n`;
    summary += `• Duration: ${duration}s\n`;

    if (result.coverage) {
      summary += `• Line Coverage: ${result.coverage.lines.percentage}%\n`;
      summary += `• Function Coverage: ${result.coverage.functions.percentage}%\n`;
    }

    if (result.performance) {
      const memMB = (result.performance.memoryUsage.heapUsed / 1024 / 1024).toFixed(1);
      summary += `• Memory Usage: ${memMB}MB\n`;
    }

    return summary;
  }

  // Utility methods
  private generateExecutionId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getEnabledCategories(): string[] {
    return Object.entries(this.config.categories)
      .filter(([_, enabled]) => enabled)
      .map(([category, _]) => category);
  }

  private getTestPattern(category: string): string {
    const patterns = {
      unit: '**/*.unit.test.ts',
      integration: '**/*.integration.test.ts',
      e2e: '**/*e2e*.test.ts',
      performance: '**/*.performance.test.ts',
      validation: '**/*.validation.test.ts',
      api: '**/*.api.test.ts'
    };

    return patterns[category as keyof typeof patterns] || '**/*.test.ts';
  }

  // Public methods for external access
  getCurrentExecution(): string | null {
    return this.currentExecution;
  }

  getTestResult(executionId: string): TestSuiteResult | undefined {
    return this.testResults.get(executionId);
  }

  getAllTestResults(): TestSuiteResult[] {
    return Array.from(this.testResults.values());
  }

  stopExecution(executionId: string): boolean {
    const process = this.runningTests.get(executionId);
    if (process) {
      process.kill('SIGTERM');
      this.runningTests.delete(executionId);
      return true;
    }
    return false;
  }

  // Cleanup
  cleanup(): void {
    // Stop all running tests
    for (const [executionId, process] of this.runningTests) {
      process.kill('SIGTERM');
    }
    this.runningTests.clear();

    // Clean up temporary files
    const tempFiles = fs.readdirSync(path.join(__dirname, '../..'))
      .filter(file => file.startsWith('jest.config.temp.'));
    
    for (const file of tempFiles) {
      try {
        fs.unlinkSync(path.join(__dirname, '../..', file));
      } catch (error) {
        logger.warn('Failed to cleanup temp file', { file, error });
      }
    }
  }
}

export default TestSuiteManager;
