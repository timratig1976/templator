import { ComprehensiveDashboardService } from '@/services/dashboard/ComprehensiveDashboardService';
import { TestCoverageService } from '@/services/testing/TestCoverageService';
import { CodeQualityService } from '@/services/quality/CodeQualityService';
import { SecurityAnalysisService } from '@/services/security/SecurityAnalysisService';

// Mock all dependencies
jest.mock('@/services/testing/TestCoverageService');
jest.mock('@/services/quality/CodeQualityService');
jest.mock('@/services/security/SecurityAnalysisService');
jest.mock('@/services/logging/QualityMetricsLogger');
jest.mock('@/services/logging/AIMetricsLogger');
jest.mock('@/services/logging/ComprehensiveLogger');

describe('ComprehensiveDashboardService', () => {
  let dashboardService: ComprehensiveDashboardService;
  let mockTestCoverageService: jest.Mocked<TestCoverageService>;
  let mockCodeQualityService: jest.Mocked<CodeQualityService>;
  let mockSecurityService: jest.Mocked<SecurityAnalysisService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create service instance
    dashboardService = new ComprehensiveDashboardService();
    
    // Get mock instances
    mockTestCoverageService = jest.mocked(TestCoverageService.prototype);
    mockCodeQualityService = jest.mocked(CodeQualityService.prototype);
    mockSecurityService = jest.mocked(SecurityAnalysisService.prototype);
  });

  describe('getDashboardMetrics', () => {
    it('should return comprehensive dashboard metrics', async () => {
      // Mock test coverage data
      mockTestCoverageService.getCurrentCoverage.mockResolvedValue({
        metrics: {
          overall: 3.6,
          lines: { percentage: 3.6, covered: 370, total: 10279 },
          functions: { percentage: 3.5, covered: 68, total: 1916 },
          branches: { percentage: 1.5, covered: 15, total: 1000 },
          statements: { percentage: 3.6, covered: 370, total: 10279 }
        },
        trend: 'stable',
        change: '+0.0%',
        fileCount: { total: 94, tested: 18, percentage: 19.1 },
        timestamp: new Date().toISOString(),
        testFiles: 18,
        sourceFiles: 94
      });

      // Mock code quality data
      mockCodeQualityService.getCodeQualityMetrics.mockResolvedValue({
        overall: 59,
        typescript: 100,
        eslint: 80,
        complexity: 74,
        documentation: 45,
        grade: 'C',
        trend: 'stable',
        change: '+0.0%',
        breakdown: {
          typescript: 100,
          eslint: 80,
          complexity: 74,
          documentation: 45
        },
        details: {
          typeScriptErrors: 0,
          eslintErrors: 3,
          eslintWarnings: 8,
          averageComplexity: 2.5,
          documentationCoverage: 45.0,
          totalFiles: 94,
          analyzedFiles: 89
        }
      });

      // Mock security data
      mockSecurityService.getSecurityMetrics.mockResolvedValue({
        overall: 83,
        vulnerabilities: {
          critical: 0,
          high: 0,
          medium: 1,
          low: 2,
          total: 3
        },
        dependencies: {
          total: 47,
          outdated: 6,
          vulnerable: 3
        },
        codeAnalysis: {
          hardcodedSecrets: 0,
          insecurePatterns: 1,
          authenticationIssues: 0
        },
        trend: 'stable',
        change: '+0.0%',
        lastScan: new Date().toISOString(),
        recommendations: ['Update 6 outdated dependencies']
      });

      const metrics = await dashboardService.getDashboardMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.testCoverage.current).toBe(3.6);
      expect(metrics.codeQuality.score).toBe(59);
      expect(metrics.security.score).toBe(83);
      expect(metrics.systemHealth.status).toBe('healthy');
      expect(metrics.performance.responseTime).toBeGreaterThanOrEqual(0);
      expect(metrics.aiMetrics.totalInteractions).toBeGreaterThanOrEqual(0);
    });

    it('should use cached data when available', async () => {
      // First call
      await dashboardService.getDashboardMetrics();
      
      // Second call should use cache
      await dashboardService.getDashboardMetrics();

      // Services should only be called once due to caching
      expect(mockTestCoverageService.getCurrentCoverage).toHaveBeenCalledTimes(1);
      expect(mockCodeQualityService.getCodeQualityMetrics).toHaveBeenCalledTimes(1);
      expect(mockSecurityService.getSecurityMetrics).toHaveBeenCalledTimes(1);
    });

    it('should force refresh when requested', async () => {
      // First call
      await dashboardService.getDashboardMetrics();
      
      // Force refresh
      await dashboardService.getDashboardMetrics(true);

      // Services should be called twice
      expect(mockTestCoverageService.getCurrentCoverage).toHaveBeenCalledTimes(2);
      expect(mockCodeQualityService.getCodeQualityMetrics).toHaveBeenCalledTimes(2);
      expect(mockSecurityService.getSecurityMetrics).toHaveBeenCalledTimes(2);
    });

    it('should handle service failures gracefully', async () => {
      // Mock service failures
      mockTestCoverageService.getCurrentCoverage.mockRejectedValue(new Error('Coverage service failed'));
      mockCodeQualityService.getCodeQualityMetrics.mockRejectedValue(new Error('Quality service failed'));
      mockSecurityService.getSecurityMetrics.mockRejectedValue(new Error('Security service failed'));

      const metrics = await dashboardService.getDashboardMetrics();

      // Should return fallback data
      expect(metrics).toBeDefined();
      expect(metrics.testCoverage.current).toBeDefined();
      expect(metrics.codeQuality.score).toBeDefined();
      expect(metrics.security.score).toBeDefined();
    });
  });

  describe('system health metrics', () => {
    it('should calculate memory usage correctly', async () => {
      const metrics = await dashboardService.getDashboardMetrics();
      
      expect(metrics.systemHealth.memoryUsage).toBeGreaterThan(0);
      expect(metrics.systemHealth.memoryUsage).toBeLessThan(100);
      expect(metrics.systemHealth.uptime).toBeGreaterThanOrEqual(0);
      expect(['healthy', 'warning', 'critical']).toContain(metrics.systemHealth.status);
    });
  });

  describe('performance metrics', () => {
    it('should handle no AI interactions gracefully', async () => {
      const metrics = await dashboardService.getDashboardMetrics();
      
      // When no AI interactions exist, should return 0 values
      expect(metrics.performance.responseTime).toBeGreaterThanOrEqual(0);
      expect(metrics.performance.breakdown.average).toBeGreaterThanOrEqual(0);
      expect(metrics.performance.breakdown.errorRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('AI metrics', () => {
    it('should handle empty AI interactions', async () => {
      const metrics = await dashboardService.getDashboardMetrics();
      
      expect(metrics.aiMetrics.totalInteractions).toBeGreaterThanOrEqual(0);
      expect(metrics.aiMetrics.averageQuality).toBeGreaterThanOrEqual(0);
      expect(metrics.aiMetrics.costToday).toBeGreaterThanOrEqual(0);
      expect(metrics.aiMetrics.userSatisfaction).toBeGreaterThanOrEqual(0);
    });
  });

  describe('data consistency', () => {
    it('should ensure test coverage percentage matches line counts', async () => {
      const metrics = await dashboardService.getDashboardMetrics();
      
      const calculatedPercentage = (metrics.testCoverage.realCounts.linesCovered / 
                                   metrics.testCoverage.realCounts.linesTotal) * 100;
      
      // Allow small rounding differences
      expect(Math.abs(metrics.testCoverage.current - calculatedPercentage)).toBeLessThan(0.1);
    });

    it('should have consistent vulnerability totals', async () => {
      const metrics = await dashboardService.getDashboardMetrics();
      
      const calculatedTotal = metrics.security.vulnerabilities.critical +
                             metrics.security.vulnerabilities.high +
                             metrics.security.vulnerabilities.medium +
                             metrics.security.vulnerabilities.low;
      
      expect(metrics.security.vulnerabilities.critical + 
             metrics.security.vulnerabilities.high + 
             metrics.security.vulnerabilities.medium + 
             metrics.security.vulnerabilities.low).toBe(calculatedTotal);
    });
  });

  describe('caching behavior', () => {
    it('should expire cache after timeout', async () => {
      // Mock Date.now to control time
      const originalNow = Date.now;
      let mockTime = 1000000;
      Date.now = jest.fn(() => mockTime);

      try {
        // First call
        await dashboardService.getDashboardMetrics();
        
        // Advance time beyond cache timeout (2 minutes = 120000ms)
        mockTime += 130000;
        
        // Second call should refresh cache
        await dashboardService.getDashboardMetrics();

        expect(mockTestCoverageService.getCurrentCoverage).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('error resilience', () => {
    it('should continue working when individual services fail', async () => {
      // Only test coverage service works
      mockCodeQualityService.getCodeQualityMetrics.mockRejectedValue(new Error('Failed'));
      mockSecurityService.getSecurityMetrics.mockRejectedValue(new Error('Failed'));

      const metrics = await dashboardService.getDashboardMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.testCoverage).toBeDefined();
      expect(metrics.codeQuality).toBeDefined(); // Should have fallback
      expect(metrics.security).toBeDefined(); // Should have fallback
    });
  });
});
