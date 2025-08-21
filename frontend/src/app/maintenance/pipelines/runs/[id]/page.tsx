"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface StepRun {
  id: string;
  nodeKey: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

type PipelineStatus = 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled' | string;

interface PipelineRunDetail {
  id: string;
  status: PipelineStatus;
  origin?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  summary?: unknown;
  _count?: { stepRuns: number };
  stepRuns?: StepRun[];
}

export default function PipelineRunDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const runId = (params?.id as string) || "";

  const [data, setData] = useState<PipelineRunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3009";

  async function load() {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendBase}/api/monitoring/pipelines/runs/${runId}`);
      if (!res.ok) throw new Error(`Failed to fetch run details (${res.status})`);
      const json = await res.json();
      setData(json.data as PipelineRunDetail);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  async function cancelRun() {
    if (!runId) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`${backendBase}/api/monitoring/pipelines/${runId}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Cancel failed (${res.status})`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pipeline Run Details</h1>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 border rounded" onClick={() => router.back()}>Back</button>
          <a className="px-3 py-1 border rounded text-blue-600" href={`${backendBase}/api/monitoring/pipelines/runs/${runId}`} target="_blank" rel="noreferrer">Open JSON</a>
          {data && (data.status === 'running' || data.status === 'initializing') && (
            <button
              className="px-3 py-1 border rounded bg-red-600 text-white disabled:opacity-50"
              onClick={cancelRun}
              disabled={cancelling}
              title="Cancel this pipeline run"
            >{cancelling ? 'Cancelling…' : 'Cancel Run'}</button>
          )}
        </div>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Info k="Run ID" v={<code className="text-xs">{data.id}</code>} />
            <Info k="Status" v={<StatusBadge status={data.status} />} />
            <Info k="Origin" v={data.origin || "-"} />
            <Info k="Started" v={data.startedAt ? new Date(data.startedAt).toLocaleString() : "-"} />
            <Info k="Completed" v={data.completedAt ? new Date(data.completedAt).toLocaleString() : "-"} />
            <Info k="# Step Runs" v={data._count?.stepRuns ?? data.stepRuns?.length ?? 0} />
          </div>

          <div className="border rounded overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2">Step ID</th>
                  <th className="text-left px-3 py-2">Node Key</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Started</th>
                  <th className="text-left px-3 py-2">Completed</th>
                  <th className="text-left px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {(data.stepRuns || []).map((s) => (
                  <tr key={s.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs">{s.id}</td>
                    <td className="px-3 py-2">{s.nodeKey || "-"}</td>
                    <td className="px-3 py-2"><StatusBadge status={s.status} /></td>
                    <td className="px-3 py-2">{s.startedAt ? new Date(s.startedAt).toLocaleString() : "-"}</td>
                    <td className="px-3 py-2">{s.completedAt ? new Date(s.completedAt).toLocaleString() : "-"}</td>
                    <td className="px-3 py-2 whitespace-pre-wrap text-xs text-red-700">{s.error || "-"}</td>
                  </tr>
                ))}
                {(!data.stepRuns || data.stepRuns.length === 0) && (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>No step runs</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data.summary && (
            <div className="space-y-2">
              <div className="font-medium">Summary</div>
              <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">{JSON.stringify(data.summary, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="p-3 border rounded bg-white">
      <div className="text-xs text-gray-600">{k}</div>
      <div className="text-sm">{v}</div>
    </div>
  );
}

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
