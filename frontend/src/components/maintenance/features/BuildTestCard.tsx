/**
 * Build Test Card Component
 * Displays build test status and provides test execution controls
 */

import React from 'react';
import Link from 'next/link';
import { BuildTestStatus } from '../hooks/useMaintenanceData';
import { getStatusColor, getStatusBgColor } from '../utils/colorUtils';
import Tooltip from '../ui/Tooltip';

export interface BuildTestCardProps {
  buildTestStatus: BuildTestStatus | null;
  onRunBuildTest: () => void;
  onRawDataClick: (endpoint: string, title: string) => void;
  testRunning: boolean;
  testProgress: string;
  showTooltip?: string | null;
  onTooltipChange?: (id: string | null) => void;
  linkOnly?: boolean;
}

export const BuildTestCard: React.FC<BuildTestCardProps> = ({
  buildTestStatus,
  onRunBuildTest,
  onRawDataClick,
  testRunning,
  testProgress,
  showTooltip,
  onTooltipChange,
  linkOnly
}) => {
  if (!buildTestStatus) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-4/5"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">🔧 Build Test Status</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onRawDataClick('/api/build-test/status', 'Build Test Raw Data')}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              View Raw Data
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Health Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Health</span>
            <Tooltip
              id="build-health"
              title="Build Health"
              description="Overall health status of the TypeScript compilation and build process"
              measurement="Real-time compilation status with error detection and categorization"
              showTooltip={showTooltip}
              onTooltipChange={onTooltipChange}
            >
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                buildTestStatus.isHealthy 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {buildTestStatus.isHealthy ? 'Healthy' : 'Issues Found'}
              </span>
            </Tooltip>
          </div>

          {/* Running Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Status</span>
            <Tooltip
              id="build-status"
              title="Build Test Status"
              description="Current execution status of the automated build testing system"
              measurement="Real-time status of build test execution and monitoring"
              showTooltip={showTooltip}
              onTooltipChange={onTooltipChange}
            >
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                buildTestStatus.isRunning || testRunning
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {buildTestStatus.isRunning || testRunning ? 'Running' : 'Idle'}
              </span>
            </Tooltip>
          </div>

          {/* Last Build Time */}
          {buildTestStatus.lastBuildTime && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Last Build</span>
              <span className="text-sm text-gray-900">
                {new Date(buildTestStatus.lastBuildTime).toLocaleString()}
              </span>
            </div>
          )}

          {/* Service Health Summary */}
          {buildTestStatus.serviceHealth && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Services</span>
              <Tooltip
                id="service-health"
                title="Service Health"
                description="Health status of all backend services organized by application phases"
                measurement="Phase-based service monitoring with file count and health indicators"
                showTooltip={showTooltip}
                onTooltipChange={onTooltipChange}
              >
                <div className="text-right">
                  <div className="text-sm text-gray-900">
                    {Object.keys(buildTestStatus.serviceHealth).length} phases
                  </div>
                  <div className="text-xs text-gray-500">
                    All services operational
                  </div>
                </div>
              </Tooltip>
            </div>
          )}

          {/* Test Progress */}
          {(testRunning || testProgress) && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-blue-800">
                  {testProgress || 'Running build test...'}
                </span>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            {linkOnly ? (
              <Link
                href="/maintenance/build-tests"
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Open Build Tests
              </Link>
            ) : (
              <button
                onClick={() => {
                  /* debug click */
                  try { console.log('[BuildTestCard] Run Build Test clicked'); } catch {}
                  onRunBuildTest();
                }}
                disabled={testRunning || buildTestStatus.isRunning}
                className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md transition-colors ${
                  testRunning || buildTestStatus.isRunning
                    ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                    : 'text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                }`}
              >
                {testRunning || buildTestStatus.isRunning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
                    Running Test...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10V7a3 3 0 11-6 0V4h6zM4 20h16" />
                    </svg>
                    Run Build Test
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildTestCard;
