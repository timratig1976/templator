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
}

export interface UseMaintenanceDataReturn {
  data: MaintenanceData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  runBuildTest: () => Promise<void>;
  testRunning: boolean;
  testProgress: string;
}

export const useMaintenanceData = (): UseMaintenanceDataReturn => {
  const [data, setData] = useState<MaintenanceData>({
    systemHealth: null,
    buildTestStatus: null,
    qualityMetrics: null,
    logs: []
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testProgress, setTestProgress] = useState<string>('');

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009';

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [healthResponse, buildResponse, qualityResponse] = await Promise.all([
        fetch(`${backendUrl}/api/monitoring/dashboard`),
        fetch(`${backendUrl}/api/build-test/status`),
        fetch(`${backendUrl}/api/monitoring/quality/metrics`)
      ]);

      if (!healthResponse.ok || !buildResponse.ok || !qualityResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [healthData, buildData, qualityData] = await Promise.all([
        healthResponse.json(),
        buildResponse.json(),
        qualityResponse.json()
      ]);

      setData({
        systemHealth: healthData.data || healthData,
        buildTestStatus: buildData.data || buildData,
        qualityMetrics: qualityData.data || qualityData,
        logs: []
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  const runBuildTest = useCallback(async () => {
    try {
      setTestRunning(true);
      setTestProgress('Starting build test...');
      setError(null);

      const response = await fetch(`${backendUrl}/api/build-test/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to start build test');
      }

      const result = await response.json();
      setTestProgress('Build test completed successfully');
      
      // Refresh data after test completion
      setTimeout(() => {
        fetchDashboardData();
        setTestRunning(false);
        setTestProgress('');
      }, 2000);

    } catch (err) {
      console.error('Error running build test:', err);
      setError(err instanceof Error ? err.message : 'Build test failed');
      setTestRunning(false);
      setTestProgress('');
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
    testProgress
  };
};
