#!/usr/bin/env ts-node

/**
 * Visual Test Runner
 * Interactive test runner with real-time visual feedback and logging
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { createLogger } from './utils/logger';
import express from 'express';
import { createServer } from 'http';
import TestSuiteManager, { TestSuiteResult, TestExecutionResult } from './services/TestSuiteManager';
import { loadTestConfig } from './config/test-config';

const logger = createLogger();

interface TestRunnerConfig {
  testFile?: string;
  watch?: boolean;
  verbose?: boolean;
  generateReport?: boolean;
  openBrowser?: boolean;
  port?: number;
}

class VisualTestRunner {
  private config: TestRunnerConfig;
  private app: express.Application;
  private server: any;
  private testResults: any = null;
  private isRunning = false;
  private testSuiteManager: TestSuiteManager;
  private currentExecution: TestSuiteResult | null = null;

  constructor(config: TestRunnerConfig = {}) {
    this.config = {
      testFile: 'comprehensive-e2e.test.ts',
      watch: false,
      verbose: true,
      generateReport: true,
      openBrowser: true,
      port: 3001,
      ...config
    };

    this.app = express();
    this.testSuiteManager = new TestSuiteManager();
    this.setupTestSuiteEvents();
    this.setupServer();
  }

  private setupTestSuiteEvents() {
    // Listen to test suite manager events for real-time updates
    this.testSuiteManager.on('suite-started', (result: TestSuiteResult) => {
      logger.info('Test suite started', { executionId: result.id, name: result.name });
      this.currentExecution = result;
      this.isRunning = true;
    });

    this.testSuiteManager.on('suite-completed', (result: TestSuiteResult) => {
      logger.info('Test suite completed', { 
        executionId: result.id, 
        status: result.status,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests
      });
      this.currentExecution = result;
      this.testResults = result;
      this.isRunning = false;
    });

    this.testSuiteManager.on('suite-failed', (result: TestSuiteResult, error: Error) => {
      logger.error('Test suite failed', { executionId: result.id, error: error.message });
      this.currentExecution = result;
      this.testResults = result;
      this.isRunning = false;
    });

    this.testSuiteManager.on('test-started', (test: TestExecutionResult) => {
      logger.info('Test started', { testId: test.id, name: test.name });
    });

    this.testSuiteManager.on('test-completed', (test: TestExecutionResult) => {
      logger.info('Test completed', { testId: test.id, status: test.status, duration: test.duration });
    });

    this.testSuiteManager.on('test-output', (test: TestExecutionResult, output: string) => {
      if (this.config.verbose) {
        console.log(`[${test.name}] ${output}`);
      }
    });

    this.testSuiteManager.on('test-error', (test: TestExecutionResult, error: string) => {
      logger.warn(`Test error in ${test.name}:`, error);
    });
  }

  private setupServer() {
    this.server = createServer(this.app);

    // Serve static files
    this.app.use(express.static(path.join(__dirname, '../public')));
    this.app.use(express.json());

    // API endpoints
    this.app.get('/api/test-status', (req, res) => {
      const response = {
        isRunning: this.isRunning,
        results: this.testResults,
        timestamp: new Date().toISOString(),
        summary: this.testResults ? {
          success: this.testResults.success || false,
          numTotalTests: this.testResults.numTotalTests || 0,
          numPassedTests: this.testResults.numPassedTests || 0,
          numFailedTests: this.testResults.numFailedTests || 0,
          numTotalTestSuites: this.testResults.numTotalTestSuites || 0,
          testSuites: this.testResults.testResults?.length || 0
        } : null
      };
      
      logger.info('API /test-status called', { 
        isRunning: this.isRunning, 
        hasResults: !!this.testResults,
        summary: response.summary
      });
      
      res.json(response);
    });

    this.app.post('/api/run-tests', async (req, res) => {
      if (this.isRunning) {
        return res.status(409).json({ error: 'Tests are already running' });
      }

      try {
        const { categories } = req.body;
        logger.info('Starting advanced test suite execution', { categories });
        
        // Start test execution asynchronously
        this.runAdvancedTests(categories).catch((error: Error) => {
          logger.error('Advanced test execution failed', { error: error.message });
        });
        
        res.json({ 
          message: 'Advanced test suite started', 
          timestamp: new Date().toISOString(),
          categories: categories || 'all'
        });
      } catch (error) {
        logger.error('Failed to start tests', { error });
        res.status(500).json({ error: 'Failed to start tests' });
      }
    });

    this.app.get('/api/test-results/:timestamp', (req, res) => {
      const { timestamp } = req.params;
      const reportPath = path.join(__dirname, `../../test-results-${timestamp}.html`);
      
      if (fs.existsSync(reportPath)) {
        res.sendFile(reportPath);
      } else {
        res.status(404).json({ error: 'Report not found' });
      }
    });

    // Main dashboard route
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });

    // Note: Real-time updates removed for simplicity
  }

  async start() {
    return new Promise<void>((resolve) => {
      this.server.listen(this.config.port, () => {
        logger.info(`Test Dashboard running on http://localhost:${this.config.port}`);
        console.log(`\n🎯 Test Dashboard: http://localhost:${this.config.port}`);
        console.log('📊 Real-time test monitoring and results');
        
        if (this.config.openBrowser) {
          this.openBrowser();
        }
        
        resolve();
      });
    });
  }

  private openBrowser() {
    const url = `http://localhost:${this.config.port}`;
    const start = process.platform === 'darwin' ? 'open' : 
                  process.platform === 'win32' ? 'start' : 'xdg-open';
    
    spawn(start, [url], { detached: true, stdio: 'ignore' });
  }

  // Advanced test execution using TestSuiteManager
  private async runAdvancedTests(categories?: string[]): Promise<void> {
    try {
      logger.info('Starting advanced test suite execution', { categories });
      const result = await this.testSuiteManager.executeTestSuite(categories);
      
      // Generate HTML report from the advanced results
      if (this.config.generateReport) {
        await this.generateAdvancedHTMLReport(result);
      }
      
      logger.info('Advanced test suite completed', {
        executionId: result.id,
        status: result.status,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
        duration: result.endTime && result.startTime ? 
          (result.endTime.getTime() - result.startTime.getTime()) / 1000 : 0
      });
    } catch (error) {
      logger.error('Advanced test execution failed', { error: (error as Error).message });
      throw error;
    }
  }

  // Legacy test execution method (kept for backward compatibility)
  private async runTests() {
    if (this.isRunning) {
      logger.warn('Tests are already running');
      return;
    }

    this.isRunning = true;
    this.testResults = null;
    
    logger.info('Starting comprehensive test suite');

    // Check if test file exists
    const testPath = path.join(__dirname, '__tests__', this.config.testFile!);
    if (!fs.existsSync(testPath)) {
      logger.error(`Test file not found: ${testPath}`);
      this.isRunning = false;
      return;
    }

    const resultsPath = path.join(__dirname, '../test-results.json');
    
    const jestProcess = spawn('npx', [
      'jest',
      testPath,
      '--verbose',
      '--json',
      `--outputFile=${resultsPath}`,
      '--forceExit'
    ], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let outputBuffer = '';
    let errorBuffer = '';

    jestProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      
      if (this.config.verbose) {
        console.log(output);
      }

      // Parse and log test progress
      this.parseTestOutput(output);
    });

    jestProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      errorBuffer += error;
      
      if (this.config.verbose) {
        console.error(error);
      }

      logger.error('Test stderr:', error);
    });

    jestProcess.on('close', (code) => {
      this.isRunning = false;
      
      logger.info(`Test suite completed with exit code: ${code}`);
      
      // Load results from JSON file
      setTimeout(() => {
        this.loadTestResults();
        logger.info('Test completed', { 
          exitCode: code, 
          resultsCount: this.testResults.length,
          outputLength: outputBuffer.length,
          errorLength: errorBuffer.length
        });

        if (this.config.generateReport) {
          this.generateHTMLReport();
        }
      }, 1000); // Wait a bit for file to be written
    });

    jestProcess.on('error', (error) => {
      this.isRunning = false;
      logger.error('Failed to start Jest process:', error);
    });
  }

  private parseTestOutput(output: string) {
    // Parse Jest output for logging
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('PASS') || line.includes('FAIL')) {
        logger.info(`Test ${line.includes('PASS') ? 'passed' : 'failed'}: ${line.trim()}`);
      }
      
      if (line.includes('✓') || line.includes('✗')) {
        logger.info(`Test case ${line.includes('✓') ? 'passed' : 'failed'}: ${line.trim()}`);
      }
    }
  }

  private loadTestResults() {
    const resultsPath = path.join(__dirname, '../test-results.json');
    
    try {
      if (fs.existsSync(resultsPath)) {
        const rawData = fs.readFileSync(resultsPath, 'utf8');
        const results = JSON.parse(rawData);
        
        // Store the full Jest results
        this.testResults = results;
        
        // Log detailed results
        logger.info('Test Results Summary:', {
          success: results.success,
          numTotalTestSuites: results.numTotalTestSuites,
          numPassedTestSuites: results.numPassedTestSuites,
          numFailedTestSuites: results.numFailedTestSuites,
          numTotalTests: results.numTotalTests,
          numPassedTests: results.numPassedTests,
          numFailedTests: results.numFailedTests,
          testResults: results.testResults?.length || 0
        });
        
        // Log individual test results for debugging
        if (results.testResults) {
          results.testResults.forEach((testResult: any, index: number) => {
            logger.info(`Test Suite ${index + 1}:`, {
              name: testResult.name,
              status: testResult.status,
              numPassingTests: testResult.numPassingTests,
              numFailingTests: testResult.numFailingTests,
              numTotalTests: testResult.numTotalTests
            });
          });
        }
      } else {
        logger.warn(`Test results file not found: ${resultsPath}`);
      }
    } catch (error) {
      logger.error('Failed to load test results', { error: (error as Error).message, resultsPath });
    }
  }

  // Generate advanced HTML report with comprehensive results
  private async generateAdvancedHTMLReport(result: TestSuiteResult): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(__dirname, `../../advanced-test-results-${timestamp}.html`);
    
    try {
      const htmlContent = this.generateAdvancedReportHTML(result);
      await fs.promises.writeFile(reportPath, htmlContent, 'utf8');
      
      logger.info('Advanced HTML report generated', { 
        reportPath, 
        timestamp, 
        executionId: result.id,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests
      });
    } catch (error) {
      logger.error('Failed to generate advanced HTML report', { error: (error as Error).message });
    }
  }

  // Legacy HTML report generation
  private generateHTMLReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(__dirname, `../../test-results-${timestamp}.html`);
    
    // The HTML report is generated by the test suite itself
    // Here we just log the location
    logger.info(`HTML report will be available at: ${reportPath}`);
    
    logger.info('Report generated', { reportPath, timestamp });
  }

  // Generate HTML content for advanced test report
  private generateAdvancedReportHTML(result: TestSuiteResult): string {
    const successRate = result.totalTests > 0 ? 
      ((result.passedTests / result.totalTests) * 100).toFixed(1) : '0';
    
    const duration = result.endTime && result.startTime ? 
      ((result.endTime.getTime() - result.startTime.getTime()) / 1000).toFixed(1) : '0';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Advanced Test Report - ${result.name}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .stat-card.passed { border-left-color: #28a745; }
        .stat-card.failed { border-left-color: #dc3545; }
        .stat-card.coverage { border-left-color: #17a2b8; }
        .stat-number { font-size: 2.5em; font-weight: bold; margin-bottom: 10px; }
        .stat-label { color: #6c757d; font-size: 0.9em; }
        .tests-section { padding: 0 30px 30px; }
        .test-category { margin-bottom: 30px; }
        .test-category h3 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .test-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #eee; border-radius: 4px; margin-bottom: 8px; }
        .test-name { font-weight: 500; }
        .test-status { padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .status-running { background: #fff3cd; color: #856404; }
        .coverage-section { padding: 30px; background: #f8f9fa; }
        .coverage-bar { background: #e9ecef; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .coverage-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.5s ease; }
        .footer { padding: 20px 30px; background: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Advanced Test Report</h1>
            <p>Execution ID: ${result.id} | Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="stat-card">
                <div class="stat-number">${result.totalTests}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card passed">
                <div class="stat-number">${result.passedTests}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card failed">
                <div class="stat-number">${result.failedTests}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${successRate}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${duration}s</div>
                <div class="stat-label">Duration</div>
            </div>
            ${result.coverage ? `
            <div class="stat-card coverage">
                <div class="stat-number">${result.coverage.lines.percentage.toFixed(1)}%</div>
                <div class="stat-label">Line Coverage</div>
            </div>
            ` : ''}
        </div>
        
        <div class="tests-section">
            <h2>Test Results by Category</h2>
            ${result.tests.map(test => `
                <div class="test-category">
                    <h3>${test.name}</h3>
                    <div class="test-item">
                        <span class="test-name">${test.name}</span>
                        <span class="test-status status-${test.status}">${test.status.toUpperCase()}</span>
                    </div>
                    ${test.duration ? `<p><small>Duration: ${test.duration}ms</small></p>` : ''}
                </div>
            `).join('')}
        </div>
        
        ${result.coverage ? `
        <div class="coverage-section">
            <h2>Code Coverage</h2>
            <div>
                <strong>Lines:</strong> ${result.coverage.lines.covered}/${result.coverage.lines.total} (${result.coverage.lines.percentage.toFixed(1)}%)
                <div class="coverage-bar">
                    <div class="coverage-fill" style="width: ${result.coverage.lines.percentage}%"></div>
                </div>
            </div>
            <div>
                <strong>Functions:</strong> ${result.coverage.functions.covered}/${result.coverage.functions.total} (${result.coverage.functions.percentage.toFixed(1)}%)
                <div class="coverage-bar">
                    <div class="coverage-fill" style="width: ${result.coverage.functions.percentage}%"></div>
                </div>
            </div>
        </div>
        ` : ''}
        
        <div class="footer">
            <p>Generated by Templator Advanced Test Suite Manager</p>
            <p>Status: <strong>${result.status.toUpperCase()}</strong> | ${result.summary}</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Templator Test Dashboard</title>

    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1400px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); 
            color: white; 
            padding: 30px; 
            text-align: center;
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 1.1em; }
        .controls { 
            padding: 30px; 
            background: #f8f9fa; 
            border-bottom: 1px solid #dee2e6;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
        }
        .btn { 
            padding: 12px 24px; 
            border: none; 
            border-radius: 6px; 
            font-size: 1em; 
            cursor: pointer; 
            transition: all 0.3s ease;
            font-weight: 600;
        }
        .btn-primary { 
            background: linear-gradient(135deg, #007bff, #0056b3); 
            color: white; 
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,123,255,0.3); }
        .btn-secondary { background: #6c757d; color: white; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .status { 
            display: flex; 
            align-items: center; 
            gap: 10px;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: 600;
        }
        .status.running { background: #fff3cd; color: #856404; }
        .status.idle { background: #d4edda; color: #155724; }
        .status.error { background: #f8d7da; color: #721c24; }
        .main-content { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 0;
            min-height: 600px;
        }
        .live-log { 
            padding: 30px; 
            background: #f8f9fa;
            border-right: 1px solid #dee2e6;
        }
        .results-panel { 
            padding: 30px; 
            background: white;
        }
        .panel-title { 
            font-size: 1.3em; 
            font-weight: 600; 
            margin-bottom: 20px; 
            color: #2c3e50;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .log-container { 
            background: #2c3e50; 
            color: #ecf0f1; 
            padding: 20px; 
            border-radius: 8px; 
            height: 400px; 
            overflow-y: auto; 
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            line-height: 1.4;
        }
        .log-entry { 
            margin-bottom: 8px; 
            padding: 4px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .log-entry:last-child { border-bottom: none; }
        .log-timestamp { color: #95a5a6; font-size: 0.8em; }
        .log-pass { color: #2ecc71; }
        .log-fail { color: #e74c3c; }
        .log-info { color: #3498db; }
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); 
            gap: 15px; 
            margin-bottom: 30px;
        }
        .stat-card { 
            background: linear-gradient(135deg, #f8f9fa, #e9ecef); 
            padding: 20px; 
            border-radius: 8px; 
            text-align: center;
            border-left: 4px solid #007bff;
        }
        .stat-card.passed { border-left-color: #28a745; }
        .stat-card.failed { border-left-color: #dc3545; }
        .stat-card.total { border-left-color: #6f42c1; }
        .stat-number { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .stat-label { color: #6c757d; font-size: 0.9em; }
        .progress-bar { 
            width: 100%; 
            height: 12px; 
            background: #e9ecef; 
            border-radius: 6px; 
            overflow: hidden; 
            margin: 20px 0;
        }
        .progress-fill { 
            height: 100%; 
            background: linear-gradient(90deg, #28a745, #20c997); 
            transition: width 0.5s ease;
            border-radius: 6px;
        }
        .test-list { 
            max-height: 300px; 
            overflow-y: auto; 
            border: 1px solid #dee2e6; 
            border-radius: 8px;
        }
        .test-item { 
            padding: 12px 16px; 
            border-bottom: 1px solid #f1f3f4; 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
        }
        .test-item:last-child { border-bottom: none; }
        .test-name { font-weight: 500; }
        .test-status { 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 0.8em; 
            font-weight: bold;
        }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .status-running { background: #fff3cd; color: #856404; }
        .spinner { 
            display: inline-block; 
            width: 20px; 
            height: 20px; 
            border: 3px solid #f3f3f3; 
            border-top: 3px solid #007bff; 
            border-radius: 50%; 
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .hidden { display: none; }
        @media (max-width: 768px) {
            .main-content { grid-template-columns: 1fr; }
            .controls { flex-direction: column; align-items: stretch; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Templator Test Dashboard</h1>
            <p>Real-time monitoring of comprehensive end-to-end tests</p>
        </div>
        
        <div class="controls">
            <div class="status idle" id="status">
                <span id="status-text">Ready to run tests</span>
                <span class="spinner hidden" id="spinner"></span>
            </div>
            <div>
                <button class="btn btn-primary" id="run-tests" onclick="runTests()">
                    🚀 Run Tests
                </button>
                <button class="btn btn-secondary" id="view-report" onclick="viewReport()" disabled>
                    📊 View Report
                </button>
            </div>
        </div>
        
        <div class="main-content">
            <div class="live-log">
                <div class="panel-title">
                    📡 Live Test Log
                </div>
                <div class="log-container" id="log-container">
                    <div class="log-entry">
                        <span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span>
                        <span class="log-info">Dashboard ready. Click "Run Tests" to start.</span>
                    </div>
                </div>
            </div>
            
            <div class="results-panel">
                <div class="panel-title">
                    📈 Test Results
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card total">
                        <div class="stat-number" id="total-tests">0</div>
                        <div class="stat-label">Total Tests</div>
                    </div>
                    <div class="stat-card passed">
                        <div class="stat-number" id="passed-tests">0</div>
                        <div class="stat-label">Passed</div>
                    </div>
                    <div class="stat-card failed">
                        <div class="stat-number" id="failed-tests">0</div>
                        <div class="stat-label">Failed</div>
                    </div>
                </div>
                
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                </div>
                
                <div class="test-list" id="test-list">
                    <div class="test-item">
                        <span class="test-name">No tests run yet</span>
                        <span class="test-status">-</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentReportUrl = null;
        
        // DOM elements
        const statusEl = document.getElementById('status');
        const statusTextEl = document.getElementById('status-text');
        const spinnerEl = document.getElementById('spinner');
        const runTestsBtn = document.getElementById('run-tests');
        const viewReportBtn = document.getElementById('view-report');
        const logContainer = document.getElementById('log-container');
        const totalTestsEl = document.getElementById('total-tests');
        const passedTestsEl = document.getElementById('passed-tests');
        const failedTestsEl = document.getElementById('failed-tests');
        const progressFillEl = document.getElementById('progress-fill');
        const testListEl = document.getElementById('test-list');
        
        // Functions
        function runTests() {
            updateStatus('running', 'Running tests...');
            addLogEntry('info', 'Starting test suite...');
            clearResults();
            
            fetch('/api/run-tests', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    addLogEntry('info', data.message);
                    pollTestStatus();
                })
                .catch(error => {
                    addLogEntry('fail', 'Failed to start tests: ' + error.message);
                    updateStatus('error', 'Failed to start tests');
                });
        }
        
        function viewReport() {
            if (currentReportUrl) {
                window.open(currentReportUrl, '_blank');
            }
        }
        
        function updateStatus(type, text) {
            statusEl.className = \`status \${type}\`;
            statusTextEl.textContent = text;
            
            if (type === 'running') {
                spinnerEl.classList.remove('hidden');
                runTestsBtn.disabled = true;
            } else {
                spinnerEl.classList.add('hidden');
                runTestsBtn.disabled = false;
            }
        }
        
        function addLogEntry(type, message) {
            const timestamp = new Date().toLocaleTimeString();
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.innerHTML = \`
                <span class="log-timestamp">[\${timestamp}]</span>
                <span class="log-\${type}">\${message}</span>
            \`;
            
            logContainer.appendChild(entry);
            logContainer.scrollTop = logContainer.scrollHeight;
            
            // Keep only last 100 entries
            while (logContainer.children.length > 100) {
                logContainer.removeChild(logContainer.firstChild);
            }
        }
        
        function clearResults() {
            totalTestsEl.textContent = '0';
            passedTestsEl.textContent = '0';
            failedTestsEl.textContent = '0';
            progressFillEl.style.width = '0%';
            testListEl.innerHTML = '<div class="test-item"><span class="test-name">Running tests...</span><span class="test-status status-running">RUNNING</span></div>';
        }
        
        function updateTestCase(data) {
            // This would be more complex in a real implementation
            // For now, just update the log
        }
        
        function updateResults(data) {
            console.log('Updating results with data:', data);
            
            if (!data) {
                addLogEntry('info', 'No test data available');
                return;
            }
            
            // Use summary data if available
            if (data.summary) {
                const summary = data.summary;
                totalTestsEl.textContent = summary.numTotalTests || 0;
                passedTestsEl.textContent = summary.numPassedTests || 0;
                failedTestsEl.textContent = summary.numFailedTests || 0;
                
                const successRate = summary.numTotalTests > 0 ? 
                    (summary.numPassedTests / summary.numTotalTests) * 100 : 0;
                progressFillEl.style.width = \`\${successRate}%\`;
                
                addLogEntry('info', \`Tests completed: \${summary.numPassedTests}/\${summary.numTotalTests} passed\`);
                
                if (summary.success) {
                    addLogEntry('pass', 'All tests passed successfully!');
                } else {
                    addLogEntry('fail', \`\${summary.numFailedTests} tests failed\`);
                }
            }
            
            // Update test list with detailed results
            if (data.results && data.results.testResults) {
                testListEl.innerHTML = '';
                
                data.results.testResults.forEach((testSuite, suiteIndex) => {
                    // Add test suite header
                    const suiteHeader = document.createElement('div');
                    suiteHeader.className = 'test-item';
                    suiteHeader.innerHTML = \`
                        <span class="test-name"><strong>Suite: \${testSuite.name || 'Test Suite ' + (suiteIndex + 1)}</strong></span>
                        <span class="test-status status-\${testSuite.status === 'passed' ? 'passed' : 'failed'}">\${testSuite.status?.toUpperCase() || 'UNKNOWN'}</span>
                    \`;
                    testListEl.appendChild(suiteHeader);
                    
                    // Add individual test cases if available
                    if (testSuite.assertionResults) {
                        testSuite.assertionResults.forEach(test => {
                            const item = document.createElement('div');
                            item.className = 'test-item';
                            item.style.paddingLeft = '30px'; // Indent test cases
                            item.innerHTML = \`
                                <span class="test-name">\${test.title || test.fullName || 'Unknown Test'}</span>
                                <span class="test-status status-\${test.status === 'passed' ? 'passed' : 'failed'}">\${test.status?.toUpperCase() || 'UNKNOWN'}</span>
                            \`;
                            testListEl.appendChild(item);
                        });
                    }
                });
                
                addLogEntry('info', \`Loaded \${data.results.testResults.length} test suites\`);
            } else {
                // Fallback display
                testListEl.innerHTML = '<div class="test-item"><span class="test-name">Test results not available in detail</span><span class="test-status">-</span></div>';
            }
        }
        
        function pollTestStatus() {
            const poll = () => {
                fetch('/api/test-status')
                    .then(response => response.json())
                    .then(data => {
                        console.log('Poll response:', data);
                        
                        if (!data.isRunning) {
                            updateStatus('idle', 'Tests completed');
                            updateResults(data); // Pass the full data object
                            addLogEntry('info', 'Test suite completed');
                            
                            // Enable report button if we have results
                            if (data.results) {
                                viewReportBtn.disabled = false;
                            }
                            return;
                        }
                        
                        // Continue polling if tests are still running
                        addLogEntry('info', 'Tests still running...');
                        setTimeout(poll, 2000); // Poll every 2 seconds
                    })
                    .catch(error => {
                        console.error('Polling error:', error);
                        addLogEntry('fail', 'Error polling status: ' + error.message);
                        updateStatus('error', 'Error polling status');
                    });
            };
            poll();
        }
        
        // Initialize
        addLogEntry('info', 'Dashboard ready');
        
        // Load initial status
        fetch('/api/test-status')
            .then(response => response.json())
            .then(data => {
                console.log('Initial status:', data);
                if (data.results) {
                    updateResults(data); // Pass the full data object
                    if (data.results) {
                        viewReportBtn.disabled = false;
                    }
                }
                if (data.isRunning) {
                    updateStatus('running', 'Tests are currently running...');
                    pollTestStatus();
                }
            })
            .catch(error => {
                console.error('Initial status error:', error);
                addLogEntry('fail', 'Failed to load initial status: ' + error.message);
            });
    </script>
</body>
</html>`;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config: TestRunnerConfig = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--test-file':
        config.testFile = args[++i];
        break;
      case '--watch':
        config.watch = true;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--no-report':
        config.generateReport = false;
        break;
      case '--no-browser':
        config.openBrowser = false;
        break;
      case '--port':
        config.port = parseInt(args[++i]);
        break;
      case '--help':
        console.log(`
Templator Visual Test Runner

Usage: ts-node test-runner.ts [options]

Options:
  --test-file <file>    Test file to run (default: comprehensive-e2e.test.ts)
  --watch              Watch for file changes and re-run tests
  --verbose            Show verbose output
  --no-report          Don't generate HTML report
  --no-browser         Don't open browser automatically
  --port <number>      Port for dashboard server (default: 3001)
  --help               Show this help message

Examples:
  ts-node test-runner.ts                           # Run with defaults
  ts-node test-runner.ts --verbose --port 3002     # Verbose mode on port 3002
  ts-node test-runner.ts --test-file my-test.ts    # Run specific test file
        `);
        process.exit(0);
    }
  }

  const runner = new VisualTestRunner(config);
  
  runner.start().then(() => {
    console.log('\n✨ Test runner started successfully!');
    console.log('📱 Dashboard features:');
    console.log('   • Real-time test execution monitoring');
    console.log('   • Live log streaming');
    console.log('   • Visual progress tracking');
    console.log('   • Interactive test results');
    console.log('   • HTML report generation');
    console.log('\n🔧 Press Ctrl+C to stop the server');
  }).catch((error) => {
    logger.error('Failed to start test runner', { error });
    process.exit(1);
  });
}

export default VisualTestRunner;
