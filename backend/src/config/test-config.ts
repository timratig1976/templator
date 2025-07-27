/**
 * Test Configuration
 * Centralized configuration for test runner and comprehensive testing
 */

export interface TestConfig {
  // Test execution settings
  testTimeout: number;
  maxConcurrentTests: number;
  retryFailedTests: boolean;
  maxRetries: number;
  
  // Reporting settings
  generateHTMLReport: boolean;
  generateJSONReport: boolean;
  reportOutputDir: string;
  
  // Dashboard settings
  dashboardPort: number;
  enableRealTimeUpdates: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  // Test categories to run
  categories: {
    unit: boolean;
    integration: boolean;
    e2e: boolean;
    performance: boolean;
    validation: boolean;
    api: boolean;
  };
  
  // Performance thresholds
  performance: {
    maxResponseTime: number;
    maxMemoryUsage: number;
    minSuccessRate: number;
  };
  
  // API testing settings
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  
  // Mock data settings
  mockData: {
    useRealAPI: boolean;
    mockDataDir: string;
    generateMockData: boolean;
  };
}

export const defaultTestConfig: TestConfig = {
  // Test execution
  testTimeout: 30000, // 30 seconds
  maxConcurrentTests: 4,
  retryFailedTests: true,
  maxRetries: 2,
  
  // Reporting
  generateHTMLReport: true,
  generateJSONReport: true,
  reportOutputDir: './test-results',
  
  // Dashboard
  dashboardPort: 3001,
  enableRealTimeUpdates: true,
  logLevel: 'info',
  
  // Test categories
  categories: {
    unit: true,
    integration: true,
    e2e: true,
    performance: true,
    validation: true,
    api: true
  },
  
  // Performance thresholds
  performance: {
    maxResponseTime: 5000, // 5 seconds
    maxMemoryUsage: 512, // 512 MB
    minSuccessRate: 95 // 95%
  },
  
  // API testing
  api: {
    baseUrl: 'http://localhost:3000',
    timeout: 10000,
    retries: 3
  },
  
  // Mock data
  mockData: {
    useRealAPI: false,
    mockDataDir: './src/__tests__/mock-data',
    generateMockData: true
  }
};

export class TestConfigManager {
  private config: TestConfig;
  
  constructor(customConfig?: Partial<TestConfig>) {
    this.config = {
      ...defaultTestConfig,
      ...customConfig
    };
  }
  
  getConfig(): TestConfig {
    return this.config;
  }
  
  updateConfig(updates: Partial<TestConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };
  }
  
  // Environment-specific configurations
  getEnvironmentConfig(env: 'development' | 'testing' | 'production'): TestConfig {
    const baseConfig = this.config;
    
    switch (env) {
      case 'development':
        return {
          ...baseConfig,
          logLevel: 'debug',
          mockData: {
            ...baseConfig.mockData,
            useRealAPI: false
          }
        };
        
      case 'testing':
        return {
          ...baseConfig,
          testTimeout: 60000, // Longer timeout for CI
          maxConcurrentTests: 2, // Fewer concurrent tests for stability
          mockData: {
            ...baseConfig.mockData,
            useRealAPI: false
          }
        };
        
      case 'production':
        return {
          ...baseConfig,
          logLevel: 'warn',
          categories: {
            ...baseConfig.categories,
            performance: true, // Always run performance tests in production
            e2e: true
          },
          mockData: {
            ...baseConfig.mockData,
            useRealAPI: true // Use real APIs in production testing
          }
        };
        
      default:
        return baseConfig;
    }
  }
  
  // Validate configuration
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (this.config.testTimeout < 1000) {
      errors.push('Test timeout must be at least 1000ms');
    }
    
    if (this.config.maxConcurrentTests < 1) {
      errors.push('Max concurrent tests must be at least 1');
    }
    
    if (this.config.performance.minSuccessRate < 0 || this.config.performance.minSuccessRate > 100) {
      errors.push('Min success rate must be between 0 and 100');
    }
    
    if (this.config.dashboardPort < 1024 || this.config.dashboardPort > 65535) {
      errors.push('Dashboard port must be between 1024 and 65535');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  // Export configuration for Jest
  getJestConfig(): any {
    return {
      testTimeout: this.config.testTimeout,
      maxConcurrency: this.config.maxConcurrentTests,
      verbose: this.config.logLevel === 'debug',
      collectCoverage: true,
      coverageDirectory: `${this.config.reportOutputDir}/coverage`,
      coverageReporters: ['html', 'text', 'lcov'],
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
      testMatch: this.getTestPatterns(),
      moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1'
      }
    };
  }
  
  private getTestPatterns(): string[] {
    const patterns: string[] = [];
    
    if (this.config.categories.unit) {
      patterns.push('**/*.unit.test.ts');
    }
    
    if (this.config.categories.integration) {
      patterns.push('**/*.integration.test.ts');
    }
    
    if (this.config.categories.e2e) {
      patterns.push('**/*.e2e.test.ts');
    }
    
    if (this.config.categories.performance) {
      patterns.push('**/*.performance.test.ts');
    }
    
    if (this.config.categories.validation) {
      patterns.push('**/*.validation.test.ts');
    }
    
    if (this.config.categories.api) {
      patterns.push('**/*.api.test.ts');
    }
    
    return patterns.length > 0 ? patterns : ['**/*.test.ts'];
  }
}

// Export singleton instance
export const testConfigManager = new TestConfigManager();

// Environment detection
export function getEnvironment(): 'development' | 'testing' | 'production' {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'test' || env === 'testing') {
    return 'testing';
  }
  
  if (env === 'production') {
    return 'production';
  }
  
  return 'development';
}

// Load configuration based on environment
export function loadTestConfig(): TestConfig {
  const env = getEnvironment();
  return testConfigManager.getEnvironmentConfig(env);
}
