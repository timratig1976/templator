import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { BaseService } from '../../shared/BaseService';
import { ErrorHandler } from '../../shared/ErrorSystem';
import TestSuiteManager, { TestSuiteResult } from './TestSuiteManager';

export interface TestRunnerServerConfig {
  port: number;
  verbose: boolean;
  staticPath?: string;
}

/**
 * Dedicated server for test runner dashboard and API
 * Separated from CLI and test execution logic
 */
export class TestRunnerServer extends BaseService {
  private app: express.Application;
  private server: any;
  private testSuiteManager: TestSuiteManager;
  private testResults: TestSuiteResult | null = null;
  private isRunning = false;
  private currentExecution: TestSuiteResult | null = null;

  constructor(config: TestRunnerServerConfig) {
    super('TestRunnerServer', config);
    this.app = express();
    this.testSuiteManager = new TestSuiteManager();
    this.setupTestSuiteEvents();
  }

  protected async initialize(): Promise<void> {
    this.setupMiddleware();
    this.setupRoutes();
    this.setupServer();
  }

  private setupTestSuiteEvents(): void {
    this.testSuiteManager.on('suite-started', (result: TestSuiteResult) => {
      this.logger.info('Test suite started', { executionId: result.id, name: result.name });
      this.currentExecution = result;
      this.isRunning = true;
      this.emit('suite-started', result);
    });

    this.testSuiteManager.on('suite-completed', (result: TestSuiteResult) => {
      this.logger.info('Test suite completed', { 
        executionId: result.id, 
        status: result.status,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests
      });
      this.currentExecution = result;
      this.testResults = result;
      this.isRunning = false;
      this.emit('suite-completed', result);
    });

    this.testSuiteManager.on('suite-failed', (result: TestSuiteResult, error: Error) => {
      this.logger.error('Test suite failed', { executionId: result.id, error: error.message });
      this.currentExecution = result;
      this.testResults = result;
      this.isRunning = false;
      this.emit('suite-failed', result, error);
    });

    // Forward other events
    ['test-started', 'test-completed', 'test-output', 'test-error'].forEach(event => {
      this.testSuiteManager.on(event, (...args) => {
        this.emit(event, ...args);
      });
    });
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.static(this.config.staticPath || path.join(__dirname, '../../../public')));
  }

  private setupRoutes(): void {
    // API endpoints
    this.app.get('/api/test-status', (req, res) => {
      try {
        const response = {
          isRunning: this.isRunning,
          results: this.testResults,
          timestamp: new Date().toISOString(),
          summary: this.testResults ? {
            success: this.testResults.failedTests === 0,
            numTotalTests: this.testResults.totalTests || 0,
            numPassedTests: this.testResults.passedTests || 0,
            numFailedTests: this.testResults.failedTests || 0,
            numTotalTestSuites: 1,
            testSuites: this.testResults.tests?.length || 0
          } : null
        };
        
        this.logger.debug('API /test-status called', { 
          isRunning: this.isRunning, 
          hasResults: !!this.testResults 
        });
        
        res.json(response);
      } catch (error) {
        const appError = ErrorHandler.handle(error as Error, { endpoint: '/api/test-status' });
        res.status(appError.statusCode).json(appError.toJSON());
      }
    });

    this.app.post('/api/run-tests', async (req, res) => {
      try {
        if (this.isRunning) {
          return res.status(409).json({
            success: false,
            error: 'Tests are already running',
            code: 'TESTS_RUNNING'
          });
        }

        const { categories } = req.body;
        
        this.logger.info('Starting test execution via API', { categories });
        
        // Start tests asynchronously
        this.runTests(categories).catch(error => {
          this.logger.error('Test execution failed', { error });
        });
        
        res.json({
          success: true,
          message: 'Tests started',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const appError = ErrorHandler.handle(error as Error, { endpoint: '/api/run-tests' });
        res.status(appError.statusCode).json(appError.toJSON());
      }
    });

    this.app.get('/api/test-results', (req, res) => {
      try {
        if (!this.testResults) {
          return res.status(404).json({
            success: false,
            error: 'No test results available',
            code: 'NO_RESULTS'
          });
        }

        res.json({
          success: true,
          results: this.testResults,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        const appError = ErrorHandler.handle(error as Error, { endpoint: '/api/test-results' });
        res.status(appError.statusCode).json(appError.toJSON());
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        ...this.getHealthStatus()
      });
    });
  }

  private setupServer(): void {
    this.server = createServer(this.app);
    
    this.server.on('error', (error: Error) => {
      this.handleError(error, { component: 'http-server' });
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, () => {
        this.logger.info(`Test runner server started on port ${this.config.port}`);
        this.emit('server-started', { port: this.config.port });
        resolve();
      });

      this.server.on('error', (error: Error) => {
        this.logger.error('Failed to start server', { error, port: this.config.port });
        reject(error);
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.logger.info('Test runner server stopped');
          this.emit('server-stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Run tests using the test suite manager
   */
  async runTests(categories?: string[]): Promise<void> {
    if (this.isRunning) {
      throw new Error('Tests are already running');
    }

    try {
      this.isRunning = true;
      this.logger.info('Starting test execution', { categories });
      
      const result = await this.testSuiteManager.executeTestSuite(
        categories || ['api', 'pipeline', 'services']
      );

      this.testResults = result;
      this.logger.info('Test execution completed', { 
        success: result.failedTests === 0,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests
      });

    } catch (error) {
      this.logger.error('Test execution failed', { error });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get current test status
   */
  getTestStatus(): {
    isRunning: boolean;
    results: TestSuiteResult | null;
    currentExecution: TestSuiteResult | null;
  } {
    return {
      isRunning: this.isRunning,
      results: this.testResults,
      currentExecution: this.currentExecution
    };
  }

  protected async cleanup(): Promise<void> {
    await this.stop();
    await super.cleanup();
  }
}
