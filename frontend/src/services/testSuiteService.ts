/**
 * Frontend service for interacting with the Comprehensive Test Suite
 * Connects to Phase 4 backend ComprehensiveTestSuite service
 */



export interface TestSuiteExecution {
  execution_id: string;
  target_id: string;
  target_type: 'component' | 'module' | 'assembly';
  test_suites: string[];
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress_percentage: number;
  started_at: string;
  completed_at?: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  execution_time_ms: number;
}

export interface TestResult {
  test_id: string;
  test_name: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  execution_time_ms: number;
  assertions_passed: number;
  assertions_failed: number;
  error_message?: string;
  performance_metrics: {
    response_time_ms: number;
    memory_usage_mb: number;
    cpu_usage_percent: number;
    network_requests: number;
    data_transferred_kb: number;
    cache_hit_ratio: number;
  };
}

export interface CoverageReport {
  overall_coverage: number;
  line_coverage: number;
  branch_coverage: number;
  function_coverage: number;
  statement_coverage: number;
  file_coverage: {
    file_path: string;
    lines_covered: number;
    lines_total: number;
    coverage_percentage: number;
    branches_covered: number;
    branches_total: number;
    functions_covered: number;
    functions_total: number;
  }[];
  uncovered_lines: {
    file_path: string;
    line_number: number;
    line_content: string;
    reason: string;
  }[];
}

export interface PerformanceReport {
  overall_score: number;
  load_time_ms: number;
  first_contentful_paint_ms: number;
  largest_contentful_paint_ms: number;
  cumulative_layout_shift: number;
  first_input_delay_ms: number;
  time_to_interactive_ms: number;
  performance_budget_violations: string[];
}

export interface QualityReport {
  overall_quality_score: number;
  code_quality_score: number;
  maintainability_score: number;
  reliability_score: number;
  security_score: number;
  accessibility_score: number;
  quality_issues: {
    issue_id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    description: string;
    location: string;
    recommendation: string;
  }[];
  recommendations: {
    recommendation_id: string;
    priority: 'low' | 'medium' | 'high';
    title: string;
    description: string;
    implementation_effort: 'low' | 'medium' | 'high';
    expected_impact: string;
  }[];
}

export interface BenchmarkResult {
  benchmark_id: string;
  target_id: string;
  benchmark_type: 'baseline' | 'load' | 'stress' | 'endurance';
  metrics: {
    response_time_ms: number;
    memory_usage_mb: number;
    cpu_usage_percent: number;
    network_requests: number;
    data_transferred_kb: number;
    cache_hit_ratio: number;
  };
  comparison_result?: {
    baseline_metrics: any;
    performance_delta: {
      response_time_change_percent: number;
      memory_usage_change_percent: number;
      cpu_usage_change_percent: number;
      throughput_change_percent: number;
      overall_performance_change: number;
    };
    regression_detected: boolean;
    improvement_detected: boolean;
  };
  executed_at: string;
}

export interface TestSuiteConfig {
  suite_id: string;
  suite_name: string;
  description: string;
  test_categories: {
    category_id: string;
    category_name: string;
    test_count: number;
    enabled: boolean;
  }[];
  quality_gates: {
    gate_id: string;
    gate_type: 'coverage' | 'performance' | 'accessibility' | 'security';
    threshold_value: number;
    comparison_operator: 'greater_than' | 'less_than' | 'equals';
    blocking: boolean;
  }[];
}

