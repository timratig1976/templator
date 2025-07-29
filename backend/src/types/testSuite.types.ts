/**
 * Comprehensive Test Suite Type Definitions
 * 
 * This file contains all type definitions and interfaces for the test suite system.
 * Extracted from ComprehensiveTestSuite.ts for better maintainability and reusability.
 * 
 * @author Templator Team
 * @version 1.0.0
 */

// ============================================================================
// CORE TEST SUITE CONFIGURATION TYPES
// ============================================================================

export interface TestSuiteConfiguration {
  suite_id: string;
  suite_name: string;
  description: string;
  test_categories: TestCategory[];
  execution_mode: 'sequential' | 'parallel' | 'hybrid';
  timeout_seconds: number;
  retry_attempts: number;
  coverage_requirements: CoverageRequirements;
  performance_thresholds: PerformanceThresholds;
  quality_gates: QualityGate[];
}

export interface TestCategory {
  category_id: string;
  category_name: string;
  category_type: 'unit' | 'integration' | 'e2e' | 'performance' | 'accessibility' | 'security' | 'regression';
  priority: 'critical' | 'high' | 'medium' | 'low';
  test_cases: TestCase[];
  setup_requirements: string[];
  teardown_requirements: string[];
}

// ============================================================================
// TEST CASE AND EXECUTION TYPES
// ============================================================================

export interface TestCase {
  test_id: string;
  test_name: string;
  description: string;
  test_type: string;
  target_component?: string;
  target_module?: string;
  preconditions: string[];
  test_steps: TestStep[];
  expected_results: ExpectedResult[];
  assertions: TestAssertion[];
  tags: string[];
  estimated_duration_ms: number;
}

export interface TestStep {
  step_id: string;
  step_description: string;
  action_type: 'setup' | 'execute' | 'verify' | 'cleanup';
  action_details: ActionDetails;
  expected_outcome: string;
  failure_handling: 'continue' | 'abort' | 'retry';
}

export interface ActionDetails {
  action_name: string;
  parameters: { [key: string]: any };
  target_element?: string;
  input_data?: any;
  validation_rules?: ValidationRule[];
}

// ============================================================================
// VALIDATION AND ASSERTION TYPES
// ============================================================================

export interface ValidationRule {
  rule_type: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
  expected_value: any;
  tolerance?: number;
  error_message: string;
}

export interface TestAssertion {
  assertion_id: string;
  assertion_type: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'matches_pattern';
  target_value: any;
  expected_value: any;
  tolerance?: number;
  custom_validator?: string;
}

export interface ExpectedResult {
  result_type: 'output' | 'state_change' | 'performance_metric' | 'error_condition';
  description: string;
  success_criteria: SuccessCriteria;
  failure_criteria: FailureCriteria;
}

export interface SuccessCriteria {
  conditions: string[];
  metrics?: { [key: string]: number };
  output_format?: string;
  state_requirements?: string[];
}

export interface FailureCriteria {
  error_conditions: string[];
  timeout_conditions: string[];
  performance_violations: string[];
  quality_violations: string[];
}

// ============================================================================
// REQUIREMENTS AND THRESHOLDS TYPES
// ============================================================================

export interface CoverageRequirements {
  code_coverage_threshold: number;
  branch_coverage_threshold: number;
  function_coverage_threshold: number;
  line_coverage_threshold: number;
  component_coverage_threshold: number;
  integration_coverage_threshold: number;
}

export interface PerformanceThresholds {
  max_execution_time_ms: number;
  max_memory_usage_mb: number;
  max_cpu_usage_percent: number;
  max_network_requests: number;
  max_response_time_ms: number;
  min_throughput_rps: number;
}

export interface QualityGate {
  gate_id: string;
  gate_name: string;
  gate_type: 'coverage' | 'performance' | 'security' | 'accessibility' | 'reliability';
  threshold_value: number;
  comparison_operator: 'greater_than' | 'less_than' | 'equals' | 'greater_equal' | 'less_equal';
  blocking: boolean;
  warning_threshold?: number;
}

// ============================================================================
// TEST EXECUTION AND RESULTS TYPES
// ============================================================================

export interface TestExecution {
  execution_id: string;
  suite_id: string;
  started_at: Date;
  completed_at?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  execution_time_ms: number;
  test_results: TestResult[];
  coverage_report: CoverageReport;
  performance_report: PerformanceReport;
  quality_report: QualityReport;
}

export interface TestResult {
  test_id: string;
  test_name: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  execution_time_ms: number;
  error_message?: string;
  stack_trace?: string;
  assertions_passed: number;
  assertions_failed: number;
  step_results: StepResult[];
  performance_metrics: PerformanceMetrics;
}

export interface StepResult {
  step_id: string;
  status: 'passed' | 'failed' | 'skipped';
  execution_time_ms: number;
  output: any;
  error_details?: string;
  screenshots?: string[];
  logs?: string[];
}

// ============================================================================
// PERFORMANCE METRICS AND REPORTING TYPES
// ============================================================================

export interface PerformanceMetrics {
  response_time_ms: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
  network_requests: number;
  data_transferred_kb: number;
  cache_hit_ratio: number;
}

export interface PerformanceReport {
  overall_score: number;
  load_time_ms: number;
  first_contentful_paint_ms: number;
  largest_contentful_paint_ms: number;
  cumulative_layout_shift: number;
  first_input_delay_ms: number;
  time_to_interactive_ms: number;
  performance_budget_violations: BudgetViolation[];
}

