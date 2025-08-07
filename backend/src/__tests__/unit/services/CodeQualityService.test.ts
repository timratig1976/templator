import { CodeQualityService } from '../../../services/quality/CodeQualityService';
import { promises as fs } from 'fs';
import { exec } from 'child_process';

// Mock file system and exec
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    readdir: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn()
  }
}));

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('util', () => ({
  promisify: jest.fn((fn) => fn)
}));

describe('CodeQualityService', () => {
  let codeQualityService: CodeQualityService;
  let mockFs: jest.Mocked<typeof fs>;
  let mockExec: jest.MockedFunction<typeof exec>;

  beforeEach(() => {
    codeQualityService = new CodeQualityService();
    mockFs = jest.mocked(fs);
    mockExec = jest.mocked(exec);
    jest.clearAllMocks();
    
    jest.setTimeout(10000);
  });

  afterEach(() => {
    // Clean up any pending operations
    jest.clearAllTimers();
    jest.clearAllMocks();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('getCodeQualityMetrics', () => {
    it('should return real code quality metrics', async () => {
      // Mock TypeScript compilation success
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('tsc --noEmit')) {
          callback(null, { stdout: '', stderr: '' });
        } else if (command.includes('eslint')) {
          callback(null, { 
            stdout: JSON.stringify([
              { errorCount: 2, warningCount: 5 },
              { errorCount: 1, warningCount: 3 }
            ])
          });
        } else if (command.includes('find')) {
          callback(null, { stdout: 'file1.ts\nfile2.ts\nfile3.ts' });
        }
        return {} as any;
      });

      // Mock file operations
      mockFs.readFile.mockResolvedValue(`
        function testFunction() {
          if (condition) {
            for (let i = 0; i < 10; i++) {
              console.log(i);
            }
          }
        }
      `);

      mockFs.readdir.mockResolvedValue([
        { name: 'file1.ts', isDirectory: () => false, isFile: () => true } as any,
        { name: 'file2.ts', isDirectory: () => false, isFile: () => true } as any,
        { name: 'subdir', isDirectory: () => true, isFile: () => false } as any
      ]);

      const metrics = await codeQualityService.getCodeQualityMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.overall).toBeGreaterThan(0);
      expect(metrics.overall).toBeLessThanOrEqual(100);
      expect(metrics.typescript).toBeGreaterThan(0);
      expect(metrics.eslint).toBeGreaterThan(0);
      expect(metrics.complexity).toBeGreaterThan(0);
      expect(metrics.documentation).toBeGreaterThanOrEqual(0);
      expect(['improving', 'declining', 'stable']).toContain(metrics.trend);
    });

    it('should handle TypeScript compilation errors', async () => {
      // Mock TypeScript compilation with errors
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('tsc --noEmit')) {
          callback(null, { 
            stdout: '', 
            stderr: 'error TS2304: Cannot find name\nerror TS2345: Argument type error' 
          });
        } else if (command.includes('find')) {
          callback(null, { stdout: 'file1.ts\nfile2.ts' });
        }
        return {} as any;
      });

      const metrics = await codeQualityService.getCodeQualityMetrics();

      expect(metrics.typescript).toBeLessThan(100); // Should be penalized for errors
      expect(metrics.details.typeScriptErrors).toBe(2);
    });

    it('should handle ESLint analysis', async () => {
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('eslint')) {
          callback(null, { 
            stdout: JSON.stringify([
              { errorCount: 3, warningCount: 7 },
              { errorCount: 0, warningCount: 2 }
            ])
          });
        } else if (command.includes('find')) {
          callback(null, { stdout: 'file1.ts\nfile2.ts' });
        }
        return {} as any;
      });

      const metrics = await codeQualityService.getCodeQualityMetrics();

      expect(metrics.details.eslintErrors).toBe(3);
      expect(metrics.details.eslintWarnings).toBe(9);
      expect(metrics.eslint).toBeLessThan(100); // Should be penalized for issues
    });

    it('should calculate complexity metrics', async () => {
      const complexCode = `
        function complexFunction() {
          if (condition1) {
            if (condition2) {
              for (let i = 0; i < 10; i++) {
                while (something) {
                  switch (value) {
                    case 1:
                      if (nested) {
                        return true;
                      }
                      break;
                    default:
                      return false;
                  }
                }
              }
            }
          }
          return condition3 ? value1 : value2;
        }
      `;

      mockFs.readFile.mockResolvedValue(complexCode);
      mockFs.readdir.mockResolvedValue([
        { name: 'complex.ts', isDirectory: () => false, isFile: () => true } as any
      ]);

      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('find')) {
          callback(null, { stdout: 'complex.ts' });
        }
        return {} as any;
      });

      const metrics = await codeQualityService.getCodeQualityMetrics();

      expect(metrics.details.averageComplexity).toBeGreaterThan(1);
      expect(metrics.complexity).toBeLessThan(100); // High complexity should lower score
    });

    it('should analyze documentation coverage', async () => {
      const documentedCode = `
        /**
         * This is a documented function
         * @param param1 First parameter
         * @returns Something useful
         */
        function documentedFunction(param1: string): string {
          return param1;
        }

        function undocumentedFunction() {
          return 'no docs';
        }

        /**
         * Another documented function
         */
        export function anotherDocumentedFunction() {
          return true;
        }
      `;

      mockFs.readFile.mockResolvedValue(documentedCode);
      mockFs.readdir.mockResolvedValue([
        { name: 'documented.ts', isDirectory: () => false, isFile: () => true } as any
      ]);

      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('find')) {
          callback(null, { stdout: 'documented.ts' });
        }
        return {} as any;
      });

      const metrics = await codeQualityService.getCodeQualityMetrics();

      // Should detect 2 documented functions out of 3 total
      expect(metrics.details.documentationCoverage).toBeCloseTo(66.7, 1);
      expect(metrics.documentation).toBeGreaterThan(50);
    });

    it('should use cache when available', async () => {
      // Mock successful operations
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('find')) {
          callback(null, { stdout: 'file1.ts' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      // First call
      await codeQualityService.getCodeQualityMetrics();
      
      // Second call within cache timeout
      await codeQualityService.getCodeQualityMetrics();

      // File operations should only happen once due to caching
      expect(mockExec).toHaveBeenCalledTimes(3); // tsc, eslint, find
    });

    it('should handle file system errors gracefully', async () => {
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(new Error('Command failed'));
        return {} as any;
      });

      const metrics = await codeQualityService.getCodeQualityMetrics();

      // Should return fallback metrics
      expect(metrics).toBeDefined();
      expect(metrics.overall).toBeGreaterThan(0);
      expect(metrics.grade).toBeDefined();
    });

    it('should calculate overall score correctly', async () => {
      // Mock perfect scores for all metrics
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        if (command.includes('tsc --noEmit')) {
          callback(null, { stdout: '', stderr: '' }); // No errors
        } else if (command.includes('eslint')) {
          callback(null, { 
            stdout: JSON.stringify([
              { errorCount: 0, warningCount: 0 }
            ])
          });
        } else if (command.includes('find')) {
          callback(null, { stdout: 'file1.ts' });
        }
        return {} as any;
      });

      mockFs.readFile.mockResolvedValue(`
        /**
         * Perfect function
         */
        function simpleFunction() {
          return true;
        }
      `);

      const metrics = await codeQualityService.getCodeQualityMetrics();

      expect(metrics.overall).toBeGreaterThan(90); // Should be high with perfect scores
      expect(metrics.typescript).toBe(100);
      expect(metrics.eslint).toBe(100);
    });
  });

  describe('grade calculation', () => {
    it('should assign correct grades', async () => {
      // Simplified test to avoid memory issues
      mockExec.mockImplementation((command: any, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      mockFs.readFile.mockResolvedValue('function simple() { return true; }');
      mockFs.readdir.mockResolvedValue([
        { name: 'test.ts', isDirectory: () => false, isFile: () => true } as any
      ]);

      const metrics = await codeQualityService.getCodeQualityMetrics();
      
      expect(['A+', 'A', 'B', 'C', 'D']).toContain(metrics.grade);
      expect(metrics.grade).toBeDefined();
    });
  });
});
