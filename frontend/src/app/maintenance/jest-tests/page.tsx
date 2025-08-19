"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TestExecutionState = {
  currentExecution?: string;
  status?: "idle" | "running" | "completed" | "error";
  startTime?: string;
  endTime?: string;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  skippedTests?: number;
  currentTest?: number;
  currentTestName?: string;
  currentSubtest?: string | null;
  tests?: Array<{
    id?: string;
    name: string;
    status: string;
    duration?: number;
    category?: string;
    error?: string | null;
    file?: string;
    subtests?: Array<{
      name: string;
      status: string;
      duration?: number;
      error?: string | null;
    }>;
  }>;
  summary?: string;
};

export default function JestTestSuitePage() {
  const [status, setStatus] = useState<TestExecutionState | null>(null);
  const [results, setResults] = useState<TestExecutionState | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const isRunning = status?.status === "running";

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/tests/status", { cache: "no-store" });
        const data = await r.json();
        const s: TestExecutionState | null = (data?.state || data?.testStatus || null) as any;
        if (s) setStatus(s);
        if (s && s.status === "completed") {
          stopPolling();
          // fetch results automatically
          void fetchResults();
        }
      } catch (e) {
        console.error(e);
      }
    }, 2500);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current as any);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startTests = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      const r = await fetch("/api/tests/start", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to start tests");
      // Kick off immediate status refresh and polling
      await fetchStatus();
      startPolling();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setStarting(false);
    }
  }, [startPolling]);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/tests/status", { cache: "no-store" });
      const data = await r.json();
      const s: TestExecutionState | null = (data?.state || data?.testStatus || null) as any;
      setStatus(s);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const r = await fetch("/api/tests/results", { cache: "no-store" });
      const data = await r.json();
      const res: TestExecutionState | null = (data?.results || data?.testResults || null) as any;
      setResults(res);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, []);

  const progressText = useMemo(() => {
    const total = status?.totalTests ?? 0;
    const done = (status?.passedTests ?? 0) + (status?.failedTests ?? 0) + (status?.skippedTests ?? 0);
    const pct = total > 0 ? Math.floor((done / total) * 100) : 0;
    return `${done}/${total} (${pct}%)`;
  }, [status]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">JEST Test Suite</h1>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 p-3">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={startTests}
          disabled={starting || isRunning}
          className={`px-4 py-2 rounded text-white ${starting || isRunning ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {starting ? "Starting..." : isRunning ? "Running..." : "Start Tests"}
        </button>
        <button
          onClick={fetchStatus}
          className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
        >
          Refresh Status
        </button>
        <button
          onClick={fetchResults}
          className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
        >
          Fetch Results
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded p-4 bg-white">
          <h2 className="font-medium mb-2">Current Status</h2>
          {status ? (
            <div className="text-sm space-y-1">
              <div><span className="font-medium">State:</span> {status.status}</div>
              <div><span className="font-medium">Started:</span> {status.startTime}</div>
              <div><span className="font-medium">Progress:</span> {progressText}</div>
              <div><span className="font-medium">Current:</span> {status.currentTestName}</div>
              <div className="mt-2 text-gray-700">{status.summary}</div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No status yet</div>
          )}
        </div>

        <div className="border rounded p-4 bg-white">
          <h2 className="font-medium mb-2">Latest Results</h2>
          {results ? (
            <div className="text-sm space-y-1">
              <div><span className="font-medium">Completed:</span> {results.endTime}</div>
              <div><span className="font-medium">Totals:</span> {results.passedTests} passed / {results.failedTests} failed / {results.skippedTests ?? 0} skipped</div>
              <div className="mt-2 text-gray-700">{results.summary}</div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No results yet</div>
          )}
        </div>
      </div>

      <div className="border rounded p-4 bg-white">
        <h2 className="font-medium mb-2">Detail</h2>
        <pre className="text-xs overflow-auto max-h-[400px] bg-gray-50 p-3 rounded">
{JSON.stringify({ status, results }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
