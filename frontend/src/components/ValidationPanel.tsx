'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, RefreshCw, Zap, Eye, Settings } from 'lucide-react';

export interface ValidationIssue {
  rule_id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file_path?: string;
  line_number?: number;
  suggestion?: string;
  auto_fixable: boolean;
  context?: any;
}

export interface ValidationReport {
  is_valid: boolean;
  total_issues: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  performance_score: number;
  security_score: number;
  hubspot_compliance_score: number;
  validation_time_ms: number;
  summary: {
    critical_issues: number;
    fixable_issues: number;
    performance_issues: number;
    security_issues: number;
  };
}

export interface ValidationOptions {
  level: 'basic' | 'strict' | 'comprehensive';
  include_performance: boolean;
  include_security: boolean;
  include_accessibility: boolean;
  auto_fix_enabled: boolean;
}

interface ValidationPanelProps {
  moduleFiles?: Record<string, string>;
  onValidationComplete?: (report: ValidationReport) => void;
  onAutoFix?: (fixedFiles: Record<string, string>) => void;
  className?: string;
}

export default function ValidationPanel({
  moduleFiles,
  onValidationComplete,
  onAutoFix,
  className = ''
}: ValidationPanelProps) {
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [validationOptions, setValidationOptions] = useState<ValidationOptions>({
    level: 'strict',
    include_performance: true,
    include_security: true,
    include_accessibility: true,
    auto_fix_enabled: false
  });
  const [loading, setLoading] = useState(false);
  const [autoFixing, setAutoFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const validateModule = async () => {
    if (!moduleFiles) {
      setError('No module files available for validation');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/export/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          module_files: moduleFiles,
          validation_options: validationOptions
        }),
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`);
      }

      const result = await response.json();
      const report = result.validation_report;
      
      setValidationReport(report);
      
      if (onValidationComplete) {
        onValidationComplete(report);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const autoFixIssues = async () => {
    if (!validationReport || !moduleFiles) return;

    const fixableIssues = [
      ...validationReport.errors,
      ...validationReport.warnings,
      ...validationReport.info
    ].filter(issue => issue.auto_fixable);

    if (fixableIssues.length === 0) {
      setError('No auto-fixable issues found');
      return;
    }

    setAutoFixing(true);
    setError(null);

    try {
      const response = await fetch('/api/export/validate/fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          module_files: moduleFiles,
          issues: fixableIssues
        }),
      });

      if (!response.ok) {
        throw new Error(`Auto-fix failed: ${response.statusText}`);
      }

      const result = await response.json();
      const { fixed_files, fixed_issues } = result.fix_result;

      if (onAutoFix) {
        onAutoFix(fixed_files);
      }

      // Re-validate after auto-fix
      setTimeout(() => {
        validateModule();
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-fix failed');
    } finally {
      setAutoFixing(false);
    }
  };

  const getIssueIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'info': return <Info className="w-4 h-4 text-blue-600" />;
      default: return <Info className="w-4 h-4 text-gray-600" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 70) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  useEffect(() => {
    if (moduleFiles && Object.keys(moduleFiles).length > 0) {
      validateModule();
    }
  }, [moduleFiles]);

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Module Validation</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              title="Validation Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={validateModule}
              disabled={loading || !moduleFiles}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Validate</span>
            </button>
          </div>
        </div>

        {/* Validation Options */}
        {showDetails && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Validation Options</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Validation Level</label>
                <select
                  value={validationOptions.level}
                  onChange={(e) => setValidationOptions(prev => ({ ...prev, level: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="basic">Basic</option>
                  <option value="strict">Strict</option>
                  <option value="comprehensive">Comprehensive</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={validationOptions.include_performance}
                    onChange={(e) => setValidationOptions(prev => ({ ...prev, include_performance: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Performance checks</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={validationOptions.include_security}
                    onChange={(e) => setValidationOptions(prev => ({ ...prev, include_security: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Security checks</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={validationOptions.include_accessibility}
                    onChange={(e) => setValidationOptions(prev => ({ ...prev, include_accessibility: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Accessibility checks</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Validation Report */}
        {validationReport && (
          <div className="space-y-6">
            {/* Overall Status */}
            <div className={`p-4 rounded-lg border ${
              validationReport.is_valid 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center space-x-3">
                {validationReport.is_valid ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
                <div>
                  <div className={`font-medium ${
                    validationReport.is_valid ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {validationReport.is_valid ? 'Module is valid' : 'Module has validation issues'}
                  </div>
                  <div className={`text-sm ${
                    validationReport.is_valid ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {validationReport.total_issues} issues found in {validationReport.validation_time_ms}ms
                  </div>
                </div>
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg ${getScoreBackground(validationReport.performance_score)}`}>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getScoreColor(validationReport.performance_score)}`}>
                    {validationReport.performance_score}
                  </div>
                  <div className="text-sm text-gray-600">Performance Score</div>
                </div>
              </div>
              <div className={`p-4 rounded-lg ${getScoreBackground(validationReport.security_score)}`}>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getScoreColor(validationReport.security_score)}`}>
                    {validationReport.security_score}
                  </div>
                  <div className="text-sm text-gray-600">Security Score</div>
                </div>
              </div>
              <div className={`p-4 rounded-lg ${getScoreBackground(validationReport.hubspot_compliance_score)}`}>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getScoreColor(validationReport.hubspot_compliance_score)}`}>
                    {validationReport.hubspot_compliance_score}
                  </div>
                  <div className="text-sm text-gray-600">HubSpot Compliance</div>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-red-600">{validationReport.summary.critical_issues}</div>
                <div className="text-xs text-gray-600">Critical Issues</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{validationReport.summary.fixable_issues}</div>
                <div className="text-xs text-gray-600">Auto-fixable</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-yellow-600">{validationReport.summary.performance_issues}</div>
                <div className="text-xs text-gray-600">Performance</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">{validationReport.summary.security_issues}</div>
                <div className="text-xs text-gray-600">Security</div>
              </div>
            </div>

            {/* Auto-fix Button */}
            {validationReport.summary.fixable_issues > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={autoFixIssues}
                  disabled={autoFixing}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {autoFixing && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <Zap className="w-4 h-4" />
                  <span>Auto-fix {validationReport.summary.fixable_issues} Issues</span>
                </button>
              </div>
            )}

            {/* Issues List */}
            {validationReport.total_issues > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Validation Issues</h4>
                <div className="space-y-3">
                  {[...validationReport.errors, ...validationReport.warnings, ...validationReport.info].map((issue, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        {getIssueIcon(issue.severity)}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{issue.message}</div>
                          {issue.file_path && (
                            <div className="text-sm text-gray-600 mt-1">
                              File: {issue.file_path}
                              {issue.line_number && ` (line ${issue.line_number})`}
                            </div>
                          )}
                          {issue.suggestion && (
                            <div className="text-sm text-blue-600 mt-2">
                              💡 {issue.suggestion}
                            </div>
                          )}
                          {issue.auto_fixable && (
                            <div className="text-xs text-green-600 mt-1 flex items-center space-x-1">
                              <Zap className="w-3 h-3" />
                              <span>Auto-fixable</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && !validationReport && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
            <div className="text-gray-600">Validating module...</div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !validationReport && !error && (
          <div className="text-center py-8">
            <Eye className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <div className="text-gray-600">No module files to validate</div>
          </div>
        )}
      </div>
    </div>
  );
}
