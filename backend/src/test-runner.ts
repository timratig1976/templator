#!/usr/bin/env ts-node

/**
 * Visual Test Runner - Refactored Modular Version
 * Now uses modular components for better maintainability
 */

import { TestRunnerCLI, TestRunnerCLIConfig } from '../../tests/backend/runner/TestRunnerCLI';
import { createLogger } from './utils/logger';

const logger = createLogger();

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config = TestRunnerCLI.parseArgs(args);

  const cli = new TestRunnerCLI(config);
  
  cli.start().then(() => {
    console.log('\n✨ Test runner started successfully!');
    console.log('📱 Dashboard features:');
    console.log('   • Real-time test execution monitoring');
    console.log('   • Live log streaming');
    console.log('   • Visual progress tracking');
    console.log('   • Interactive test results');
    console.log('   • HTML report generation');
    console.log('\n🔧 Press Ctrl+C to stop the server');
  }).catch((error: unknown) => {
    logger.error('Failed to start test runner', { error });
    process.exit(1);
  });
}

export { TestRunnerCLI };
