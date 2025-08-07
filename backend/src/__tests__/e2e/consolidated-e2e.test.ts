/**
 * Consolidated End-to-End Test Suite
 * Combines the best features of all E2E test files into a single, comprehensive suite
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createApp } from '../../app';
import { createLogger } from '../../utils/logger';
import apiRoutes from '../../routes/api';

const logger = createLogger();
const app = createApp();

// Test results tracking
interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  details: any;
  timestamp: Date;
  logs: string[];
}

interface TestSuiteResult {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalDuration: number;
  results: TestResult[];
  startTime: Date;
  endTime?: Date;
}

class TestReporter {
  private suiteResults: TestSuiteResult[] = [];
  private currentSuite: TestSuiteResult | null = null;
  private logFile: string;

  constructor() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(__dirname, `../../../test-results-${timestamp}.html`);
  }

  startSuite(suiteName: string) {
    this.currentSuite = {
      suiteName,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalDuration: 0,
      results: [],
      startTime: new Date()
    };
    
    console.log(`\n🚀 Starting Test Suite: ${suiteName}`);
    console.log('='.repeat(60));
  }

  addTestResult(result: TestResult) {
    if (!this.currentSuite) return;

    this.currentSuite.results.push(result);
    this.currentSuite.totalTests++;
    this.currentSuite.totalDuration += result.duration;

    switch (result.status) {
      case 'PASS':
        this.currentSuite.passedTests++;
        console.log(`✅ ${result.testName} (${result.duration}ms)`);
        break;
      case 'FAIL':
        this.currentSuite.failedTests++;
        console.log(`❌ ${result.testName} (${result.duration}ms)`);
        console.log(`   Error: ${result.details.error}`);
        break;
      case 'SKIP':
        this.currentSuite.skippedTests++;
        console.log(`⏭️  ${result.testName} (skipped)`);
        break;
    }

    // Log details if verbose
    if (result.logs.length > 0) {
      console.log(`   Logs: ${result.logs.join(', ')}`);
    }
  }

  endSuite() {
    if (!this.currentSuite) return;

    this.currentSuite.endTime = new Date();
    this.suiteResults.push(this.currentSuite);

    const suite = this.currentSuite;
    console.log('='.repeat(60));
    console.log(`📊 Suite Summary: ${suite.suiteName}`);
    console.log(`   Total: ${suite.totalTests} | Passed: ${suite.passedTests} | Failed: ${suite.failedTests} | Skipped: ${suite.skippedTests}`);
    console.log(`   Duration: ${suite.totalDuration}ms`);
    console.log(`   Success Rate: ${((suite.passedTests / suite.totalTests) * 100).toFixed(1)}%`);
    
    this.currentSuite = null;
  }

  generateSummary() {
    const totalTests = this.suiteResults.reduce((sum, suite) => sum + suite.totalTests, 0);
    const totalPassed = this.suiteResults.reduce((sum, suite) => sum + suite.passedTests, 0);
    const totalFailed = this.suiteResults.reduce((sum, suite) => sum + suite.failedTests, 0);
    const totalDuration = this.suiteResults.reduce((sum, suite) => sum + suite.totalDuration, 0);
    const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0';

    console.log('\n📊 Test Summary:');
    console.log(`   Total: ${totalTests} | Passed: ${totalPassed} | Failed: ${totalFailed}`);
    console.log(`   Duration: ${totalDuration}ms | Success Rate: ${successRate}%`);
    
    logger.info('Test suite summary', {
      totalTests,
      totalPassed,
      totalFailed,
      totalDuration,
      successRate
    });
  }
}

// Global test reporter
const reporter = new TestReporter();

// Helper function to run a test with logging
async function runTest(testName: string, testFn: () => Promise<any>): Promise<TestResult> {
  const startTime = Date.now();
  const logs: string[] = [];
  
  try {
    logger.info(`Starting test: ${testName}`);
    logs.push(`Starting test: ${testName}`);
    
    const result = await testFn();
    const duration = Date.now() - startTime;
    
    logger.info(`Test passed: ${testName} (${duration}ms)`);
    logs.push(`Test completed successfully`);
    
    return {
      testName,
      status: 'PASS',
      duration,
      details: result,
      timestamp: new Date(),
      logs
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error(`Test failed: ${testName} (${duration}ms)`, { error });
    logs.push(`Test failed: ${(error as Error).message}`);
    
    return {
      testName,
      status: 'FAIL',
      duration,
      details: { error: (error as Error).message },
      timestamp: new Date(),
      logs
    };
  }
}

describe('Consolidated E2E Test Suite', () => {
  beforeAll(async () => {
    logger.info('Setting up consolidated E2E test environment');
    console.log('\n🧪 Consolidated E2E Test Suite');
    console.log('📋 Comprehensive testing of all major workflows');
  });

  afterAll(async () => {
    reporter.generateSummary();
    logger.info('Consolidated E2E test suite completed');
  });

  describe('1. Input Processing Pipeline', () => {
    beforeEach(() => {
      reporter.startSuite('Input Processing Pipeline');
    });

    afterEach(() => {
      reporter.endSuite();
    });

    test('HTML Input Processing', async () => {
      const result = await runTest('HTML Input Processing', async () => {
        const htmlInput = `
          <div class="hero-section">
            <h1>Welcome to Our Site</h1>
            <p>This is a sample paragraph</p>
            <img src="hero.jpg" alt="Hero Image">
            <a href="#" class="cta-button">Get Started</a>
          </div>
        `;

        const response = await request(app)
          .post('/api/parse')
          .send({
            source_type: 'html',
            payload: htmlInput
          })
          .expect(200);

        expect(response.body.fields_detected).toBeDefined();
        expect(response.body.fields_detected.length).toBeGreaterThan(0);
        expect(response.body.html_normalized).toBeDefined();

        return {
          fieldsDetected: response.body.fields_detected.length,
          htmlNormalized: response.body.html_normalized.length
        };
      });

      reporter.addTestResult(result);
    });

    test('Complex Layout Splitting', async () => {
      const result = await runTest('Complex Layout Splitting', async () => {
        const complexHtml = `
          <header><nav>Navigation</nav></header>
          <main>
            <section class="hero">Hero Content</section>
            <section class="features">Features</section>
            <section class="testimonials">Testimonials</section>
          </main>
          <footer>Footer Content</footer>
        `;

        const response = await request(app)
          .post('/api/layout/split')
          .send({
            html: complexHtml,
            options: {
              max_sections: 5,
              min_complexity: 10
            }
          })
          .expect(200);

        expect(response.body.sections).toBeDefined();
        expect(response.body.sections.length).toBeGreaterThan(1);

        return {
          sectionsCount: response.body.sections.length,
          totalComplexity: response.body.total_complexity
        };
      });

      reporter.addTestResult(result);
    });
  });

  describe('2. Design Upload and Processing', () => {
    beforeEach(() => {
      reporter.startSuite('Design Upload and Processing');
    });

    afterEach(() => {
      reporter.endSuite();
    });

    test('Design Upload and Conversion', async () => {
      const result = await runTest('Design Upload and Conversion', async () => {
        // Mock image file (1x1 PNG)
        const mockImageBuffer = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
          0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
          0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
          0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
          0x44, 0xAE, 0x42, 0x60, 0x82
        ]);

        const supportedTypesResponse = await request(app)
          .get('/api/design/supported-types')
          .expect(200);

        expect(supportedTypesResponse.body.success).toBe(true);
        expect(supportedTypesResponse.body.data.supportedTypes).toContainEqual(
          expect.objectContaining({ extension: 'png', mimeType: 'image/png' })
        );

        const uploadResponse = await request(app)
          .post('/api/design/upload')
          .attach('design', mockImageBuffer, 'landing-page-design.png')
          .expect(200);

        expect(uploadResponse.body.success).toBe(true);
        expect(uploadResponse.body.data.packagedModule?.name).toBe('landing-page-design.png');
        expect(uploadResponse.body.data).toHaveProperty('sections');
        expect(uploadResponse.body.data.sections).toBeInstanceOf(Array);
        expect(uploadResponse.body.data.sections.length).toBeGreaterThan(0);

        return {
          supportedTypes: supportedTypesResponse.body.data.supportedTypes.length,
          sectionsGenerated: uploadResponse.body.data.sections.length
        };
      });

      reporter.addTestResult(result);
    }, 30000);

    test('Error Handling for Invalid Uploads', async () => {
      const result = await runTest('Error Handling for Invalid Uploads', async () => {
        // Test 1: Invalid file type
        const invalidFile = Buffer.from('This is not an image');
        const invalidResponse = await request(app)
          .post('/api/design/upload')
          .attach('design', invalidFile, 'document.txt')
          .expect(400);

        expect(invalidResponse.body.success).toBe(false);
        expect(invalidResponse.body.error).toContain('Invalid file type');

        // Test 2: Missing file
        const noFileResponse = await request(app)
          .post('/api/design/upload')
          .expect(400);

        expect(noFileResponse.body.success).toBe(false);
        expect(noFileResponse.body.error).toContain('No file uploaded');

        return {
          invalidFileHandled: invalidResponse.status === 400,
          missingFileHandled: noFileResponse.status === 400
        };
      });

      reporter.addTestResult(result);
    });
  });

  describe('3. Validation Pipeline', () => {
    beforeEach(() => {
      reporter.startSuite('Validation Pipeline');
    });

    afterEach(() => {
      reporter.endSuite();
    });

    test('Module Validation - Valid Module', async () => {
      const result = await runTest('Module Validation - Valid Module', async () => {
        const validModule = {
          fields: [
            {
              id: 'headline',
              name: 'headline',
              label: 'Headline',
              type: 'text',
              default: 'Welcome to our site'
            },
            {
              id: 'description',
              name: 'description',
              label: 'Description',
              type: 'richtext',
              default: '<p>This is a sample description</p>'
            }
          ],
          template: '<div class="module"><h1>{{headline}}</h1><div>{{description}}</div></div>'
        };

        const response = await request(app)
          .post('/api/validation/validate')
          .send({
            module: validModule
          })
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toHaveLength(0);

        return {
          validationStatus: response.body.status,
          errorCount: response.body.errors.length,
          hasRecommendations: Array.isArray(response.body.recommendations)
        };
      });

      reporter.addTestResult(result);
    });

    test('XSS Prevention in Module Validation', async () => {
      const result = await runTest('XSS Prevention in Module Validation', async () => {
        const maliciousModule = {
          fields: [
            {
              id: 'headline',
              name: 'headline',
              label: 'Headline',
              type: 'text',
              default: 'Welcome to our site'
            }
          ],
          template: '<div class="module"><h1>{{headline}}</h1><script>alert("XSS")</script></div>'
        };

        const response = await request(app)
          .post('/api/validation/validate')
          .send({
            module: maliciousModule
          })
          .expect(200);

        expect(response.body.module.template).not.toContain('<script>');
        expect(response.body.module.template).not.toContain('alert("XSS")');

        return {
          scriptTagRemoved: !response.body.module.template.includes('<script>'),
          alertFunctionRemoved: !response.body.module.template.includes('alert("XSS")'),
          validationStatus: response.body.status
        };
      });

      reporter.addTestResult(result);
    });
  });

  describe('4. Pipeline Integration', () => {
    beforeEach(() => {
      reporter.startSuite('Pipeline Integration');
    });

    afterEach(() => {
      reporter.endSuite();
    });

    test('End-to-End Workflow', async () => {
      const result = await runTest('End-to-End Workflow', async () => {
        const complexHtml = `
          <div class="landing-page">
            <header class="header">
              <nav><ul><li><a href="#">Home</a></li><li><a href="#">About</a></li></ul></nav>
            </header>
            <main>
              <section class="hero">
                <h1>Welcome to Our Platform</h1>
                <p>Transform your business with our innovative solutions</p>
                <img src="hero.jpg" alt="Hero Image">
                <a href="#" class="cta">Get Started Today</a>
              </section>
              <section class="features">
                <h2>Our Features</h2>
                <div class="feature-grid">
                  <div class="feature"><h3>Feature 1</h3><p>Description</p></div>
                  <div class="feature"><h3>Feature 2</h3><p>Description</p></div>
                  <div class="feature"><h3>Feature 3</h3><p>Description</p></div>
                </div>
              </section>
            </main>
            <footer>
              <p>&copy; 2024 Our Company</p>
            </footer>
          </div>
        `;

        // Step 1: Parse HTML
        const parseResponse = await request(app)
          .post('/api/parse')
          .send({ source_type: 'html', payload: complexHtml })
          .expect(200);

        const splitResponse = await request(app)
          .post('/api/layout/split')
          .send({ html: complexHtml, options: { max_sections: 5 } })
          .expect(200);

        // Step 3: Process sections
        const processResponse = await request(app)
          .post('/api/layout/process')
          .send({
            sections: splitResponse.body.sections,
            options: { quality_threshold: 70, combine_results: true }
          })
          .expect(200);

        const validationResponse = await request(app)
          .post('/api/validation/validate')
          .send({
            module: processResponse.body.combined_module,
            validation_level: 'standard'
          })
          .expect(200);

        return {
          parseSuccess: parseResponse.status === 200,
          splitSuccess: splitResponse.status === 200,
          processSuccess: processResponse.status === 200,
          validationSuccess: validationResponse.status === 200,
          sectionsGenerated: splitResponse.body.sections.length,
          workflowComplete: true
        };
      });

      reporter.addTestResult(result);
    }, 60000);
  });

  describe('5. Performance and Security', () => {
    beforeEach(() => {
      reporter.startSuite('Performance and Security');
    });

    afterEach(() => {
      reporter.endSuite();
    });

    test('File Size Validation', async () => {
      const result = await runTest('File Size Validation', async () => {
        // Create a file larger than 10MB
        const largeFile = Buffer.alloc(11 * 1024 * 1024, 'x');

        const response = await request(app)
          .post('/api/design/upload')
          .attach('design', largeFile, 'large-file.png')
          .expect(413); // Payload too large

        expect(response.body.success).toBe(false);

        return {
          rejectsTooLargeFiles: response.status === 413,
          errorMessage: response.body.error || response.body.message
        };
      });

      reporter.addTestResult(result);
    });

    test('Input Sanitization', async () => {
      const result = await runTest('Input Sanitization', async () => {
        const maliciousHTML = '<script>alert("xss")</script><div>Content</div>';

        const response = await request(app)
          .post('/api/design/refine')
          .send({
            html: maliciousHTML,
            requirements: 'Make it safe'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        // The refined HTML should not contain the script tag
        expect(response.body.data.refinedHTML).not.toContain('<script>');

        return {
          scriptTagRemoved: !response.body.data.refinedHTML.includes('<script>'),
          alertFunctionRemoved: !response.body.data.refinedHTML.includes('alert("xss")'),
          refinementSuccess: response.body.success
        };
      });

      reporter.addTestResult(result);
    });
  });
});
