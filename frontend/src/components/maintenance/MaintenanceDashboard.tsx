/**
 * Refactored Maintenance Dashboard Component
 * Clean, modular architecture with separated concerns
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMaintenanceData } from './hooks/useMaintenanceData';
// Removed internal TabNavigation to avoid duplicate tabs; outer layout provides nav
// import TabNavigation, { Tab } from './ui/TabNavigation';
import RawDataModal from './ui/RawDataModal';
import SystemHealthCard from './features/SystemHealthCard';
import BuildTestCard from './features/BuildTestCard';
import QualityMetricsCard from './features/QualityMetricsCard';
import DeadCodeCard from './features/DeadCodeCard';
import BuildTestRealtimePanel from './features/BuildTestRealtimePanel';

export const MaintenanceDashboard: React.FC<{ initialTab?: string }> = ({ initialTab }) => {
  const {
    data,
    loading,
    error,
    refetch,
    runBuildTest,
    testRunning,
    testProgress,
    runDeadCodeScan,
    runQuickPipeline,
  } = useMaintenanceData();

  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [showRawDataModal, setShowRawDataModal] = useState(false);
  const [rawDataContent, setRawDataContent] = useState<any>(null);
  const [rawDataTitle, setRawDataTitle] = useState('');
  const [isLoadingRawData, setIsLoadingRawData] = useState(false);
  const [quickRunBusy, setQuickRunBusy] = useState(false);

  // const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009';

  // Handle raw data modal opening
  const openRawDataModal = async (endpoint: string, title: string) => {
    try {
      setIsLoadingRawData(true);
      setRawDataTitle(title);
      setShowRawDataModal(true);

      const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009';
      const url = endpoint.startsWith('http') ? endpoint : `${backendBase}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json'
        }
      });
      if (!response.ok) {
        const ct = response.headers.get('content-type') || '';
        const body = ct.includes('application/json') ? await response.text() : await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText} from ${endpoint}. Content-Type: ${ct}. Body: ${body?.slice(0, 300)}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        setRawDataContent(data);
      } else {
        const text = await response.text();
        setRawDataContent({ note: 'Non-JSON response', contentType, text });
      }
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

  // Test Suite dashboard button removed from internal header to avoid duplication

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
      {/* Main Content (header and tabs provided by outer layout) */}
      <div className="py-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              linkOnly
            />
            <QualityMetricsCard
              qualityMetrics={data.qualityMetrics}
              onRawDataClick={openRawDataModal}
              showTooltip={showTooltip}
              onTooltipChange={setShowTooltip}
            />
            <DeadCodeCard
              deadCodeSummary={data.deadCode}
              onRawDataClick={openRawDataModal}
              onRunScan={runDeadCodeScan}
            />

            {/* Quick Links to Management sections */}
            <div className="p-4 border rounded bg-white flex items-center justify-between">
              <div>
                <div className="font-semibold">Manage Pipelines</div>
                <div className="text-sm text-gray-500">Definitions, versions, and activation</div>
              </div>
              <Link href="/maintenance/ai/settings/pipelines" className="px-3 py-1 bg-blue-600 text-white rounded">Open</Link>
            </div>
            <div className="p-4 border rounded bg-white flex items-center justify-between">
              <div>
                <div className="font-semibold">Manage Steps</div>
                <div className="text-sm text-gray-500">Step definitions, versions, and activation</div>
              </div>
              <Link href="/maintenance/ai/settings/steps" className="px-3 py-1 bg-blue-600 text-white rounded">Open</Link>
            </div>
            <div className="p-4 border rounded bg-white flex items-center justify-between">
              <div>
                <div className="font-semibold">Manage IR Schemas</div>
                <div className="text-sm text-gray-500">Schemas per step version with JSON editor</div>
              </div>
              <Link href="/maintenance/ai/settings/ir-schemas" className="px-3 py-1 bg-blue-600 text-white rounded">Open</Link>
            </div>

            {/* Quick Run: maintenance_test origin */}
            <div className="p-4 border rounded bg-white flex items-center justify-between col-span-1 lg:col-span-2">
              <div>
                <div className="font-semibold">Quick-Run: Detect Splitlines</div>
                <div className="text-sm text-gray-500">Triggers a maintenance-tagged pipeline step (templator-layout/detect_splitlines)</div>
              </div>
              <button
                disabled={quickRunBusy}
                onClick={async () => {
                  try {
                    setQuickRunBusy(true);
                    const result = await runQuickPipeline({
                      pipelineName: 'templator-layout',
                      pipelineVersion: 'v1',
                      stepKey: 'detect_splitlines',
                      params: { threshold: 0.5 },
                      summary: { trigger: 'maintenance_ui' },
                      origin: 'maintenance_test',
                      originInfo: { ui: 'MaintenanceDashboard' },
                    });
                    setRawDataTitle('Quick Run Result');
                    setRawDataContent(result);
                    setShowRawDataModal(true);
                  } finally {
                    setQuickRunBusy(false);
                  }
                }}
                className={`px-3 py-1 rounded text-white ${quickRunBusy ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {quickRunBusy ? 'Running…' : 'Run pipeline'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'ai-system' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <QualityMetricsCard
              qualityMetrics={data.qualityMetrics}
              onRawDataClick={openRawDataModal}
              showTooltip={showTooltip}
              onTooltipChange={setShowTooltip}
            />
            {/* AI maintenance subpages/links could be added here (prompt management, validation, etc.) */}
          </div>
        )}
      </div>
      {activeTab === 'build-tests' && (
        <div className="w-full pb-8">
          <BuildTestRealtimePanel />
        </div>
      )}

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
