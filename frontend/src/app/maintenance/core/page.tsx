"use client";
import React, { useState } from "react";
import { useMaintenanceData } from "../../../components/maintenance/hooks/useMaintenanceData";
import RawDataModal from "../../../components/maintenance/ui/RawDataModal";
import SystemHealthCard from "../../../components/maintenance/features/SystemHealthCard";
import BuildTestCard from "../../../components/maintenance/features/BuildTestCard";
import QualityMetricsCard from "../../../components/maintenance/features/QualityMetricsCard";
import DeadCodeCard from "../../../components/maintenance/features/DeadCodeCard";

export default function CoreOverviewPage() {
  const {
    data,
    loading,
    error,
    refetch,
    runBuildTest,
    testRunning,
    testProgress,
    runDeadCodeScan,
  } = useMaintenanceData();

  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [showRawDataModal, setShowRawDataModal] = useState(false);
  const [rawDataContent, setRawDataContent] = useState<any>(null);
  const [rawDataTitle, setRawDataTitle] = useState("");
  const [isLoadingRawData, setIsLoadingRawData] = useState(false);

  const openRawDataModal = async (endpoint: string, title: string) => {
    try {
      setIsLoadingRawData(true);
      setRawDataTitle(title);
      setShowRawDataModal(true);

      const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3009";
      const url = endpoint.startsWith("http") ? endpoint : `${backendBase}${endpoint}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        const ct = response.headers.get("content-type") || "";
        const body = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText} from ${endpoint}. Content-Type: ${ct}. Body: ${body?.slice(0, 300)}`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await response.json();
        setRawDataContent(json);
      } else {
        const text = await response.text();
        setRawDataContent({ note: "Non-JSON response", contentType, text });
      }
    } catch (err) {
      console.error("Error fetching raw data:", err);
      setRawDataContent({
        error: "Failed to load data",
        message: err instanceof Error ? err.message : "Unknown error occurred",
      });
    } finally {
      setIsLoadingRawData(false);
    }
  };

  if (loading && !data.systemHealth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading core maintenance…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Core Maintenance Error</h2>
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
      <div className="py-6">
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
            deadCodeSummary={data.deadCode as any}
            onRawDataClick={openRawDataModal}
            onRunScan={runDeadCodeScan}
          />
        </div>
      </div>

      <RawDataModal
        isOpen={showRawDataModal}
        onClose={() => {
          setShowRawDataModal(false);
          setRawDataContent(null);
          setRawDataTitle("");
        }}
        title={rawDataTitle}
        data={rawDataContent}
        isLoading={isLoadingRawData}
      />
    </div>
  );
}
