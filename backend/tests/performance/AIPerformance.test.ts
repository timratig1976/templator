import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HubSpotValidationService } from '../../src/services/HubSpotValidationService';
import { IterativeRefinementService } from '../../src/services/IterativeRefinementService';
import { AutoErrorCorrectionService } from '../../src/services/AutoErrorCorrectionService';
import { PromptVersioningService } from '../../src/services/PromptVersioningService';
import { HubSpotModuleBuilder } from '../../src/services/HubSpotModuleBuilder';
import { ModuleGenerationRequest } from '../../src/services/HubSpotPromptService';

// Mock OpenAI service for performance testing
jest.mock('../../src/services/openaiService', () => ({
  generateHubSpotModule: jest.fn()
}));

describe('AI Performance and Load Tests', () => {
  let validationService: HubSpotValidationService;
  let refinementService: IterativeRefinementService;
  let correctionService: AutoErrorCorrectionService;
  let versioningService: PromptVersioningService;
  let moduleBuilder: HubSpotModuleBuilder;

  beforeEach(() => {
    validationService = HubSpotValidationService.getInstance();
    refinementService = IterativeRefinementService.getInstance();
    correctionService = AutoErrorCorrectionService.getInstance();
    versioningService = PromptVersioningService.getInstance();
    moduleBuilder = new HubSpotModuleBuilder();
  });

  describe('Validation Performance', () => {
    it('should validate small modules quickly', async () => {
      const smallModule = {
        fields: [
          { id: 'title', name: 'Title', label: 'Title', type: 'text' }
        ],
        meta: {
          label: 'Small Module',
          content_types: ['page']
        },
        template: '<h1>{{ module.title }}</h1>',
        description: 'Small test module for performance testing'
      };

      const startTime = process.hrtime.bigint();
      const result = await validationService.validateModule(smallModule);
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should validate large modules within acceptable time', async () => {
      const largeModule = {
        fields: Array.from({ length: 100 }, (_, i) => ({
          id: `field_${i}`,
          name: `Field ${i}`,
          label: `Field ${i}`,
          type: i % 2 === 0 ? 'text' : 'textarea',
          required: i % 3 === 0,
          default: `Default value ${i}`
        })),
        meta: {
          label: 'Large Module',
          content_types: ['page', 'blog-post'],
          css_assets: ['styles.css'],
          js_assets: ['script.js']
        },
        template: Array.from({ length: 100 }, (_, i) => 
          `<div class="field-${i}">{{ module.field_${i} }}</div>`
        ).join('\n'),
        description: 'Large test module with 100 fields for performance testing'
      };

      const startTime = process.hrtime.bigint();
      const result = await validationService.validateModule(largeModule);
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.metrics).toBeDefined();
    });

    it('should handle concurrent validation requests', async () => {
      const modules = Array.from({ length: 10 }, (_, i) => ({
        fields: [
          { id: `title_${i}`, name: `Title ${i}`, label: `Title ${i}`, type: 'text' }
        ],
        meta: {
          label: `Module ${i}`,
          content_types: ['page']
        },
        template: `<h1>{{ module.title_${i} }}</h1>`,
        description: `Concurrent test module ${i}`
      }));

      const startTime = process.hrtime.bigint();
      const results = await Promise.all(
        modules.map(module => validationService.validateModule(module))
      );
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      expect(results).toHaveLength(10);
      results.forEach(result => expect(result).toBeDefined());
      expect(duration).toBeLessThan(1000); // All should complete within 1 second
    });
  });

  describe('Error Correction Performance', () => {
    it('should correct errors efficiently', async () => {
      const moduleWithErrors = {
        fields: [
          { id: '123invalid', name: 'Invalid', type: 'invalid_type' },
          { id: 'duplicate', name: 'Dup 1', type: 'text' },
          { id: 'duplicate', name: 'Dup 2', type: 'text' },
          { id: 'id', name: 'Reserved', type: 'text' }
        ],
        meta: {
          label: 'Error Module'
          // Missing content_types
        },
        template: '<div>{{ module.undefined_field }}</div>'
      };

      const validationResult = await validationService.validateModule(moduleWithErrors);
      
      const startTime = process.hrtime.bigint();
      const correctionResult = await correctionService.correctErrors(
        moduleWithErrors,
        validationResult
      );
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      expect(correctionResult.success).toBe(true);
      expect(duration).toBeLessThan(500); // Should complete within 500ms
      expect(correctionResult.appliedCorrections.length).toBeGreaterThan(0);
    });

    it('should handle batch error correction', async () => {
      const modulesWithErrors = Array.from({ length: 5 }, (_, i) => ({
        fields: [
          { id: `${i}_invalid`, name: `Invalid ${i}`, type: 'invalid_type' }
        ],
        meta: { label: `Error Module ${i}` },
        template: `<div>{{ module.undefined_${i} }}</div>`
      }));

      const validationResults = await Promise.all(
        modulesWithErrors.map(module => validationService.validateModule(module))
      );

      const startTime = process.hrtime.bigint();
      const correctionResults = await Promise.all(
        modulesWithErrors.map((module, i) => 
          correctionService.correctErrors(module, validationResults[i])
        )
      );
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      expect(correctionResults).toHaveLength(5);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      correctionResults.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform 50 validation operations
      for (let i = 0; i < 50; i++) {
        const module = {
          fields: [
            { id: `field_${i}`, name: `Field ${i}`, label: `Field ${i}`, type: 'text' }
          ],
          meta: {
            label: `Module ${i}`,
            content_types: ['page']
          },
          template: `<div>{{ module.field_${i} }}</div>`,
          description: `Test module ${i} for memory usage testing`
        };

        await validationService.validateModule(module);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseInMB = memoryIncrease / (1024 * 1024);

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncreaseInMB).toBeLessThan(50);
    });
  });

  describe('A/B Testing Performance', () => {
    it('should handle prompt selection efficiently', async () => {
      // Create multiple prompt versions
      const prompts = await Promise.all(
        Array.from({ length: 10 }, (_, i) => 
          versioningService.createPromptVersion(
            'hero',
            `Hero prompt version ${i}`,
            `v${i}.0`
          )
        )
      );

      // Start A/B test
      const trafficSplit = Array(10).fill(10); // 10% each
      const abTest = await versioningService.startABTest(
        'Performance Test',
        'hero',
        prompts,
        trafficSplit
      );

      // Measure prompt selection performance
      const startTime = process.hrtime.bigint();
      const selections = Array.from({ length: 1000 }, () => 
        versioningService.selectPromptVariant('hero')
      );
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      expect(selections).toHaveLength(1000);
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      
      // Verify distribution is reasonable
      const selectionCounts = new Map();
      selections.forEach(selection => {
        if (selection) {
          const count = selectionCounts.get(selection.id) || 0;
          selectionCounts.set(selection.id, count + 1);
        }
      });

      // Each variant should get roughly 10% of traffic (within reasonable variance)
      selectionCounts.forEach(count => {
        expect(count).toBeGreaterThan(50); // At least 5%
        expect(count).toBeLessThan(200); // At most 20%
      });
    });
  });

  describe('Stress Tests', () => {
    it('should handle high-frequency validation requests', async () => {
      const module = {
        fields: [
          { id: 'title', name: 'Title', label: 'Title', type: 'text' }
        ],
        meta: {
          label: 'Stress Test Module',
          content_types: ['page']
        },
        template: '<h1>{{ module.title }}</h1>'
      };

      const requestCount = 100;
      const startTime = process.hrtime.bigint();
      
      const promises = Array.from({ length: requestCount }, () => 
        validationService.validateModule(module)
      );
      
      const results = await Promise.all(promises);
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      expect(results).toHaveLength(requestCount);
      results.forEach(result => {
        expect(result.valid).toBe(true);
        expect(result.score).toBeGreaterThan(80);
      });

      const avgDurationPerRequest = duration / requestCount;
      expect(avgDurationPerRequest).toBeLessThan(50); // Average less than 50ms per request
    });

    it('should maintain performance under sustained load', async () => {
      const moduleTypes = ['hero', 'feature_grid', 'contact_form', 'testimonial'];
      const results = [];

      // Simulate 5 minutes of sustained load
      const testDuration = 30000; // 30 seconds for testing (reduced from 5 minutes)
      const requestInterval = 100; // Request every 100ms
      const startTime = Date.now();

      while (Date.now() - startTime < testDuration) {
        const moduleType = moduleTypes[Math.floor(Math.random() * moduleTypes.length)];
        
        const module = {
          fields: [
            { id: `${moduleType}_field`, name: 'Field', label: 'Field', type: 'text' }
          ],
          meta: {
            label: `${moduleType} Module`,
            content_types: ['page']
          },
          template: `<div>{{ module.${moduleType}_field }}</div>`,
          description: `Sustained load test module for ${moduleType}`
        };

        const requestStart = process.hrtime.bigint();
        const result = await validationService.validateModule(module);
        const requestEnd = process.hrtime.bigint();
        const requestDuration = Number(requestEnd - requestStart) / 1000000;

        results.push({
          moduleType,
          duration: requestDuration,
          score: result.score,
          valid: result.valid
        });

        // Wait before next request
        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      // Analyze results
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
      const successRate = results.filter(r => r.valid).length / results.length;

      expect(results.length).toBeGreaterThan(100); // Should have processed many requests
      expect(avgDuration).toBeLessThan(200); // Average duration should remain low
      expect(avgScore).toBeGreaterThan(80); // Quality should remain high
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
    }, 35000);
  });

  describe('Resource Utilization', () => {
    it('should efficiently utilize system resources', async () => {
      const initialMemory = process.memoryUsage();
      const initialCpuUsage = process.cpuUsage();

      // Perform intensive operations
      const operations = Array.from({ length: 20 }, async (_, i) => {
        const module = {
          fields: Array.from({ length: 10 }, (_, j) => ({
            id: `field_${i}_${j}`,
            name: `Field ${i} ${j}`,
            label: `Field ${i} ${j}`,
            type: j % 2 === 0 ? 'text' : 'textarea'
          })),
          meta: {
            label: `Module ${i}`,
            content_types: ['page']
          },
          template: Array.from({ length: 10 }, (_, j) => 
            `<div>{{ module.field_${i}_${j} }}</div>`
          ).join('\n'),
          description: `Resource utilization test module ${i}`
        };

        const validationResult = await validationService.validateModule(module);
        
        if (!validationResult.valid) {
          await correctionService.correctErrors(module, validationResult);
        }

        return validationResult;
      });

      await Promise.all(operations);

      const finalMemory = process.memoryUsage();
      const finalCpuUsage = process.cpuUsage(initialCpuUsage);

      // Memory usage should be reasonable
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase

      // CPU usage should be reasonable (values are in microseconds)
      const totalCpuTime = finalCpuUsage.user + finalCpuUsage.system;
      expect(totalCpuTime).toBeLessThan(10000000); // Less than 10 seconds of CPU time
    });
  });
});
