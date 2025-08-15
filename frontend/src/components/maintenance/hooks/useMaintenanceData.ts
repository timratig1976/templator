/**
 * Custom Hook for Maintenance Dashboard Data
 * Centralized data fetching and state management
 */

import { useState, useEffect, useCallback } from 'react';

export interface SystemHealth {
  status: string;
  timestamp: string;
  uptime: number;
  memory: any;
  environment: string;
}

export interface BuildTestStatus {
  isRunning: boolean;
  isHealthy: boolean;
  lastBuildTime: string | null;
  latestResult: any;
  serviceHealth: any;
}

export interface QualityMetrics {
  overallScore: number;
  trends: any[];
  recentReports: any[];
}

export interface MaintenanceData {
  systemHealth: SystemHealth | null;
  buildTestStatus: BuildTestStatus | null;
  qualityMetrics: QualityMetrics | null;
  logs: string[];
  deadCode: {
    generatedAt: string | null;
    deadFiles: number;
    unusedExports: number;
    unusedDependencies: number;
    items: Array<{
      type: 'file' | 'export' | 'dependency';
      path?: string;
      symbol?: string;
      packageName?: string;
      severity?: 'low' | 'medium' | 'high';
      signals?: string[];
      lastSeen?: string;
      notes?: string;
    }>;
  } | null;
}

export interface UseMaintenanceDataReturn {
  data: MaintenanceData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  runBuildTest: () => Promise<void>;
  testRunning: boolean;
  testProgress: string;
  runDeadCodeScan: () => Promise<void>;
}