export interface BudgetViolation {
  metric_name: string;
  actual_value: number;
  budget_value: number;
  violation_percentage: number;
  severity: 'warning' | 'error';
}

export interface PerformanceDelta {
  response_time_change_percent: number;
  memory_usage_change_percent: number;
  cpu_usage_change_percent: number;
  throughput_change_percent: number;
  overall_performance_change: number;
}

// ============================================================================
// COVERAGE REPORTING TYPES
// ============================================================================

export interface CoverageReport {
  overall_coverage: number;
  line_coverage: number;
  branch_coverage: number;
  function_coverage: number;
  statement_coverage: number;
  file_coverage: FileCoverage[];
  uncovered_lines: UncoveredLine[];
}

export interface FileCoverage {
  file_path: string;
  lines_covered: number;
  lines_total: number;
  coverage_percentage: number;
  branches_covered: number;
  branches_total: number;
  functions_covered: number;
  functions_total: number;
}

export interface UncoveredLine {
  file_path: string;
  line_number: number;
  line_content: string;
  reason: string;
}

// ============================================================================
// QUALITY REPORTING TYPES
// ============================================================================

export interface QualityReport {
  overall_quality_score: number;
  code_quality_score: number;
  maintainability_score: number;
  reliability_score: number;
  security_score: number;
  accessibility_score: number;
  quality_issues: QualityIssue[];
  recommendations: QualityRecommendation[];
}

export interface QualityIssue {
  issue_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  description: string;
  file_path: string;
  line_number?: number;
  rule_violated: string;
  suggested_fix: string;
}

export interface QualityRecommendation {
  recommendation_id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  implementation_effort: 'low' | 'medium' | 'high';
  expected_impact: string;
}

// ============================================================================
// BENCHMARK TYPES
// ============================================================================

export interface BenchmarkResult {
  benchmark_id: string;
  benchmark_name: string;
  executed_at: Date;
  baseline_metrics: PerformanceMetrics;
  current_metrics: PerformanceMetrics;
  performance_delta: PerformanceDelta;
  regression_detected: boolean;
  improvement_detected: boolean;
  benchmark_status: 'passed' | 'failed' | 'warning';
}

// ============================================================================
// UTILITY TYPES AND ENUMS
// ============================================================================

export type TestCategoryType = 'unit' | 'integration' | 'e2e' | 'performance' | 'accessibility' | 'security' | 'regression';
export type TestPriority = 'critical' | 'high' | 'medium' | 'low';
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'error';
export type ExecutionMode = 'sequential' | 'parallel' | 'hybrid';
export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
export type ActionType = 'setup' | 'execute' | 'verify' | 'cleanup';
export type FailureHandling = 'continue' | 'abort' | 'retry';
export type ComparisonOperator = 'greater_than' | 'less_than' | 'equals' | 'greater_equal' | 'less_equal';
export type QualityGateType = 'coverage' | 'performance' | 'security' | 'accessibility' | 'reliability';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Priority = 'high' | 'medium' | 'low';
export type ImplementationEffort = 'low' | 'medium' | 'high';
export type BenchmarkStatus = 'passed' | 'failed' | 'warning';

// ============================================================================
// EXECUTION OPTIONS AND CONFIGURATION TYPES
// ============================================================================

export interface TestExecutionOptions {
  parallel?: boolean;
  categories?: string[];
  timeout_override?: number;
  retry_override?: number;
  coverage_enabled?: boolean;
  performance_monitoring?: boolean;
  quality_gates_enabled?: boolean;
  benchmark_mode?: boolean;
  dry_run?: boolean;
}

export interface TestSuiteOptions {
  include_categories?: TestCategoryType[];
  exclude_categories?: TestCategoryType[];
  priority_filter?: TestPriority[];
  tag_filter?: string[];
  target_coverage?: number;
  max_execution_time?: number;
}

// ============================================================================
// FACTORY AND BUILDER TYPES
// ============================================================================

export interface TestCaseBuilder {
  withId(id: string): TestCaseBuilder;
  withName(name: string): TestCaseBuilder;
  withDescription(description: string): TestCaseBuilder;
  withType(type: string): TestCaseBuilder;
  withTarget(component?: string, module?: string): TestCaseBuilder;
  withPreconditions(conditions: string[]): TestCaseBuilder;
  withSteps(steps: TestStep[]): TestCaseBuilder;
  withExpectedResults(results: ExpectedResult[]): TestCaseBuilder;
  withAssertions(assertions: TestAssertion[]): TestCaseBuilder;
  withTags(tags: string[]): TestCaseBuilder;
  withEstimatedDuration(duration: number): TestCaseBuilder;
  build(): TestCase;
}

export interface TestSuiteBuilder {
  withId(id: string): TestSuiteBuilder;
  withName(name: string): TestSuiteBuilder;
  withDescription(description: string): TestSuiteBuilder;
  withCategories(categories: TestCategory[]): TestSuiteBuilder;
  withExecutionMode(mode: ExecutionMode): TestSuiteBuilder;
  withTimeout(seconds: number): TestSuiteBuilder;
  withRetryAttempts(attempts: number): TestSuiteBuilder;
  withCoverageRequirements(requirements: CoverageRequirements): TestSuiteBuilder;
  withPerformanceThresholds(thresholds: PerformanceThresholds): TestSuiteBuilder;
  withQualityGates(gates: QualityGate[]): TestSuiteBuilder;
  build(): TestSuiteConfiguration;
}
