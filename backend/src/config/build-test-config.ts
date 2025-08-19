/**
 * Build Test Configuration
 * Configuration settings for the AutoBuildTestService
 */

import { AutoBuildTestConfig } from '../services/testing/AutoBuildTestService';

export const defaultBuildTestConfig: AutoBuildTestConfig = {
  // Run build tests every 15 minutes
  interval: 15,
  
  // Enable automatic build testing
  enabled: process.env.NODE_ENV !== 'test',
  
  // Directories to watch for TypeScript files - COMPREHENSIVE COVERAGE
  watchDirectories: [
    'src', // Watch entire src directory to catch ALL files
    'scripts', // Include build and utility scripts
    'config' // Include configuration files
  ],
  
  // Patterns to exclude from build testing - MINIMAL EXCLUSIONS for maximum coverage
  excludePatterns: [
    '**/node_modules/**',     // Dependencies
    '**/dist/**',             // Build output
    '**/build/**',            // Build artifacts
    '**/.git/**',             // Git files
    '**/coverage/**',         // Test coverage reports
    '**/*.d.ts',              // Type declaration files (auto-generated)
    '**/temp/**',             // Temporary files
    '**/*TempTest*',          // Temporary test files
    '**/.next/**',            // Next.js build
    '**/.nuxt/**'             // Nuxt.js build
    // NOTE: We deliberately INCLUDE test files (*.test.ts, *.spec.ts) for comprehensive validation
  ],
  
  // Notify on build errors
  notifyOnError: true,
  
  // Generate detailed reports
  generateReport: true,
  
  // Maximum errors to report (prevent overwhelming output)
  maxErrorsToReport: 100
};

export const developmentBuildTestConfig: AutoBuildTestConfig = {
  ...defaultBuildTestConfig,
  interval: 5, // More frequent in development
  enabled: true,
  notifyOnError: true
};

export const productionBuildTestConfig: AutoBuildTestConfig = {
  ...defaultBuildTestConfig,
  interval: 30, // Less frequent in production
  enabled: true,
  notifyOnError: true,
  maxErrorsToReport: 50
};

export const testBuildTestConfig: AutoBuildTestConfig = {
  ...defaultBuildTestConfig,
  interval: 60, // Very infrequent during testing
  enabled: false, // Disabled during tests
  notifyOnError: false,
  generateReport: false
};

/**
 * Get build test configuration based on environment
 */
export function getBuildTestConfig(): AutoBuildTestConfig {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return productionBuildTestConfig;
    case 'test':
      return testBuildTestConfig;
    case 'development':
    default:
      return developmentBuildTestConfig;
  }
}

/**
 * Service-specific health check configurations
 */
export const serviceHealthThresholds = {
  // Maximum acceptable error count per service phase
  maxErrorsPerPhase: 5,
  
  // Maximum acceptable warning count per service phase
  maxWarningsPerPhase: 10,
  
  // Service phases that are critical (errors here fail the build)
  criticalPhases: ['ai', 'quality', 'storage'],
  
  // Service phases that are non-critical (warnings only)
  nonCriticalPhases: ['testing', 'schema'],
  
  // File patterns that indicate generated files (need special handling)
  generatedFilePatterns: [
    '**/generated/**',
    '**/*.generated.ts',
    '**/temp/**',
    '**/cache/**'
  ]
};

export default getBuildTestConfig;
