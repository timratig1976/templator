/**
 * Refactored Maintenance Dashboard Component
 * Clean, modular architecture with separated concerns
 */

'use client';

import React, { useState } from 'react';
import { useMaintenanceData } from './hooks/useMaintenanceData';
import TabNavigation, { Tab } from './ui/TabNavigation';
import RawDataModal from './ui/RawDataModal';
import SystemHealthCard from './features/SystemHealthCard';
import BuildTestCard from './features/BuildTestCard';
import QualityMetricsCard from './features/QualityMetricsCard';

export const MaintenanceDashboard: React.FC = () => {
  const {
    data,
    loading,
    error,
    refetch,
    runBuildTest,
    testRunning,
    testProgress
  } = useMaintenanceData();

  const [activeTab, setActiveTab] = useState('overview');
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [showRawDataModal, setShowRawDataModal] = useState(false);
  const [rawDataContent, setRawDataContent] = useState<any>(null);
  const [rawDataTitle, setRawDataTitle] = useState('');
  const [isLoadingRawData, setIsLoadingRawData] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009';

  // Tab configuration
  const tabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'system', label: 'System Health', icon: '🏥' },
    { id: 'build', label: 'Build Tests', icon: '🔧' },
    { id: 'quality', label: 'Quality Metrics', icon: '📈' },
    { id: 'logs', label: 'Logs', icon: '📝', count: data.logs.length }
  ];

  // Handle raw data modal opening
  const openRawDataModal = async (endpoint: string, title: string) => {
    try {
      setIsLoadingRawData(true);
      setRawDataTitle(title);
      setShowRawDataModal(true);

      const response = await fetch(`${backendUrl}${endpoint}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data from ${endpoint}`);
      }

      const data = await response.json();
      setRawDataContent(data);
    } catch (err) {
      console.error('Error fetching raw data:', err);
      setRawDataContent({
        error: 'Failed to load data',
        message: err instanceof Error ? err.message : 'Unknown error occurred'
      });
    } finally {
      setIsLoadingRawData(false);
    }
  };

  // Handle test suite dashboard opening
  const openTestSuiteDashboard = () => {
    window.open('/test-suite-dashboard.html', '_blank');
  };

  // Loading state
  if (loading && !data.systemHealth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading maintenance dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Dashboard Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={refetch}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🔧 Maintenance Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">System monitoring, testing, and quality metrics</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={refetch}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button
                onClick={openTestSuiteDashboard}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                🧪 Test Suite Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SystemHealthCard
              systemHealth={data.systemHealth}
              onRawDataClick={openRawDataModal}
              showTooltip={showTooltip}
              onTooltipChange={setShowTooltip}
            />
            <BuildTestCard
              buildTestStatus={data.buildTestStatus}
              onRunBuildTest={runBuildTest}
              onRawDataClick={openRawDataModal}
              testRunning={testRunning}
              testProgress={testProgress}
              showTooltip={showTooltip}
              onTooltipChange={setShowTooltip}
            />
            <QualityMetricsCard
              qualityMetrics={data.qualityMetrics}
              onRawDataClick={openRawDataModal}
              showTooltip={showTooltip}
              onTooltipChange={setShowTooltip}
            />
          </div>
        )}

        {activeTab === 'system' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SystemHealthCard
              systemHealth={data.systemHealth}
              onRawDataClick={openRawDataModal}
              showTooltip={showTooltip}
              onTooltipChange={setShowTooltip}
            />
            {/* Additional system details could go here */}
          </div>
        )}

        {activeTab === 'build' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BuildTestCard
              buildTestStatus={data.buildTestStatus}
              onRunBuildTest={runBuildTest}
              onRawDataClick={openRawDataModal}
              testRunning={testRunning}
              testProgress={testProgress}
              showTooltip={showTooltip}
              onTooltipChange={setShowTooltip}
            />
            {/* Additional build details could go here */}
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <QualityMetricsCard
              qualityMetrics={data.qualityMetrics}
              onRawDataClick={openRawDataModal}
              showTooltip={showTooltip}
              onTooltipChange={setShowTooltip}
            />
            {/* Additional quality details could go here */}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">📝 System Logs</h3>
              {data.logs.length > 0 ? (
                <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="text-green-400 text-sm font-mono">
                    {data.logs.join('\n')}
                  </pre>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-2">📝</div>
                  <p>No logs available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Raw Data Modal */}
      <RawDataModal
        isOpen={showRawDataModal}
        onClose={() => {
          setShowRawDataModal(false);
          setRawDataContent(null);
          setRawDataTitle('');
        }}
        title={rawDataTitle}
        data={rawDataContent}
        isLoading={isLoadingRawData}
      />
    </div>
  );
};

export default MaintenanceDashboard;
