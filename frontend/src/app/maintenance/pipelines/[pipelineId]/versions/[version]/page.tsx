"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type DagNode = {
  key: string;
  stepVersionId: string;
  params?: Record<string, any>;
  metricProfileId?: string;
  order?: number;
  dependsOn?: string[];
  condition?: string;
  continueOnFail?: boolean;
  retries?: number;
  timeoutMs?: number;
  parallelGroup?: string;
};

type DagEdge = { from: string; to: string };

type PipelineVersion = {
  id: string;
  version: string;
  pipelineId: string;
  dag: { nodes: DagNode[]; edges?: DagEdge[] } | null;
  config?: Record<string, any> | null;
  isActive: boolean;
};

export default function DagManagerPage() {
  const params = useParams<{ pipelineId: string; version: string }>();
  const router = useRouter();
  const pipelineId = params?.pipelineId as string;
  const version = decodeURIComponent(params?.version as string);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  const [pv, setPv] = useState<PipelineVersion | null>(null);
  const [dagText, setDagText] = useState<string>(`{
  "nodes": [],
  "edges": []
}`);
  const [plan, setPlan] = useState<string[] | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // Derive dependsOn from edges and order from plan, then save
  async function deriveAndSave() {
    setSaving(true);
    setError(null);
    try {
      // ensure we have a plan
      let currentPlan = plan;
      if (!currentPlan) {
        const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(version)}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dryRun: true }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || res.statusText);
        currentPlan = j.data?.plan || [];
        setPlan(currentPlan);
      }

      // parse current dag
      let dag: { nodes: DagNode[]; edges?: DagEdge[] } = { nodes: [] };
      try {
        dag = JSON.parse(dagText || "{}");
      } catch {
        // fallback to loaded pv
        dag = pv?.dag || { nodes: [] } as any;
      }

      const incoming: Record<string, string[]> = {};
      (dag.nodes || []).forEach((n) => { incoming[n.key] = Array.isArray(n.dependsOn) ? [...n.dependsOn] : []; });
      (dag.edges || []).forEach((e) => {
        if (!incoming[e.to]) incoming[e.to] = [];
        if (!incoming[e.to].includes(e.from)) incoming[e.to].push(e.from);
      });

      const orderIndex: Record<string, number> = {};
      (currentPlan || []).forEach((k, idx) => { orderIndex[k] = idx + 1; });

      const updatedNodes: DagNode[] = (dag.nodes || []).map((n) => ({
        ...n,
        dependsOn: incoming[n.key] || n.dependsOn,
        order: typeof orderIndex[n.key] === "number" ? orderIndex[n.key] : n.order,
      }));

      const nextDag = { ...dag, nodes: updatedNodes };

      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(version)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dag: nextDag }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      await load();
      showToast("Derived fields saved");
    } catch (e: any) {
      setError(e?.message || "Failed to derive and save");
    } finally {
      setSaving(false);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(version)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setPv(j.data);
      const text = JSON.stringify(j.data?.dag ?? { nodes: [], edges: [] }, null, 2);
      setDagText(text);
    } catch (e: any) {
      setError(e?.message || "Failed to load version");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!pv) return;
    setSaving(true);
    setError(null);
    try {
      let dag: any = null;
      try {
        dag = JSON.parse(dagText);
      } catch (e) {
        showToast("Invalid JSON");
        return;
      }
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(version)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dag }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      await load();
      showToast("DAG saved");
    } catch (e: any) {
      setError(e?.message || "Failed to save DAG");
    } finally {
      setSaving(false);
    }
  }

  async function planRun() {
    setPlanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(version)}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setPlan(j.data?.plan || []);
      showToast("Plan generated");
    } catch (e: any) {
      setError(e?.message || "Failed to plan");
    } finally {
      setPlanning(false);
    }
  }

  useEffect(() => {
    if (pipelineId && version) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId, version]);

  const nodesByKey = useMemo(() => {
    const m = new Map<string, DagNode>();
    const nodes = (pv?.dag?.nodes ?? []);
    nodes.forEach((n) => m.set(n.key, n));
    return m;
  }, [pv]);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-black text-white text-sm px-3 py-2 rounded shadow">{toast}</div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Pipeline</div>
          <h2 className="text-xl font-semibold">DAG Manager — v{version}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 text-xs bg-gray-100 border rounded"
            title="What is a DAG?"
            onClick={() => setShowHelp((v) => !v)}
          >{showHelp ? "Hide Help" : "What is a DAG?"}</button>
          <a className="px-3 py-1 bg-gray-200 rounded" href={`/maintenance/pipelines`}>Back</a>
          <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={planRun} disabled={planning}>{planning ? "Planning…" : "Plan (dry-run)"}</button>
          <button className="px-3 py-1 bg-amber-600 text-white rounded" onClick={deriveAndSave} disabled={saving}>{saving ? "Saving…" : "Derive + Save"}</button>
          <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save DAG"}</button>
        </div>
      </div>

      {showHelp && (
        <div className="p-4 border rounded bg-white text-sm space-y-3">
          <div className="font-medium">About DAGs</div>
          <div>
            <div className="mb-1 font-semibold">Purpose</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Define pipeline step ordering and dependencies in a database-driven, auditable format.</li>
              <li>Support conditional execution, retries, timeouts, and parallel groups.</li>
              <li>Keep step code sequence-agnostic — orchestrator enforces order and policies.</li>
            </ul>
          </div>
          <div>
            <div className="mb-1 font-semibold">Key fields</div>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-mono">key</span>: node identifier used in dependencies and runs.</li>
              <li><span className="font-mono">stepVersionId</span>: which Step Version to execute for this node.</li>
              <li><span className="font-mono">dependsOn</span>: array of prerequisite node keys (optional if using edges).</li>
              <li><span className="font-mono">order</span>: optional minimal ordering used as fallback.</li>
              <li><span className="font-mono">condition</span>: safe expression against metrics, e.g. <span className="font-mono">metrics.validate.passed == true</span>.</li>
              <li><span className="font-mono">retries</span>, <span className="font-mono">timeoutMs</span>: resilience controls.</li>
              <li><span className="font-mono">parallelGroup</span>: label to visualize/schedule parallel batches.</li>
            </ul>
          </div>
          <div>
            <div className="mb-1 font-semibold">Example DAG</div>
            <pre className="bg-gray-50 border rounded p-3 overflow-auto text-xs"><code>{JSON.stringify({
  nodes: [
    { key: 'ingest_upload', stepVersionId: 'sv_ingest_v1', params: { source: 'ui' }, order: 1, parallelGroup: 'io' },
    { key: 'split', stepVersionId: 'sv_split_v1', dependsOn: ['ingest_upload'], metricProfileId: 'split_profile_v1', retries: 1, timeoutMs: 30000, order: 2 },
    { key: 'generate_module_a', stepVersionId: 'sv_gen_v2', dependsOn: ['split'], metricProfileId: 'module_profile_v2', parallelGroup: 'gen', order: 3 },
    { key: 'generate_module_b', stepVersionId: 'sv_gen_v2', dependsOn: ['split'], metricProfileId: 'module_profile_v2', parallelGroup: 'gen', order: 3 },
    { key: 'validate', stepVersionId: 'sv_val_v1', dependsOn: ['generate_module_a', 'generate_module_b'], params: { strict: true }, order: 4 },
    { key: 'publish', stepVersionId: 'sv_pub_v1', dependsOn: ['validate'], condition: 'metrics.validate.passed == true', continueOnFail: false, order: 5 }
  ],
  edges: [
    { from: 'ingest_upload', to: 'split' },
    { from: 'split', to: 'generate_module_a' },
    { from: 'split', to: 'generate_module_b' },
    { from: 'generate_module_a', to: 'validate' },
    { from: 'generate_module_b', to: 'validate' },
    { from: 'validate', to: 'publish' }
  ]
}, null, 2)}</code></pre>
          </div>
        </div>
      )}

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {/* Ordered Steps (from plan) */}
      <div className="p-4 border rounded bg-white">
        <div className="font-medium mb-2">Ordered Steps</div>
        {!plan && <div className="text-sm text-gray-500">Run "Plan (dry-run)" to compute execution order.</div>}
        {plan && (
          <ol className="list-decimal list-inside space-y-1">
            {plan.map((k) => {
              const n = nodesByKey.get(k);
              return (
                <li key={k} className="flex items-center gap-2">
                  <span className="font-medium">{k}</span>
                  {n?.parallelGroup && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">pg: {n.parallelGroup}</span>
                  )}
                  {n?.condition && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">cond</span>
                  )}
                  <span className="text-xs text-gray-500">stepVersionId: {n?.stepVersionId || "?"}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* DAG Nodes table */}
      <div className="p-4 border rounded bg-white">
        <div className="font-medium mb-2">Nodes</div>
        {(pv?.dag?.nodes?.length ?? 0) === 0 && <div className="text-sm text-gray-500">No nodes defined.</div>}
        {(pv?.dag?.nodes ?? []).length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="px-2 py-1">Key</th>
                  <th className="px-2 py-1">Step Version</th>
                  <th className="px-2 py-1">Depends On</th>
                  <th className="px-2 py-1">Order</th>
                  <th className="px-2 py-1">Policy</th>
                </tr>
              </thead>
              <tbody>
                {(pv?.dag?.nodes ?? []).map((n) => (
                  <tr key={n.key} className="border-t">
                    <td className="px-2 py-1 font-medium">{n.key}</td>
                    <td className="px-2 py-1">{n.stepVersionId}</td>
                    <td className="px-2 py-1">{(n.dependsOn || []).join(", ")}</td>
                    <td className="px-2 py-1">{n.order ?? ""}</td>
                    <td className="px-2 py-1 space-x-1">
                      {n.condition && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">cond</span>}
                      {typeof n.retries === "number" && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">retries:{n.retries}</span>}
                      {typeof n.timeoutMs === "number" && <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded">timeout:{n.timeoutMs}ms</span>}
                      {n.parallelGroup && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">pg:{n.parallelGroup}</span>}
                      {n.continueOnFail && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">continue</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JSON Editor */}
      <div className="p-4 border rounded bg-white">
        <div className="flex items-center justify-between">
          <div className="font-medium mb-2">DAG JSON</div>
          <button
            className="px-2 py-1 text-xs bg-gray-200 rounded"
            onClick={() => setDagText(JSON.stringify({ nodes: pv?.dag?.nodes ?? [], edges: pv?.dag?.edges ?? [] }, null, 2))}
          >Reset from loaded</button>
        </div>
        <textarea
          className="w-full h-72 font-mono text-xs border rounded p-2"
          value={dagText}
          onChange={(e) => setDagText(e.target.value)}
        />
        <div className="text-xs text-gray-500 mt-2">
          Include nodes with fields like: key, stepVersionId, dependsOn, order, condition, retries, timeoutMs, parallelGroup. Edges are optional if dependsOn is used.
        </div>
      </div>
    </div>
  );
}