class TestSuiteService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Execute comprehensive test suite
   */
  async executeTestSuite(
    targetId: string,
    targetType: 'component' | 'module' | 'assembly',
    suiteIds?: string[]
  ): Promise<TestSuiteExecution> {
    const response = await fetch(`${this.baseUrl}/api/test-suite/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target_id: targetId,
        target_type: targetType,
        suite_ids: suiteIds,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute test suite: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get test execution status
   */
  async getExecutionStatus(executionId: string): Promise<TestSuiteExecution> {
    const response = await fetch(`${this.baseUrl}/api/test-suite/execution/${executionId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get execution status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get detailed test results
   */
  async getTestResults(executionId: string): Promise<{
    execution: TestSuiteExecution;
    test_results: TestResult[];
    coverage_report: CoverageReport;
    performance_report: PerformanceReport;
    quality_report: QualityReport;
  }> {
    const response = await fetch(`${this.baseUrl}/api/test-suite/execution/${executionId}/results`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get test results: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Run performance benchmark
   */
  async runBenchmark(
    targetId: string,
    targetType: 'component' | 'module' | 'assembly',
    benchmarkType: 'baseline' | 'load' | 'stress' | 'endurance'
  ): Promise<BenchmarkResult> {
    const response = await fetch(`${this.baseUrl}/api/test-suite/benchmark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target_id: targetId,
        target_type: targetType,
        benchmark_type: benchmarkType,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to run benchmark: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate AI-powered test cases
   */
  async generateAITestCases(
    targetId: string,
    targetType: 'component' | 'module' | 'assembly',
    testTypes: string[]
  ): Promise<{
    generated_test_cases: {
      test_id: string;
      test_name: string;
      description: string;
      test_type: string;
      estimated_duration_ms: number;
    }[];
    generation_log: string[];
    confidence_score: number;
  }> {
    const response = await fetch(`${this.baseUrl}/api/test-suite/generate-tests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target_id: targetId,
        target_type: targetType,
        test_types: testTypes,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate AI test cases: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get coverage analysis
   */
  async getCoverageAnalysis(targetId: string, targetType: string): Promise<{
    coverage_report: CoverageReport;
    coverage_gaps: string[];
    recommendations: string[];
    improvement_suggestions: {
      priority: 'low' | 'medium' | 'high';
      description: string;
      estimated_effort: 'low' | 'medium' | 'high';
    }[];
  }> {
    const response = await fetch(`${this.baseUrl}/api/test-suite/coverage/${targetId}?type=${targetType}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get coverage analysis: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get available test suites
   */
  async getTestSuites(): Promise<TestSuiteConfig[]> {
    const response = await fetch(`${this.baseUrl}/api/test-suite/suites`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get test suites: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get test execution history
   */
  async getExecutionHistory(filters?: {
    target_id?: string;
    target_type?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<{
    executions: TestSuiteExecution[];
    total_count: number;
    success_rate: number;
    average_execution_time_ms: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.target_id) params.append('target_id', filters.target_id);
    if (filters?.target_type) params.append('target_type', filters.target_type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);

    const response = await fetch(`${this.baseUrl}/api/test-suite/history?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get execution history: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cancel test execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/test-suite/execution/${executionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel execution: ${response.statusText}`);
    }
  }

  /**
   * Get quality gate status
   */
  async getQualityGateStatus(executionId: string): Promise<{
    all_gates_passed: boolean;
    gate_results: {
      gate_id: string;
      gate_type: string;
      threshold_value: number;
      actual_value: number;
      passed: boolean;
      blocking: boolean;
    }[];
    overall_quality_score: number;
  }> {
    const response = await fetch(`${this.baseUrl}/api/test-suite/execution/${executionId}/quality-gates`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get quality gate status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get test analytics
   */
  async getTestAnalytics(timeframe: 'week' | 'month' | 'quarter'): Promise<{
    total_executions: number;
    success_rate: number;
    average_execution_time_ms: number;
    coverage_trends: any[];
    performance_trends: any[];
    quality_trends: any[];
    most_common_failures: any[];
  }> {
    const response = await fetch(`${this.baseUrl}/api/test-suite/analytics?timeframe=${timeframe}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get test analytics: ${response.statusText}`);
    }

    return response.json();
  }
}

export const testSuiteService = new TestSuiteService();
export default testSuiteService;
