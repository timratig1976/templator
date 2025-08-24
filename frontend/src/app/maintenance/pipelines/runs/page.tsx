"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type PipelineStatus = 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled' | string;

interface PipelineRun {
  id: string;
  pipelineVersionId: string | null;
  status: PipelineStatus;
  startedAt: string | null;
  completedAt: string | null;
  origin?: string | null;
  summary?: Record<string, unknown> | null;
  _count?: { stepRuns: number };
}

type ApiResponse = {
  success: boolean;
  data?: {
    runs: PipelineRun[];
    count: number;
    summary: { byStatus: Record<string, number> };
    total: number;
    limit: number;
    offset: number;
  };
  error?: string;
};

export default function RecentPipelineRunsPage() {
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("");
  const [origin, setOrigin] = useState<string>("");
  const [limit, setLimit] = useState<number>(20);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshSec, setRefreshSec] = useState<number>(10);

  const [visibleCols, setVisibleCols] = useState({
    id: true,
    status: true,
    startedAt: true,
    completedAt: true,
    origin: true,
    stepRuns: true,
  });

  // Preselected pipeline version from query
  const [selectedPvId, setSelectedPvId] = useState<string>("");
  const [selectedPvLabel, setSelectedPvLabel] = useState<string>("");

  function toggle(col: keyof typeof visibleCols) {
    setVisibleCols((v) => ({ ...v, [col]: !v[col] }));
  }

  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3009";

  // pagination
  const [offset, setOffset] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (status.trim()) params.set("status", status.trim());
      if (origin.trim()) params.set("origin", origin.trim());
      const url = `${backendBase}/api/monitoring/pipelines/runs/recent?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch recent runs (${res.status})`);
      const json = await res.json();
      const fetched: PipelineRun[] = (json?.data?.runs || []) as PipelineRun[];
      // Apply client-side filter if a pipeline version is preselected
      const filtered = selectedPvId ? fetched.filter(r => r.pipelineVersionId === selectedPvId) : fetched;
      setRuns(filtered);
      if (typeof json?.data?.total === 'number') setTotal(json.data.total);
      if (typeof json?.data?.limit === 'number') setLimit(json.data.limit);
      if (typeof json?.data?.offset === 'number') setOffset(json.data.offset);
    } catch (e: any) {
      setError(e?.message || "Failed to load recent runs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, status, origin, offset]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      load();
    }, refreshSec * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, refreshSec]);

  // Initialize from query params once
  useEffect(() => {
    const qPvId = (searchParams?.get("pvId") || "").trim();
    const qPvLabel = (searchParams?.get("pvLabel") || "").trim();
    if (qPvId) setSelectedPvId(qPvId);
    if (qPvLabel) setSelectedPvLabel(qPvLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // status badge
  function StatusBadge({ status }: { status: PipelineStatus }) {
    const cls =
      status === "completed"
        ? "bg-green-100 text-green-700"
        : status === "failed"
        ? "bg-red-100 text-red-700"
        : status === "cancelled"
        ? "bg-gray-200 text-gray-700"
        : "bg-yellow-100 text-yellow-800";
    return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{status}</span>;
  }

  const statusSummary = useMemo(() => {
    const s: Record<string, number> = {};
    runs.forEach((r) => { s[r.status] = (s[r.status] || 0) + 1; });
    return s;
  }, [runs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded bg-gray-200" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto
          </label>
          <input
            type="number"
            className="w-20 border rounded px-2 py-1 text-sm"
            min={3}
            value={refreshSec}
            onChange={(e) => setRefreshSec(Number(e.target.value) || 10)}
            title="Refresh interval (seconds)"
          />
        </div>

      {selectedPvId && (
        <div className="w-full mt-3 p-2 border rounded bg-indigo-50 text-indigo-800 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">Filtered by Pipeline Version</span>
            {selectedPvLabel ? `: ${selectedPvLabel}` : ""}
          </div>
          <button
            className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
            onClick={() => { setSelectedPvId(""); setSelectedPvLabel(""); load(); }}
            title="Clear version filter"
          >Clear</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600 mr-2">Columns:</span>
        {[
          { key: 'id', label: 'ID' },
          { key: 'status', label: 'Status' },
          { key: 'startedAt', label: 'Started' },
          { key: 'completedAt', label: 'Completed' },
          { key: 'origin', label: 'Origin' },
          { key: 'stepRuns', label: 'Step Runs' },
        ].map((c) => (
          <label key={c.key} className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={(visibleCols as any)[c.key]}
              onChange={() => toggle(c.key as keyof typeof visibleCols)}
            />
            {c.label}
          </label>
        ))}
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <div className="text-sm text-gray-600">Status</div>
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="e.g. running, completed, failed"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <div className="text-sm text-gray-600">Origin</div>
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="e.g. frontend_user, system"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <div className="text-sm text-gray-600">Limit</div>
          <input
            type="number"
            min={1}
            max={100}
            className="w-full border rounded px-2 py-1"
            value={limit}
            onChange={(e) => setLimit(Math.min(100, Math.max(1, Number(e.target.value) || 20)))}
          />
        </div>
        <div className="space-y-1">
          <div className="text-sm text-gray-600">API</div>
          <a
            className="inline-block px-3 py-1 bg-gray-200 rounded text-sm"
            href={`${backendBase}/api/monitoring/pipelines/runs/recent?limit=${limit}${status?`&status=${encodeURIComponent(status)}`:""}${origin?`&origin=${encodeURIComponent(origin)}`:""}`}
            target="_blank"
            rel="noreferrer"
          >Open Raw JSON</a>
        </div>
      </div>

      {error && (
        <div className="text-red-600">{error}</div>
      )}

      {/* Pagination controls */}
      <div className="flex items-center justify-between text-sm py-2">
        <div className="text-gray-600">
          <span className="mr-2">Total: {total}</span>
          <span>
            Showing {runs.length > 0 ? offset + 1 : 0}-{Math.min(offset + runs.length, total)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
          >Prev</button>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            disabled={offset + limit >= total}
            onClick={() => setOffset((o) => o + limit)}
          >Next</button>
        </div>
      </div>

      <div className="overflow-auto border rounded bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {visibleCols.id && <th className="text-left px-3 py-2">ID</th>}
              {visibleCols.status && <th className="text-left px-3 py-2">Status</th>}
              {visibleCols.startedAt && <th className="text-left px-3 py-2">Started</th>}
              {visibleCols.completedAt && <th className="text-left px-3 py-2">Completed</th>}
              {visibleCols.origin && <th className="text-left px-3 py-2">Origin</th>}
              {visibleCols.stepRuns && <th className="text-right px-3 py-2">Step Runs</th>}
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0">
                {visibleCols.id && (
                  <td className="px-3 py-2 font-mono text-xs">
                    <a className="text-blue-600 underline" href={`/maintenance/pipelines/runs/${r.id}`}>{r.id}</a>
                  </td>
                )}
                {visibleCols.status && <td className="px-3 py-2"><StatusBadge status={r.status} /></td>}
                {visibleCols.startedAt && <td className="px-3 py-2">{r.startedAt ? new Date(r.startedAt).toLocaleString() : '-'}</td>}
                {visibleCols.completedAt && <td className="px-3 py-2">{r.completedAt ? new Date(r.completedAt).toLocaleString() : '-'}</td>}
                {visibleCols.origin && <td className="px-3 py-2">{r.origin || '-'}</td>}
                {visibleCols.stepRuns && <td className="px-3 py-2 text-right">{r._count?.stepRuns ?? '-'}</td>}
              </tr>
            ))}
            {runs.length === 0 && !loading && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>No recent runs</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Summary</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusSummary).map(([k, v]) => (
            <span key={k} className="px-2 py-1 bg-gray-100 rounded text-sm">{k}: {v}</span>
          ))}
          {Object.keys(statusSummary).length === 0 && <span className="text-gray-500 text-sm">No data</span>}
        </div>
      </div>
    </div>
  );
}
