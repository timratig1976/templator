'use client';

import React, { useState, useEffect } from 'react';
import { 
  History, 
  GitBranch, 
  ArrowLeft, 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Archive, 
  Trash2,
  Eye,
  RefreshCw,
  GitCompare
} from 'lucide-react';

export interface ModuleVersion {
  version_id: string;
  version_number: string;
  module_id: string;
  package_id: string;
  deployment_id?: string;
  created_at: string;
  created_by: string;
  status: 'draft' | 'packaged' | 'deployed' | 'active' | 'inactive' | 'archived';
  change_summary: string;
  change_log: string[];
  metadata: {
    module_name: string;
    description: string;
    file_count: number;
    total_size_bytes: number;
    checksum: string;
  };
  deployment_info?: {
    hubspot_module_id: string;
    portal_id: string;
    environment: 'sandbox' | 'production';
    deployed_at: string;
    deployment_url?: string;
  };
  rollback_info?: {
    can_rollback: boolean;
    previous_version_id?: string;
    backup_id?: string;
  };
}

export interface VersionHistory {
  module_id: string;
  versions: ModuleVersion[];
  total_versions: number;
  active_version?: ModuleVersion;
  latest_version: ModuleVersion;
  version_stats: {
    total_deployments: number;
    successful_deployments: number;
    failed_deployments: number;
    rollbacks: number;
  };
}

interface VersionManagerProps {
  moduleId: string;
  onVersionSelect?: (version: ModuleVersion) => void;
  onRollback?: (rollbackVersion: ModuleVersion) => void;
  className?: string;
}

export default function VersionManager({
  moduleId,
  onVersionSelect,
  onRollback,
  className = ''
}: VersionManagerProps) {
  const [versionHistory, setVersionHistory] = useState<VersionHistory | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ModuleVersion | null>(null);
  const [compareVersion, setCompareVersion] = useState<ModuleVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState<ModuleVersion | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');

  useEffect(() => {
    if (moduleId) {
      loadVersionHistory();
    }
  }, [moduleId]);

  const loadVersionHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/export/module/${moduleId}/versions`);
      
      if (!response.ok) {
        throw new Error(`Failed to load version history: ${response.statusText}`);
      }

      const result = await response.json();
      setVersionHistory(result.version_history);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (targetVersion: ModuleVersion) => {
    if (!versionHistory?.active_version || !rollbackReason.trim()) return;

    setRollbackLoading(targetVersion.version_id);
    setError(null);

    try {
      const response = await fetch(
        `/api/export/version/${versionHistory.active_version.version_id}/rollback/${targetVersion.version_id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rollback_reason: rollbackReason,
            performed_by: 'current_user' // This should come from auth context
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Rollback failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (onRollback) {
        onRollback(result.rollback_version);
      }

      // Reload version history
      await loadVersionHistory();
      setShowRollbackDialog(null);
      setRollbackReason('');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setRollbackLoading(null);
    }
  };

  const archiveOldVersions = async () => {
    try {
      const response = await fetch(`/api/export/module/${moduleId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keep_count: 10 }),
      });

      if (!response.ok) {
        throw new Error(`Archive failed: ${response.statusText}`);
      }

      await loadVersionHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'deployed': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'packaged': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'archived': return <Archive className="w-4 h-4 text-gray-600" />;
      case 'inactive': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'deployed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'packaged': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'archived': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'inactive': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading && !versionHistory) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
        <div className="p-6 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
          <div className="text-gray-600">Loading version history...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
        <div className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadVersionHistory}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!versionHistory) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
        <div className="p-6 text-center">
          <History className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <div className="text-gray-600">No version history available</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <History className="w-6 h-6 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Version History</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={archiveOldVersions}
              className="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              <Archive className="w-4 h-4 inline mr-1" />
              Archive Old
            </button>
            <button
              onClick={loadVersionHistory}
              disabled={loading}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 inline mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Version Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-gray-900">{versionHistory.total_versions}</div>
            <div className="text-xs text-gray-600">Total Versions</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">{versionHistory.version_stats.successful_deployments}</div>
            <div className="text-xs text-gray-600">Successful</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-lg font-bold text-red-600">{versionHistory.version_stats.failed_deployments}</div>
            <div className="text-xs text-gray-600">Failed</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-lg font-bold text-yellow-600">{versionHistory.version_stats.rollbacks}</div>
            <div className="text-xs text-gray-600">Rollbacks</div>
          </div>
        </div>

        {/* Version List */}
        <div className="space-y-3">
          {versionHistory.versions.map((version) => (
            <div
              key={version.version_id}
              className={`border rounded-lg p-4 transition-colors ${
                selectedVersion?.version_id === version.version_id 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(version.status)}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">v{version.version_number}</span>
                      <span className={`px-2 py-1 text-xs rounded border ${getStatusColor(version.status)}`}>
                        {version.status}
                      </span>
                      {version.status === 'active' && (
                        <span className="px-2 py-1 text-xs bg-green-600 text-white rounded">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {version.change_summary}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(version.created_at).toLocaleString()} • {version.created_by} • {formatFileSize(version.metadata.total_size_bytes)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setSelectedVersion(selectedVersion?.version_id === version.version_id ? null : version);
                      if (onVersionSelect) {
                        onVersionSelect(version);
                      }
                    }}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {version.status !== 'active' && version.status !== 'archived' && (
                    <button
                      onClick={() => setShowRollbackDialog(version)}
                      disabled={rollbackLoading === version.version_id}
                      className="p-2 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-100 disabled:opacity-50"
                      title="Rollback to this version"
                    >
                      {rollbackLoading === version.version_id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowLeft className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {selectedVersion?.version_id === version.version_id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Details</h4>
                      <div className="text-sm space-y-1">
                        <div><strong>Package ID:</strong> {version.package_id}</div>
                        <div><strong>Files:</strong> {version.metadata.file_count}</div>
                        <div><strong>Checksum:</strong> {version.metadata.checksum.substring(0, 16)}...</div>
                      </div>
                    </div>
                    
                    {version.deployment_info && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Deployment</h4>
                        <div className="text-sm space-y-1">
                          <div><strong>Environment:</strong> {version.deployment_info.environment}</div>
                          <div><strong>Portal ID:</strong> {version.deployment_info.portal_id}</div>
                          <div><strong>Deployed:</strong> {new Date(version.deployment_info.deployed_at).toLocaleString()}</div>
                          {version.deployment_info.deployment_url && (
                            <div>
                              <a
                                href={version.deployment_info.deployment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                View in HubSpot →
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {version.change_log.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-900 mb-2">Change Log</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {version.change_log.map((change, index) => (
                          <li key={index}>• {change}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Rollback Dialog */}
        {showRollbackDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Rollback to v{showRollbackDialog.version_number}
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  This will create a new version based on v{showRollbackDialog.version_number} and 
                  deactivate the current version. This action cannot be undone.
                </p>
                
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rollback Reason *
                </label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Explain why you're rolling back..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRollbackDialog(null);
                    setRollbackReason('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRollback(showRollbackDialog)}
                  disabled={!rollbackReason.trim() || rollbackLoading === showRollbackDialog.version_id}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {rollbackLoading === showRollbackDialog.version_id && (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  )}
                  <span>Rollback</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