export const useMaintenanceData = (): UseMaintenanceDataReturn => {
  const [data, setData] = useState<MaintenanceData>({
    systemHealth: null,
    buildTestStatus: null,
    qualityMetrics: null,
    logs: [],
    deadCode: null
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testProgress, setTestProgress] = useState<string>('');

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009';

  // Helper: fetch with timeout
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const defaultHeaders: HeadersInit = { Accept: 'application/json' };
      const mergedHeaders: HeadersInit = {
        ...(defaultHeaders || {}),
        ...(options.headers || {} as any),
      };

      const res = await fetch(url, { ...options, headers: mergedHeaders, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  };

  // Helper: parse JSON safely with content-type check
  const parseJsonSafely = async (res: Response, endpointLabel: string) => {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return res.json();
    }
    const text = await res.text();
    throw new Error(`Expected JSON from ${endpointLabel} but got ${ct}. Body: ${text.slice(0, 300)}`);
  };

  const fetchDashboardData = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
      setError(null);
    }

    const attempt = async () => {
      // Fetch endpoints SEQUENTIALLY to prevent backend overload/crashes
      // System health first (most critical)
      const systemResponse = await fetchWithTimeout(`${backendUrl}/api/monitoring/system/health`);
      const systemData = await parseJsonSafely(systemResponse, 'system/health');

      // Build test status
      const buildResponse = await fetchWithTimeout(`${backendUrl}/api/build-test/status`);
      const buildData = await parseJsonSafely(buildResponse, 'build-test/status');

      // Quality metrics
      const qualityResponse = await fetchWithTimeout(`${backendUrl}/api/monitoring/quality/metrics`);
      const qualityData = await parseJsonSafely(qualityResponse, 'quality/metrics');

      // Dead code report (last, as it's most likely to have issues)
      const deadCodeResponse = await fetchWithTimeout(`${backendUrl}/api/monitoring/dead-code/report`);
      const deadCodeData = await parseJsonSafely(deadCodeResponse, 'dead-code/report');

      // Normalize system health into expected shape
      const rawHealth = (systemData?.data || systemData) as any;
      const sys = rawHealth?.system || rawHealth;
      const uptimeStr = sys?.uptime; // e.g. "12.3h"
      const uptimeHours = typeof uptimeStr === 'string' ? parseFloat(uptimeStr) : (typeof uptimeStr === 'number' ? uptimeStr : 0);
      const uptimeSeconds = (typeof uptimeStr === 'string') ? Math.round((uptimeHours || 0) * 3600) : (sys?.uptime || 0);

      const rawQuality = (qualityData?.data || qualityData) as any;
      const overallScore = (rawQuality?.summary?.overallScore ?? rawQuality?.overallScore ?? 0) as number;
      const trends = (rawQuality?.trends ?? []) as any[];
      const recentReports = (rawQuality?.reports ?? rawQuality?.recentReports ?? []) as any[];

      // Dead code summary mapping
      const rawDead = (deadCodeData?.data || deadCodeData) as any;
      const report = rawDead?.report;
      const deadSummary = report?.summary;

      setData({
        systemHealth: {
          status: rawHealth?.status || 'unknown',
          timestamp: rawHealth?.timestamp || new Date().toISOString(),
          uptime: uptimeSeconds,
          memory: sys?.memory || null,
          environment: (typeof window !== 'undefined' ? window?.location?.hostname : 'unknown') as string,
        },
        buildTestStatus: (buildData.data || buildData) as any,
        qualityMetrics: {
          overallScore,
          trends,
          recentReports,
        },
        logs: [],
        deadCode: report ? {
          generatedAt: report.generatedAt || null,
          deadFiles: deadSummary?.deadFiles ?? 0,
          unusedExports: deadSummary?.unusedExports ?? 0,
          unusedDependencies: deadSummary?.unusedDependencies ?? 0,
          items: Array.isArray(report.items) ? report.items : []
        } : null
      });
      setError(null);
    };

    // Retry with exponential backoff (3 attempts)
    const delays = [400, 1200, 3000];
    let lastErr: any = null;
    for (let i = 0; i < delays.length; i++) {
      try {
        await attempt();
        break; // success
      } catch (e) {
        lastErr = e;
        if (i < delays.length - 1) {
          await new Promise(r => setTimeout(r, delays[i]));
          continue;
        }
      }
    }

    if (lastErr) {
      console.error('Error fetching dashboard data:', lastErr);
      setError(lastErr instanceof Error ? lastErr.message : 'Failed to fetch dashboard data');
    }

    setLoading(false);
  }, [backendUrl, data.systemHealth, data.buildTestStatus, data.qualityMetrics, loading]);

  const runBuildTest = useCallback(async () => {
    try {
      setTestRunning(true);
      setTestProgress('Starting build test...');
      setError(null);

      const response = await fetchWithTimeout(`${backendUrl}/api/build-test/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }, 60000);

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Failed to start build test: HTTP ${response.status}. ${body.slice(0, 200)}`);
      }

      // Prefer safe JSON parse; tolerate text
      let result: any = null;
      try {
        result = await parseJsonSafely(response, 'build-test/run');
      } catch {
        // ignore; some backends return 204 or text
      }
      setTestProgress('Build test completed successfully');
      
      // Refresh data after test completion
      setTimeout(() => {
        fetchDashboardData();
        setTestRunning(false);
        setTestProgress('');
      }, 2000);

    } catch (err) {
      console.error('Error running build test:', err);
      // Do not blow away UI; show progress error and keep previous data
      setError(null);
      setTestRunning(false);
      setTestProgress(err instanceof Error ? err.message : 'Failed to start build test');
    }
  }, [backendUrl, fetchDashboardData]);

  const runDeadCodeScan = useCallback(async () => {
    try {
      await fetchWithTimeout(`${backendUrl}/api/monitoring/dead-code/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      }, 60000);
      await fetchDashboardData();
    } catch (err) {
      // Soft-fail; keep previous data
      console.error('Error running dead-code scan:', err);
    }
  }, [backendUrl, fetchDashboardData]);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!testRunning) {
        fetchDashboardData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchDashboardData, testRunning]);

  return {
    data,
    loading,
    error,
    refetch: fetchDashboardData,
    runBuildTest,
    testRunning,
    testProgress,
    runDeadCodeScan
  };
};
