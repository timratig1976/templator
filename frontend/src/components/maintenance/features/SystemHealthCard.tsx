/**
 * System Health Card Component
 * Displays system health metrics and status information
 */

import React from 'react';
import { SystemHealth } from '../hooks/useMaintenanceData';
import { getStatusColor, getStatusBgColor } from '../utils/colorUtils';
import Tooltip from '../ui/Tooltip';

export interface SystemHealthCardProps {
  systemHealth: SystemHealth | null;
  onRawDataClick: (endpoint: string, title: string) => void;
  showTooltip?: string | null;
  onTooltipChange?: (id: string | null) => void;
}

export const SystemHealthCard: React.FC<SystemHealthCardProps> = ({
  systemHealth,
  onRawDataClick,
  showTooltip,
  onTooltipChange
}) => {
  const formatUptime = (uptime: number): string => {
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes: number): string => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (!systemHealth) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">🏥 System Health</h3>
          <button
            onClick={() => onRawDataClick('/api/monitoring/system/health', 'System Health Raw Data')}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            View Raw Data
          </button>
        </div>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Status</span>
            <Tooltip
              id="system-status"
              title="System Status"
              description="Overall health status of the backend system including all services and dependencies"
              measurement="Real-time status monitoring with automatic health checks"
              showTooltip={showTooltip}
              onTooltipChange={onTooltipChange}
            >
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBgColor(systemHealth.status)} ${getStatusColor(systemHealth.status)}`}>
                {systemHealth.status}
              </span>
            </Tooltip>
          </div>

          {/* Uptime */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Uptime</span>
            <Tooltip
              id="system-uptime"
              title="System Uptime"
              description="How long the system has been running continuously without restarts"
              measurement="Time since last system restart in hours and minutes"
              showTooltip={showTooltip}
              onTooltipChange={onTooltipChange}
            >
              <span className="text-sm text-gray-900">{formatUptime(systemHealth.uptime)}</span>
            </Tooltip>
          </div>

          {/* Memory Usage */}
          {typeof (systemHealth as any).memory !== 'undefined' && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Memory</span>
              <Tooltip
                id="system-memory"
                title="Memory Usage"
                description="Current memory consumption of the backend system including heap and RSS memory"
                measurement="Memory usage in megabytes (MB) with breakdown of heap, total, and RSS"
                showTooltip={showTooltip}
                onTooltipChange={onTooltipChange}
              >
                {typeof (systemHealth as any).memory === 'number' ? (
                  <div className="text-right">
                    <div className="text-sm text-gray-900">
                      {(systemHealth as any).memory}% used
                    </div>
                    <div className="text-xs text-gray-500">Aggregate memory utilization</div>
                  </div>
                ) : (
                  <div className="text-right">
                    <div className="text-sm text-gray-900">
                      {formatMemory((systemHealth as any).memory.used)} / {formatMemory((systemHealth as any).memory.total)}
                    </div>
                    <div className="text-xs text-gray-500">
                      RSS: {formatMemory((systemHealth as any).memory.rss)}
                    </div>
                  </div>
                )}
              </Tooltip>
            </div>
          )}

          {/* Environment */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Environment</span>
            <span className="text-sm text-gray-900">{systemHealth.environment}</span>
          </div>

          {/* Last Updated */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Last Updated</span>
            <span className="text-sm text-gray-900">
              {new Date(systemHealth.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthCard;
