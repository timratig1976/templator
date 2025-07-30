import { BaseService } from '../../shared/BaseService';
import { TestRunnerServer } from './TestRunnerServer';
import { TestReportGenerator } from './TestReportGenerator';
import { spawn } from 'child_process';

export interface TestRunnerCLIConfig {
  testFile?: string;
  watch?: boolean;
  verbose?: boolean;
  generateReport?: boolean;
  openBrowser?: boolean;
  port?: number;
}

/**
 * Command-line interface for the test runner
 * Handles CLI argument parsing and orchestrates server and report generation
 */
export class TestRunnerCLI extends BaseService {
  private server: TestRunnerServer;
  private reportGenerator: TestReportGenerator;

  constructor(config: TestRunnerCLIConfig) {
    super('TestRunnerCLI', config);
    
    this.server = new TestRunnerServer({
      port: config.port || 3001,
      verbose: config.verbose || false
    });
    
    this.reportGenerator = new TestReportGenerator({
      outputDir: './reports',
      generateHTML: config.generateReport !== false
    });
  }

  protected async initialize(): Promise<void> {
    // Set up event forwarding
    this.server.on('suite-completed', async (result) => {
      if (this.config.generateReport) {
        try {
          await this.reportGenerator.generateReport(result);
          this.logger.info('Test report generated successfully');
        } catch (error) {
          this.logger.error('Failed to generate test report', { error });
        }
      }
    });
  }

  /**
   * Start the test runner with CLI configuration
   */
  async start(): Promise<void> {
    await this.ensureInitialized();
    
    this.logger.info('Starting test runner CLI', this.config);
    
    // Start the server
    await this.server.start();
    
    // Open browser if requested
    if (this.config.openBrowser) {
      await this.openBrowser();
    }
    
    // Set up graceful shutdown
    this.setupGracefulShutdown();
    
    this.logger.info('Test runner CLI started successfully', {
      port: this.config.port,
      dashboard: `http://localhost:${this.config.port}`
    });
  }

  /**
   * Parse command line arguments
   */
  static parseArgs(args: string[]): TestRunnerCLIConfig {
    const config: TestRunnerCLIConfig = {};

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
          TestRunnerCLI.showHelp();
          process.exit(0);
      }
    }

    return config;
  }

  /**
   * Show CLI help
   */
  static showHelp(): void {
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
  }

  /**
   * Open browser to dashboard
   */
  private async openBrowser(): Promise<void> {
    const url = `http://localhost:${this.config.port}`;
    
    try {
      const { default: open } = await import('open');
      await open(url);
      this.logger.info('Browser opened', { url });
    } catch (error) {
      this.logger.warn('Failed to open browser automatically', { error, url });
      console.log(`\n🌐 Open your browser to: ${url}`);
    }
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully`);
      
      try {
        await this.server.stop();
        await this.cleanup();
        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
  }

  /**
   * Run tests programmatically
   */
  async runTests(categories?: string[]): Promise<void> {
    return this.server.runTests(categories);
  }

  /**
   * Get test status
   */
  getTestStatus() {
    return this.server.getTestStatus();
  }

  protected async cleanup(): Promise<void> {
    await this.server.shutdown();
    await super.cleanup();
  }
}
