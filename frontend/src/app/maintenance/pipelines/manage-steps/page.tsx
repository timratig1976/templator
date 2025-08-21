"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type PipelineVersion = { id: string; version: string; isActive: boolean };

type PipelineDef = {
  id: string;
  name: string;
  description?: string;
  versions: PipelineVersion[];
};

type DagNode = {
  key: string;
  stepVersionId?: string;
  dependsOn?: string[];
  order?: number;
  condition?: string;
  retries?: number;
  timeoutMs?: number;
  parallelGroup?: string;
  params?: Record<string, any>;
  metricProfileId?: string;
};

type DagEdge = { from: string; to: string };

type PV = {
  id: string;
  version: string;
  pipelineId: string;
  dag: { nodes: DagNode[]; edges?: DagEdge[] } | null;
  config?: Record<string, any> | null;
  isActive: boolean;
};

export default function ManageStepsPage() {
  const searchParams = useSearchParams();
  const [pipelines, setPipelines] = useState<PipelineDef[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [version, setVersion] = useState<string>("");

  const [pv, setPv] = useState<PV | null>(null);
  const [nodes, setNodes] = useState<DagNode[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  async function loadPipelines() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pipelines/pipelines`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setPipelines(j.data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  }

  async function onPipelineChange(id: string) {
    setPipelineId(id);
    setVersion("");
    setPv(null);
    setNodes([]);
    if (!id) return;
    const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(id)}/versions`);
    const j = await res.json();
    if (!res.ok) {
      showToast(j?.error || res.statusText);
      return;
    }
    setVersions(j.data || []);
  }

  async function onVersionChange(v: string) {
    setVersion(v);
    setPv(null);
    setNodes([]);
    if (!pipelineId || !v) return;
    const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(v)}`);
    const j = await res.json();
    if (!res.ok) {
      showToast(j?.error || res.statusText);
      return;
    }
    const data = j.data;
    // normalize dag shape: could be object, JSON string, or nested under config
    let dag: any = data?.dag ?? data?.config?.dag ?? data?.dagJson ?? data?.config?.dagJson ?? null;
    if (typeof dag === "string") {
      try { dag = JSON.parse(dag); } catch { dag = null; }
    }
    const normalizedPv = { ...data, dag } as PV;
    setPv(normalizedPv);

    // Normalize nodes: accept array, or object map under dag.nodes or dag.steps
    let nodesArray: DagNode[] = [];
    if (dag?.nodes) {
      if (Array.isArray(dag.nodes)) {
        nodesArray = dag.nodes as DagNode[];
      } else if (typeof dag.nodes === "object") {
        nodesArray = Object.entries(dag.nodes as Record<string, any>).map(([key, val]) => ({ key, ...(val || {}) }));
      }
    } else if (dag?.steps && typeof dag.steps === "object") {
      nodesArray = Object.entries(dag.steps as Record<string, any>).map(([key, val]) => ({ key, ...(val || {}) }));
    }
    setNodes(nodesArray);
  }

  function updateNode(idx: number, patch: Partial<DagNode>) {
    setNodes((arr) => arr.map((n, i) => (i === idx ? { ...n, ...patch } : n)));
  }

  function setDependsInline(idx: number, value: string) {
    const deps = value.split(",").map((s) => s.trim()).filter(Boolean);
    updateNode(idx, { dependsOn: deps });
  }

  async function save() {
    if (!pv) return;
    setSaving(true);
    setError(null);
    try {
      const dag = { nodes, edges: pv.dag?.edges || [] };
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(version)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dag }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      showToast("DAG saved");
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function plan() {
    if (!pipelineId || !version) return;
    setPlanning(true);
    try {
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(version)}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || res.statusText);
      const orderIndex: Record<string, number> = {};
      (j.data?.plan || []).forEach((k: string, i: number) => (orderIndex[k] = i + 1));
      setNodes((arr) => arr.map((n) => ({ ...n, order: orderIndex[n.key] ?? n.order })));
      showToast("Plan generated and order updated");
    } catch (e: any) {
      setError(e?.message || "Failed to plan");
    } finally {
      setPlanning(false);
    }
  }

  useEffect(() => { loadPipelines(); }, []);

  // Initialize from query params if provided
  useEffect(() => {
    const qp = searchParams?.get("pipelineId") || "";
    const qv = searchParams?.get("version") || "";
    if (qp) {
      onPipelineChange(qp).then(() => {
        if (qv) {
          // slight delay to ensure versions state is set
          setTimeout(() => onVersionChange(qv), 0);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const pipelineOptions = useMemo(() => pipelines.map((p) => ({ id: p.id, name: p.name })), [pipelines]);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-black text-white text-sm px-3 py-2 rounded shadow">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Manage Steps</h2>
        <div className="flex items-center gap-2">
          <a className="px-3 py-1 bg-gray-200 rounded" href="/maintenance/pipelines">Back to Pipelines</a>
          <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={plan} disabled={!pipelineId || !version || planning}>{planning ? "Planning…" : "Plan (dry-run)"}</button>
          <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={save} disabled={!pv || saving}>{saving ? "Saving…" : "Save Changes"}</button>
        </div>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      <div className="p-4 border rounded bg-white space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-sm text-gray-600 mb-1">Pipeline</div>
            <select className="w-full border rounded px-2 py-1" value={pipelineId} onChange={(e) => onPipelineChange(e.target.value)}>
              <option value="">Select…</option>
              {pipelineOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Version</div>
            <select className="w-full border rounded px-2 py-1" value={version} onChange={(e) => onVersionChange(e.target.value)} disabled={!pipelineId}>
              <option value="">Select…</option>
              {versions.map((v) => (
                <option key={v.id} value={v.version}>v{v.version}{v.isActive ? " (active)" : ""}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="p-4 border rounded bg-white">
        <div className="font-medium mb-2">Nodes for selected pipeline/version</div>
        {(!pipelineId || !version) && <div className="text-sm text-gray-500">Select a pipeline and version to edit steps.</div>}
        {pipelineId && version && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="px-2 py-1">Key</th>
                  <th className="px-2 py-1">Step Version ID</th>
                  <th className="px-2 py-1">Depends On</th>
                  <th className="px-2 py-1">Order</th>
                  <th className="px-2 py-1">Condition</th>
                  <th className="px-2 py-1">Policy</th>
                </tr>
              </thead>
              <tbody>
                {nodes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-gray-500">No nodes found in this version's DAG.</td>
                  </tr>
                )}
                {nodes.map((n, idx) => (
                  <tr key={n.key} className="border-t align-top">
                    <td className="px-2 py-1 font-medium whitespace-nowrap">{n.key}</td>
                    <td className="px-2 py-1">
                      <input className="border rounded px-2 py-1 w-64" placeholder="stepVersionId" value={n.stepVersionId || ""} onChange={(e) => updateNode(idx, { stepVersionId: e.target.value })} />
                    </td>
                    <td className="px-2 py-1">
                      <input className="border rounded px-2 py-1 w-56" placeholder="a,b,c" value={(n.dependsOn || []).join(", ")} onChange={(e) => setDependsInline(idx, e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <input className="border rounded px-2 py-1 w-20" type="number" value={typeof n.order === "number" ? n.order : ""} onChange={(e) => updateNode(idx, { order: e.target.value ? Number(e.target.value) : undefined })} />
                    </td>
                    <td className="px-2 py-1">
                      <input className="border rounded px-2 py-1 w-64" placeholder="metrics.validate.passed == true" value={n.condition || ""} onChange={(e) => updateNode(idx, { condition: e.target.value })} />
                    </td>
                    <td className="px-2 py-1 space-x-1 whitespace-nowrap">
                      <input className="border rounded px-2 py-1 w-20" type="number" placeholder="retries" value={typeof n.retries === "number" ? n.retries : ""} onChange={(e) => updateNode(idx, { retries: e.target.value ? Number(e.target.value) : undefined })} />
                      <input className="border rounded px-2 py-1 w-28" type="number" placeholder="timeoutMs" value={typeof n.timeoutMs === "number" ? n.timeoutMs : ""} onChange={(e) => updateNode(idx, { timeoutMs: e.target.value ? Number(e.target.value) : undefined })} />
                      <input className="border rounded px-2 py-1 w-28" placeholder="parallelGroup" value={n.parallelGroup || ""} onChange={(e) => updateNode(idx, { parallelGroup: e.target.value })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
