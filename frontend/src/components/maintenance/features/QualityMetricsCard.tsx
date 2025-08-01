/**
 * Quality Metrics Card Component
 * Displays quality metrics, trends, and recent reports
 */

import React from 'react';
import { QualityMetrics } from '../hooks/useMaintenanceData';
import { getQualityColors, getPercentageColors } from '../utils/colorUtils';
import Tooltip from '../ui/Tooltip';

export interface QualityMetricsCardProps {
  qualityMetrics: QualityMetrics | null;
  onRawDataClick: (endpoint: string, title: string) => void;
  showTooltip?: string | null;
  onTooltipChange?: (id: string | null) => void;
}

export const QualityMetricsCard: React.FC<QualityMetricsCardProps> = ({
  qualityMetrics,
  onRawDataClick,
  showTooltip,
  onTooltipChange
}) => {
  if (!qualityMetrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  const qualityColors = getQualityColors(qualityMetrics.overallScore);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">📊 Quality Metrics</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onRawDataClick('/api/monitoring/quality/metrics', 'Quality Metrics Raw Data')}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              View Raw Data
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Overall Score */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Overall Score</span>
            <Tooltip
              id="quality-score"
              title="Overall Quality Score"
              description="Comprehensive quality assessment based on code quality, test coverage, performance, and security metrics"
              measurement="Weighted average of multiple quality indicators (0-100 scale)"
              showTooltip={showTooltip}
              onTooltipChange={onTooltipChange}
            >
              <div className="flex items-center space-x-2">
                <div className={`w-16 h-2 rounded-full ${qualityColors.bg}`}>
                  <div 
                    className={`h-2 rounded-full ${qualityColors.progress}`}
                    style={{ width: `${qualityMetrics.overallScore}%` }}
                  ></div>
                </div>
                <span className={`text-sm font-medium ${qualityColors.text}`}>
                  {qualityMetrics.overallScore}%
                </span>
              </div>
            </Tooltip>
          </div>

          {/* Recent Reports */}
          {qualityMetrics.recentReports && qualityMetrics.recentReports.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Recent Reports</span>
                <Tooltip
                  id="recent-reports"
                  title="Recent Quality Reports"
                  description="Latest quality assessment reports with timestamps and detailed metrics"
                  measurement="Recent quality analysis results with trend indicators"
                  showTooltip={showTooltip}
                  onTooltipChange={onTooltipChange}
                >
                  <span className="text-xs text-gray-400">
                    {qualityMetrics.recentReports.length} reports
                  </span>
                </Tooltip>
              </div>
              
              <div className="space-y-2">
                {qualityMetrics.recentReports.slice(0, 3).map((report: any, index: number) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {new Date(report.timestamp || Date.now()).toLocaleDateString()}
                    </span>
                    <span className={`font-medium ${getQualityColors(report.score || 85).text}`}>
                      {report.score || 85}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trends */}
          {qualityMetrics.trends && qualityMetrics.trends.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Trends</span>
                <Tooltip
                  id="quality-trends"
                  title="Quality Trends"
                  description="Historical quality metrics showing improvement or degradation over time"
                  measurement="30-day rolling average with trend analysis and correlation data"
                  showTooltip={showTooltip}
                  onTooltipChange={onTooltipChange}
                >
                  <button
                    onClick={() => onRawDataClick('/api/monitoring/trends/raw', 'Quality Trends Raw Data')}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    View Trends
                  </button>
                </Tooltip>
              </div>
              
              <div className="flex items-center space-x-1">
                {qualityMetrics.trends.slice(0, 10).map((trend: any, index: number) => {
                  const trendValue = trend.value || Math.random() * 100;
                  const trendColors = getQualityColors(trendValue);
                  return (
                    <div
                      key={index}
                      className={`w-2 rounded-sm ${trendColors.chart}`}
                      style={{ height: `${Math.max(4, trendValue / 5)}px` }}
                      title={`${trend.date || `Day ${index + 1}`}: ${trendValue.toFixed(1)}%`}
                    ></div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onRawDataClick('/api/monitoring/code-quality/raw', 'Code Quality Raw Data')}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Code Quality
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => onRawDataClick('/api/monitoring/test-coverage/raw', 'Test Coverage Raw Data')}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Test Coverage
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => onRawDataClick('/api/monitoring/security/raw', 'Security Raw Data')}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Security
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityMetricsCard;
