"use client";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Types
type PipelineVersion = { id: string; version: string; isActive: boolean };
type PipelineDef = { id: string; name: string; description?: string; versions: PipelineVersion[] };
type DagEdge = { from: string; to: string };
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
type PV = {
  id: string;
  version: string;
  pipelineId: string;
  dag: { nodes: DagNode[]; edges?: DagEdge[] } | null;
  config?: Record<string, any> | null;
  isActive: boolean;
};
type StepVersion = { id: string; version: string; isActive: boolean };
type StepDef = { id: string; key: string; name?: string; versions: StepVersion[] };

export default function ManageStepsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Data state
  const [pipelines, setPipelines] = useState<PipelineDef[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [version, setVersion] = useState<string>("");
  const [pv, setPv] = useState<PV | null>(null);

  const [nodes, setNodes] = useState<DagNode[]>([]);
  const [edges, setEdges] = useState<DagEdge[]>([]);

  const [steps, setSteps] = useState<StepDef[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  // Modals/state: Add Node
  const [showAddNode, setShowAddNode] = useState(false);
  const [newNodeKey, setNewNodeKey] = useState("");
  const [selStepId, setSelStepId] = useState("");
  const [selStepVersionId, setSelStepVersionId] = useState("");

  // Modals/state: Add Edge
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [edgeFromSel, setEdgeFromSel] = useState("");
  const [edgeToSel, setEdgeToSel] = useState("");

  // Modals/state: Create/Duplicate Version
  const [newVerOpen, setNewVerOpen] = useState(false);
  const [newVerName, setNewVerName] = useState("");
  const [newVerCopy, setNewVerCopy] = useState(true);
  const [newVerErr, setNewVerErr] = useState<string | null>(null);

  // Version load sequence guard
  const versionLoadSeq = useRef(0);

  // Toast helper
  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  function addEdge(from: string, to: string) {
    if (!from || !to) return;
    if (from === to) { showToast("Cannot connect a node to itself"); return; }
    const existsFrom = nodes.some(n => n.key === from);
    const existsTo = nodes.some(n => n.key === to);
    if (!existsFrom || !existsTo) { showToast("Invalid nodes selected"); return; }
    const dup = edges.some(e => e.from === from && e.to === to);
    if (dup) { showToast("Edge already exists"); return; }
    setEdges(prev => [...prev, { from, to }]);
    setDirty(true);
    showToast(`Edge added: ${from} → ${to}`);
  }

  function suggestNextVersion(): string {
    const nums = versions.map(v => Number(v.version)).filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) + 1 : 1);
    return String(next);
  }

  async function createVersion() {
    if (!pipelineId) { setNewVerErr("Select a pipeline"); return; }
    const ver = (newVerName || "").trim();
    if (!ver) { setNewVerErr("Version is required"); return; }
    if (versions.some(v => v.version.toLowerCase() === ver.toLowerCase())) {
      setNewVerErr("Version already exists for this pipeline");
      return;
    }
    try {
      const body: any = { version: ver };
      if (newVerCopy && pv) body.dag = { nodes, edges };
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setNewVerOpen(false); setNewVerName(""); setNewVerCopy(true); setNewVerErr(null);
      await onPipelineChange(pipelineId);
      await onVersionChange(ver);
      showToast('Version created');
    } catch (e: any) {
      setNewVerErr(e?.message || 'Failed to create version');
    }
  }

  async function activateCurrentVersion() {
    if (!pipelineId || !version) return;
    try {
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(version)}/activate`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setVersions(vs => vs.map(v => ({ ...v, isActive: v.version === version })));
      setPv(prev => prev ? { ...prev, isActive: true } as PV : prev);
      showToast('Version activated');
    } catch (e: any) {
      setError(e?.message || 'Failed to activate version');
    }
  }

  // Load pipelines and steps on mount
  useEffect(() => {
    void loadPipelines();
    void loadStepsCatalog();
  }, []);

  // If URL contains params, honor them
  useEffect(() => {
    const pid = searchParams.get("pipelineId") || "";
    const ver = searchParams.get("version") || "";
    if (pid && pid !== pipelineId) {
      (async () => {
        await onPipelineChange(pid);
        if (ver) await onVersionChange(ver, pid);
      })();
    } else if (pid && ver && ver !== version) {
      void onVersionChange(ver);
    }
  }, [searchParams]);

  // Auto-select first pipeline
  useEffect(() => {
    if (!pipelineId && pipelines.length > 0) {
      void onPipelineChange(pipelines[0].id);
    }
  }, [pipelines, pipelineId]);

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

  async function loadStepsCatalog() {
    try {
      const res = await fetch(`/api/admin/pipelines/steps`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setSteps((j.data || []) as StepDef[]);
    } catch (e) {
      console.warn("[ManageSteps] Failed to load steps catalog", e);
    }
  }

  async function onPipelineChange(id: string) {
    setPipelineId(id);
    setVersion("");
    setPv(null);
    setNodes([]);
    setEdges([]);
    setDirty(false);
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(id)}/versions`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || res.statusText);
      const list: PipelineVersion[] = j.data || [];
      setVersions(list);
      const active = list.find((v) => v.isActive) || list[0];
      if (active) {
        setVersion(active.version);
        await onVersionChange(active.version, id);
      }
      // Sync URL
      try {
        const params = new URLSearchParams();
        if (id) params.set("pipelineId", id);
        if (active?.version) params.set("version", active.version);
        router.replace(`${pathname}?${params.toString()}`);
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Failed to load versions");
    }
  }

  async function onVersionChange(v: string, pidArg?: string) {
    const pid = pidArg ?? pipelineId;
    setVersion(v);
    if (!pid || !v) return;
    const seq = ++versionLoadSeq.current;
    try {
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pid)}/versions/${encodeURIComponent(v)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || res.statusText);
      const data = j.data;
      let dag: any = data?.dag ?? data?.config?.dag ?? data?.dagJson ?? data?.config?.dagJson ?? null;
      if (typeof dag === "string") {
        try { dag = JSON.parse(dag); } catch { dag = null; }
      }
      if (seq !== versionLoadSeq.current) return; // stale
      const normalizedPv = { ...data, dag } as PV;
      setPv(normalizedPv);

      let nodesArray: DagNode[] = [];
      if (dag?.nodes) {
        if (Array.isArray(dag.nodes)) nodesArray = dag.nodes as DagNode[];
        else if (typeof dag.nodes === "object") nodesArray = Object.entries(dag.nodes).map(([key, val]: any) => ({ key, ...(val || {}) }));
      } else if (dag?.steps && typeof dag.steps === "object") {
        nodesArray = Object.entries(dag.steps).map(([key, val]: any) => ({ key, ...(val || {}) }));
      }
      setNodes(nodesArray);
      setEdges(Array.isArray(dag?.edges) ? (dag.edges as DagEdge[]) : []);
      setDirty(false);
      // Sync URL
      try {
        const params = new URLSearchParams();
        if (pid) params.set("pipelineId", pid);
        if (v) params.set("version", v);
        router.replace(`${pathname}?${params.toString()}`);
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Failed to load version");
    }
  }

  async function save() {
    if (!pipelineId || !version) {
      setError("Select a pipeline and version before saving");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dag = { nodes, edges };
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(version)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dag }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      showToast("DAG saved");
      setPv((prev) => (prev ? { ...prev, dag } : prev));
      setDirty(false);
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
      showToast("Plan updated node order");
    } catch (e: any) {
      setError(e?.message || "Failed to plan");
    } finally {
      setPlanning(false);
    }
  }

  // Derived
  const nodeKeys = useMemo(() => new Set(nodes.map((n) => n.key)), [nodes]);
  const edgesByFrom = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const e of edges) {
      if (!map[e.from]) map[e.from] = [];
      map[e.from].push(e.to);
    }
    return map;
  }, [edges]);

  // Warn on unsaved changes when leaving
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes.";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function autoChainEdges() {
    if (nodes.length < 2) return;
    const newEdges: DagEdge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i].key;
      const to = nodes[i + 1].key;
      if (!edges.some(e => e.from === from && e.to === to)) newEdges.push({ from, to });
    }
    if (newEdges.length) {
      setEdges(prev => [...prev, ...newEdges]);
      setDirty(true);
      showToast(`Added ${newEdges.length} chain edge(s)`);
    } else {
      showToast("No chain edges to add");
    }
  }

  function clearAllEdges() {
    if (!edges.length) { showToast("No edges to clear"); return; }
    setEdges([]);
    setDirty(true);
    showToast("All edges cleared");
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-gray-900 text-white px-4 py-2 rounded shadow">{toast}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Manage Steps</h2>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={plan}
            disabled={!pipelineId || !version || planning}
            title="Dry-run plan"
          >
            {planning ? "Planning…" : "Dry Run"}
          </button>
          <button
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={() => { setNewVerName(suggestNextVersion()); setNewVerCopy(false); setNewVerOpen(true); setNewVerErr(null); }}
            disabled={!pipelineId}
            title="Create new version"
          >New Ver</button>
          <button
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={() => { setNewVerName(suggestNextVersion()); setNewVerCopy(true); setNewVerOpen(true); setNewVerErr(null); }}
            disabled={!pipelineId || !version}
            title="Duplicate current version"
          >Duplicate</button>
          <button
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={activateCurrentVersion}
            disabled={!pipelineId || !version || versions.find(v => v.version === version)?.isActive}
            title="Activate this version"
          >Activate</button>
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={save}
            disabled={!pipelineId || !version || saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {/* Selectors */}
      <div className="p-4 border rounded bg-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-sm text-gray-600 mb-1">Pipeline</div>
            <select className="w-full border rounded px-2 py-1" value={pipelineId} onChange={(e) => void onPipelineChange(e.target.value)}>
              <option value="">Select…</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Version</div>
            <select className="w-full border rounded px-2 py-1" value={version} onChange={(e) => void onVersionChange(e.target.value)} disabled={!pipelineId}>
              <option value="">Select…</option>
              {versions.map((v) => (
                <option key={v.id} value={v.version}>v{v.version}{v.isActive ? " (active)" : ""}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="text-sm inline-flex items-center gap-2">
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
              Show only active step versions
            </label>
          </div>
        </div>
      </div>

      {/* Nodes table */}
      <div className="p-4 border rounded bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Nodes</div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setShowAddEdge(true)}
              disabled={!pipelineId || !version || nodes.length < 2}
              title="Add edge"
            >Add Edge</button>
            <button
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={autoChainEdges}
              disabled={!pipelineId || !version || nodes.length < 2}
              title="Create edges between consecutive nodes"
            >Auto Chain</button>
            <button
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={clearAllEdges}
              disabled={!pipelineId || !version || edges.length === 0}
              title="Remove all edges"
            >Clear Edges</button>
            <button
              className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={() => setShowAddNode(true)}
              disabled={!pipelineId || !version}
            >Add Node</button>
          </div>
        </div>
        {(!pipelineId || !version) && (
          <div className="text-sm text-gray-500">Select a pipeline and version to edit steps.</div>
        )}
        {pipelineId && version && (
          <Suspense fallback={<div className="text-sm text-gray-500">Loading nodes…</div>}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="px-2 py-1 w-8"></th>
                  <th className="px-2 py-1">Key</th>
                  <th className="px-2 py-1">Step Version</th>
                  <th className="px-2 py-1">Edges</th>
                </tr>
              </thead>
              <tbody>
                {nodes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-gray-500">No nodes in this DAG.</td>
                  </tr>
                )}
                {nodes.map((n, idx) => (
                  <tr
                    key={n.key}
                    className="border-t"
                    draggable
                    onDragStart={() => setDragIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex === null || dragIndex === idx) return;
                      setNodes((arr) => {
                        const copy = [...arr];
                        const [moved] = copy.splice(dragIndex, 1);
                        copy.splice(idx, 0, moved);
                        return copy.map((x, i) => ({ ...x, order: i }));
                      });
                      setDragIndex(null);
                      setDirty(true);
                    }}
                  >
                    <td className="px-2 py-1 text-gray-400 cursor-grab" title="Drag to reorder">⋮⋮</td>
                    <td className="px-2 py-1 font-medium whitespace-nowrap">{n.key}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {(() => {
                        const match = steps.find((s) => (s.versions || []).some((v) => v.id === n.stepVersionId));
                        const sv = match?.versions.find((v) => v.id === n.stepVersionId);
                        return match && sv ? `${match.key} · v${sv.version}${sv.isActive ? " (active)" : ""}` : (n.stepVersionId || "—");
                      })()}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {edgesByFrom[n.key]?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {edgesByFrom[n.key].map((to, i) => (
                            <span key={`${n.key}->${to}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                              <span>→ {to}</span>
                              <button
                                className="ml-1 text-gray-500 hover:text-red-600"
                                title="Remove edge"
                                onClick={() => {
                                  setEdges(prev => prev.filter(e => !(e.from === n.key && e.to === to)));
                                  setDirty(true);
                                }}
                              >×</button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </Suspense>
        )}
      </div>

      {/* Add Node modal */}
      {showAddNode && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-4 w-full max-w-md space-y-3">
            <div className="font-semibold">Add Node</div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Node key</div>
              <input className="w-full border rounded px-2 py-1" value={newNodeKey} onChange={(e)=>setNewNodeKey(e.target.value)} placeholder="unique-key" />
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Step</div>
              <select className="w-full border rounded px-2 py-1" value={selStepId} onChange={(e)=>{ setSelStepId(e.target.value); setSelStepVersionId(""); }}>
                <option value="">Select…</option>
                {steps.map(s => (
                  <option key={s.id} value={s.id}>{s.key}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Step version</div>
              <select className="w-full border rounded px-2 py-1" value={selStepVersionId} onChange={(e)=>setSelStepVersionId(e.target.value)} disabled={!selStepId}>
                <option value="">Select…</option>
                {(steps.find(s => s.id === selStepId)?.versions || [])
                  .filter(v => !activeOnly || v.isActive)
                  .map(v => (
                    <option key={v.id} value={v.id}>v{v.version}{v.isActive ? " (active)" : ""}</option>
                  ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-1 rounded border" onClick={()=>{ setShowAddNode(false); setNewNodeKey(""); setSelStepId(""); setSelStepVersionId(""); }}>Cancel</button>
              <button
                className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                onClick={() => {
                  const key = newNodeKey.trim();
                  if (!key) { showToast("Key is required"); return; }
                  if (nodes.some(n => n.key === key)) { showToast("Key already exists"); return; }
                  if (!selStepVersionId) { showToast("Select a step version"); return; }
                  setNodes(prev => [...prev, { key, stepVersionId: selStepVersionId, order: prev.length }]);
                  setShowAddNode(false); setNewNodeKey(""); setSelStepId(""); setSelStepVersionId("");
                }}
                disabled={!pipelineId || !version}
              >Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Edge modal */}
      {showAddEdge && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-4 w-full max-w-md space-y-3">
            <div className="font-semibold">Add Edge</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-gray-600 mb-1">From</div>
                <select className="w-full border rounded px-2 py-1" value={edgeFromSel} onChange={(e)=>setEdgeFromSel(e.target.value)}>
                  <option value="">Select…</option>
                  {nodes.map(n => (<option key={n.key} value={n.key}>{n.key}</option>))}
                </select>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">To</div>
                <select className="w-full border rounded px-2 py-1" value={edgeToSel} onChange={(e)=>setEdgeToSel(e.target.value)}>
                  <option value="">Select…</option>
                  {nodes.map(n => (<option key={n.key} value={n.key}>{n.key}</option>))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-1 rounded border" onClick={()=>{ setShowAddEdge(false); setEdgeFromSel(""); setEdgeToSel(""); }}>Cancel</button>
              <button
                className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                onClick={() => { addEdge(edgeFromSel, edgeToSel); setShowAddEdge(false); setEdgeFromSel(""); setEdgeToSel(""); }}
                disabled={!pipelineId || !version}
              >Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Duplicate Version modal */}
      {newVerOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-4 w-full max-w-md space-y-3">
            <div className="font-semibold">Create Version</div>
            <div className="text-sm text-gray-600">Provide a version label (e.g. 2 or 2025-08-22)</div>
            <input className="w-full border rounded px-2 py-1" placeholder="version" value={newVerName} onChange={(e)=>setNewVerName(e.target.value)} />
            <label className="text-sm inline-flex items-center gap-2">
              <input type="checkbox" checked={newVerCopy} onChange={(e)=>setNewVerCopy(e.target.checked)} />
              Initialize from current DAG
            </label>
            {newVerErr && <div className="text-sm text-red-600">{newVerErr}</div>}
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-1 rounded border" onClick={()=>{ setNewVerOpen(false); }}>Cancel</button>
              <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={createVersion}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
