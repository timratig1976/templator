/**
 * Comprehensive End-to-End Test Suite
 * Tests the complete project flow with visual feedback and detailed logging
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../app';
import { createLogger } from '../../utils/logger';
import fs from 'fs';
import path from 'path';

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

class VisualTestReporter {
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

  generateHTMLReport() {
    const html = this.generateHTMLContent();
    fs.writeFileSync(this.logFile, html);
    console.log(`\n📄 HTML Report generated: ${this.logFile}`);
    return this.logFile;
  }

  private generateHTMLContent(): string {
    const totalTests = this.suiteResults.reduce((sum, suite) => sum + suite.totalTests, 0);
    const totalPassed = this.suiteResults.reduce((sum, suite) => sum + suite.passedTests, 0);
    const totalFailed = this.suiteResults.reduce((sum, suite) => sum + suite.failedTests, 0);
    const totalDuration = this.suiteResults.reduce((sum, suite) => sum + suite.totalDuration, 0);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Templator E2E Test Results</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header .subtitle { opacity: 0.9; margin-top: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .stat-card.passed { border-left-color: #28a745; }
        .stat-card.failed { border-left-color: #dc3545; }
        .stat-card.duration { border-left-color: #ffc107; }
        .stat-number { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .stat-label { color: #6c757d; font-size: 0.9em; }
        .suite { margin: 20px; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
        .suite-header { background: #e9ecef; padding: 15px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
        .suite-stats { font-size: 0.9em; color: #6c757d; }
        .test-list { padding: 0; margin: 0; list-style: none; }
        .test-item { padding: 15px; border-bottom: 1px solid #f1f3f4; display: flex; justify-content: space-between; align-items: center; }
        .test-item:last-child { border-bottom: none; }
        .test-status { padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; }
        .status-pass { background: #d4edda; color: #155724; }
        .status-fail { background: #f8d7da; color: #721c24; }
        .status-skip { background: #fff3cd; color: #856404; }
        .test-details { font-size: 0.9em; color: #6c757d; margin-top: 5px; }
        .progress-bar { width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin: 20px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
        .logs { background: #f8f9fa; padding: 10px; margin-top: 10px; border-radius: 4px; font-family: monospace; font-size: 0.8em; }
        .timestamp { color: #6c757d; font-size: 0.8em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Templator E2E Test Results</h1>
            <div class="subtitle">Comprehensive End-to-End Testing Suite</div>
            <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
        </div>
        
        <div class="summary">
            <div class="stat-card">
                <div class="stat-number">${totalTests}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card passed">
                <div class="stat-number">${totalPassed}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card failed">
                <div class="stat-number">${totalFailed}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card duration">
                <div class="stat-number">${(totalDuration / 1000).toFixed(1)}s</div>
                <div class="stat-label">Total Duration</div>
            </div>
        </div>
        
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${(totalPassed / totalTests) * 100}%"></div>
        </div>
        
        ${this.suiteResults.map(suite => `
            <div class="suite">
                <div class="suite-header">
                    <span>${suite.suiteName}</span>
                    <span class="suite-stats">
                        ${suite.passedTests}/${suite.totalTests} passed (${((suite.passedTests / suite.totalTests) * 100).toFixed(1)}%)
                        | ${(suite.totalDuration / 1000).toFixed(1)}s
                    </span>
                </div>
                <ul class="test-list">
                    ${suite.results.map(test => `
                        <li class="test-item">
                            <div>
                                <div>${test.testName}</div>
                                <div class="test-details">
                                    Duration: ${test.duration}ms | ${test.timestamp.toLocaleTimeString()}
                                    ${test.details.error ? `<br>Error: ${test.details.error}` : ''}
                                </div>
                                ${test.logs.length > 0 ? `<div class="logs">${test.logs.join('<br>')}</div>` : ''}
                            </div>
                            <span class="test-status status-${test.status.toLowerCase()}">${test.status}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
  }
}

// Global test reporter
const reporter = new VisualTestReporter();

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

describe('Comprehensive E2E Test Suite', () => {
  beforeAll(async () => {
    logger.info('Setting up comprehensive E2E test environment');
  });

  afterAll(async () => {
    // Generate HTML report
    reporter.generateHTMLReport();
    logger.info('E2E test suite completed');
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

    test('Field Mapping Accuracy', async () => {
      const result = await runTest('Field Mapping Accuracy', async () => {
        const testHtml = `
          <h1 data-field="headline">Main Headline</h1>
          <p data-field="description">Description text</p>
          <img data-field="hero_image" src="test.jpg" alt="Test">
          <a data-field="cta_link" href="#">Call to Action</a>
        `;

        const response = await request(app)
          .post('/api/parse')
          .send({
            source_type: 'html',
            payload: testHtml
          })
          .expect(200);

        const fields = response.body.fields_detected;
        const fieldTypes = fields.map((f: any) => f.type);

        expect(fieldTypes).toContain('text');
        expect(fieldTypes).toContain('richtext');
        expect(fieldTypes).toContain('image');
        expect(fieldTypes).toContain('url');

        return {
          fieldsDetected: fields.length,
          fieldTypes: fieldTypes
        };
      });

      reporter.addTestResult(result);
    });
  });

  describe('2. AI Processing Pipeline', () => {
    beforeEach(() => {
      reporter.startSuite('AI Processing Pipeline');
    });

    afterEach(() => {
      reporter.endSuite();
    });

    test('Module Generation from Sections', async () => {
      const result = await runTest('Module Generation from Sections', async () => {
        const sectionData = {
          id: 'test-section-1',
          type: 'hero',
          html: '<div class="hero"><h1>Hero Title</h1><p>Hero description</p></div>',
          complexity: 25,
          estimatedFields: 3
        };

        const response = await request(app)
          .post('/api/layout/process')
          .send({
            sections: [sectionData],
            options: {
              batch_size: 1,
              quality_threshold: 70
            }
          })
          .expect(200);

        expect(response.body.processed_sections).toBeDefined();
        expect(response.body.processed_sections.length).toBe(1);

        const processedSection = response.body.processed_sections[0];
        expect(processedSection.module_data).toBeDefined();
        expect(processedSection.module_data.fields).toBeDefined();
        expect(processedSection.module_data.html).toBeDefined();

        return {
          sectionsProcessed: response.body.processed_sections.length,
          qualityScore: processedSection.validation_result?.score || 0
        };
      });

      reporter.addTestResult(result);
    });

    test('Sequential Processing Quality', async () => {
      const result = await runTest('Sequential Processing Quality', async () => {
        const multipleSections = [
          {
            id: 'header-section',
            type: 'header',
            html: '<header><nav>Navigation</nav></header>',
            complexity: 15,
            estimatedFields: 2
          },
          {
            id: 'hero-section', 
            type: 'hero',
            html: '<div class="hero"><h1>Title</h1><p>Description</p></div>',
            complexity: 30,
            estimatedFields: 4
          }
        ];

        const response = await request(app)
          .post('/api/layout/process')
          .send({
            sections: multipleSections,
            options: {
              batch_size: 2,
              quality_threshold: 75,
              combine_results: true
            }
          })
          .expect(200);

        expect(response.body.combined_module).toBeDefined();
        expect(response.body.overall_quality_score).toBeGreaterThan(70);

        return {
          sectionsProcessed: multipleSections.length,
          overallQuality: response.body.overall_quality_score,
          hasCombinedModule: !!response.body.combined_module
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
              required: true,
              default: 'Default Headline'
            }
          ],
          meta: {
            label: 'Test Module',
            description: 'A test module',
            icon: 'layout',
            content_types: ['LANDING_PAGE']
          },
          template: '<div><h1>{{ module.headline }}</h1></div>'
        };

        const response = await request(app)
          .post('/api/validation/validate')
          .send({
            module: validModule,
            validation_level: 'comprehensive',
            include_performance: true,
            include_accessibility: true
          })
          .expect(200);

        expect(response.body.status).toBe('passed');
        expect(response.body.overall_score).toBeGreaterThan(80);
        expect(response.body.schema_compatibility.compatible).toBe(true);

        return {
          validationStatus: response.body.status,
          overallScore: response.body.overall_score,
          schemaCompatible: response.body.schema_compatibility.compatible
        };
      });

      reporter.addTestResult(result);
    });

    test('Module Validation - Invalid Module', async () => {
      const result = await runTest('Module Validation - Invalid Module', async () => {
        const invalidModule = {
          fields: [
            {
              // Missing required properties
              id: 'invalid-field',
              type: 'unknown_type'
            }
          ],
          meta: {
            // Missing required meta properties
            label: ''
          },
          template: '<div>{{ module.nonexistent_field }}</div>'
        };

        const response = await request(app)
          .post('/api/validation/validate')
          .send({
            module: invalidModule,
            validation_level: 'standard',
            include_performance: false,
            include_accessibility: false
          })
          .expect(200);

        expect(response.body.status).toBe('failed');
        expect(response.body.validation_result.errors.length).toBeGreaterThan(0);

        return {
          validationStatus: response.body.status,
          errorsCount: response.body.validation_result.errors.length,
          warningsCount: response.body.validation_result.warnings.length
        };
      });

      reporter.addTestResult(result);
    });

    test('Batch Validation', async () => {
      const result = await runTest('Batch Validation', async () => {
        const modules = [
          {
            module_id: 'module-1',
            module: {
              fields: [{ id: 'title', name: 'title', label: 'Title', type: 'text', required: true }],
              meta: { label: 'Module 1', content_types: ['LANDING_PAGE'] },
              template: '<h1>{{ module.title }}</h1>'
            }
          },
          {
            module_id: 'module-2',
            module: {
              fields: [{ id: 'description', name: 'description', label: 'Description', type: 'richtext' }],
              meta: { label: 'Module 2', content_types: ['SITE_PAGE'] },
              template: '<p>{{ module.description }}</p>'
            }
          }
        ];

        const response = await request(app)
          .post('/api/validation/validate-batch')
          .send({
            modules,
            validation_options: {
              validation_level: 'standard',
              include_performance: true,
              include_accessibility: true,
              fail_fast: false
            }
          })
          .expect(200);

        expect(response.body.total_modules).toBe(2);
        expect(response.body.validated_modules).toBe(2);
        expect(response.body.results.length).toBe(2);

        return {
          totalModules: response.body.total_modules,
          validatedModules: response.body.validated_modules,
          passedModules: response.body.passed_modules,
          overallBatchScore: response.body.overall_batch_score
        };
      });

      reporter.addTestResult(result);
    });
  });

  describe('4. Export and Packaging', () => {
    beforeEach(() => {
      reporter.startSuite('Export and Packaging');
    });

    afterEach(() => {
      reporter.endSuite();
    });

    test('Module Export Generation', async () => {
      const result = await runTest('Module Export Generation', async () => {
        const moduleData = {
          fields: [
            {
              id: 'headline',
              name: 'headline',
              label: 'Headline',
              type: 'text',
              required: true
            }
          ],
          meta: {
            label: 'Export Test Module',
            description: 'Test module for export',
            content_types: ['LANDING_PAGE']
          },
          template: '<div class="module"><h1>{{ module.headline }}</h1></div>'
        };

        const response = await request(app)
          .post('/api/export/module')
          .send({
            module_data: moduleData,
            export_format: 'hubspot_zip',
            include_preview: true
          })
          .expect(200);

        expect(response.body.export_id).toBeDefined();
        expect(response.body.download_url).toBeDefined();
        expect(response.body.manifest).toBeDefined();

        return {
          exportId: response.body.export_id,
          hasDownloadUrl: !!response.body.download_url,
          manifestFields: response.body.manifest.fields.length
        };
      });

      reporter.addTestResult(result);
    });

    test('Batch Export Processing', async () => {
      const result = await runTest('Batch Export Processing', async () => {
        const modules = [
          {
            module_id: 'export-module-1',
            module_data: {
              fields: [{ id: 'title', name: 'title', label: 'Title', type: 'text' }],
              meta: { label: 'Export Module 1' },
              template: '<h1>{{ module.title }}</h1>'
            }
          },
          {
            module_id: 'export-module-2',
            module_data: {
              fields: [{ id: 'content', name: 'content', label: 'Content', type: 'richtext' }],
              meta: { label: 'Export Module 2' },
              template: '<div>{{ module.content }}</div>'
            }
          }
        ];

        const response = await request(app)
          .post('/api/export/batch')
          .send({
            modules,
            export_options: {
              format: 'hubspot_zip',
              combine_modules: false,
              include_previews: true
            }
          })
          .expect(200);

        expect(response.body.batch_id).toBeDefined();
        expect(response.body.exports.length).toBe(2);

        return {
          batchId: response.body.batch_id,
          exportsCount: response.body.exports.length,
          allSuccessful: response.body.exports.every((exp: any) => exp.status === 'completed')
        };
      });

      reporter.addTestResult(result);
    });
  });

  describe('5. Integration and Performance', () => {
    beforeEach(() => {
      reporter.startSuite('Integration and Performance');
    });

    afterEach(() => {
      reporter.endSuite();
    });

    test('Schema Compatibility Check', async () => {
      const result = await runTest('Schema Compatibility Check', async () => {
        const response = await request(app)
          .get('/api/validation/schema')
          .expect(200);

        expect(response.body.version).toBeDefined();
        expect(response.body.field_types).toBeDefined();
        expect(response.body.content_types).toBeDefined();
        expect(response.body.module_requirements).toBeDefined();

        return {
          schemaVersion: response.body.version,
          fieldTypesCount: response.body.field_types.length,
          contentTypesCount: response.body.content_types.length
        };
      });

      reporter.addTestResult(result);
    });

    test('End-to-End Processing Performance', async () => {
      const result = await runTest('End-to-End Processing Performance', async () => {
        const startTime = Date.now();
        
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
          .send({ source_type: 'html', payload: complexHtml });

        // Step 2: Split into sections
        const splitResponse = await request(app)
          .post('/api/layout/split')
          .send({ html: complexHtml, options: { max_sections: 5 } });

        // Step 3: Process sections
        const processResponse = await request(app)
          .post('/api/layout/process')
          .send({
            sections: splitResponse.body.sections,
            options: { quality_threshold: 70, combine_results: true }
          });

        // Step 4: Validate result
        const validationResponse = await request(app)
          .post('/api/validation/validate')
          .send({
            module: processResponse.body.combined_module,
            validation_level: 'standard'
          });

        const totalTime = Date.now() - startTime;

        expect(parseResponse.status).toBe(200);
        expect(splitResponse.status).toBe(200);
        expect(processResponse.status).toBe(200);
        expect(validationResponse.status).toBe(200);

        return {
          totalProcessingTime: totalTime,
          sectionsGenerated: splitResponse.body.sections.length,
          finalQualityScore: validationResponse.body.overall_score,
          performanceAcceptable: totalTime < 30000 // 30 seconds threshold
        };
      });

      reporter.addTestResult(result);
    });
  });
});
