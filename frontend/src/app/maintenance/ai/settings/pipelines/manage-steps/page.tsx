"use client";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

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

type StepVersion = { id: string; version: string; isActive: boolean };
type StepDef = { id: string; key: string; name?: string; versions: StepVersion[] };

function ManageStepsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pipelines, setPipelines] = useState<PipelineDef[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [version, setVersion] = useState<string>("");

  const [pv, setPv] = useState<PV | null>(null);
  const [nodes, setNodes] = useState<DagNode[]>([]);
  const [edges, setEdges] = useState<DagEdge[]>([]);

  // Steps catalog (from DB) for unified DAG node creation
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [showAddNode, setShowAddNode] = useState(false);
  const [newNode, setNewNode] = useState<Partial<DagNode>>({ key: "", stepVersionId: "" });
  const [activeOnly, setActiveOnly] = useState(true);
  // Quick Add Edge modal state
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [edgeFromSel, setEdgeFromSel] = useState<string>("");
  const [edgeToSel, setEdgeToSel] = useState<string>("");

  // Advanced editor modal state
  const [advancedIdx, setAdvancedIdx] = useState<number | null>(null);
  const [advancedParamsText, setAdvancedParamsText] = useState<string>("{}");
  const [advancedMetricProfileId, setAdvancedMetricProfileId] = useState<string>("");
  const [advancedIrSchemas, setAdvancedIrSchemas] = useState<Array<{ id: string; name: string; version: string; isActive: boolean }>>([]);
  const [advancedIrSchemaId, setAdvancedIrSchemaId] = useState<string>("");
  // Prompt binding fields (stored under params.promptsRef)
  const [advancedPromptId, setAdvancedPromptId] = useState<string>("");
  const [advancedPromptVersion, setAdvancedPromptVersion] = useState<string>("");

  // Advanced params form mode and rows (dot-notation for nesting)
  type ParamRow = { key: string; value: string; type: "string" | "number" | "boolean" | "json" };
  const [advancedMode, setAdvancedMode] = useState<"form" | "json">("form");
  const [advancedRows, setAdvancedRows] = useState<ParamRow[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Per-gap Edge pill drag state: source node key when dragging a pill
  const [edgePillFrom, setEdgePillFrom] = useState<string | null>(null);
  // Highlight target row while dragging a pill
  const [edgeHoverTarget, setEdgeHoverTarget] = useState<string | null>(null);
  // Legacy Connect Mode removed

  // Suggest next version label by auto-incrementing the highest numeric version
  function suggestNextVersion(): string {
    const nums = versions
      .map(v => Number(v.version))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) + 1 : 1);
    return String(next);
  }

  // Require a confirmation click (with toast) before saving
  const [saveConfirmReady, setSaveConfirmReady] = React.useState(false);
  function onSaveClick() {
    if (!pipelineId || !version) {
      showToast('Select a pipeline and version before saving');
      return;
    }
    if (!saveConfirmReady) {
      setSaveConfirmReady(true);
      showToast('Click Save again within 5s to confirm');
      // Auto-expire the confirmation window after 5 seconds
      window.setTimeout(() => setSaveConfirmReady(false), 5000);
      return;
    }
    // Proceed with the actual save
    save();
    // Reset confirmation state (in case save short-circuits)
    setSaveConfirmReady(false);
  }

  function addEdge(from: string, to: string) {
    if (!pipelineId || !version) { showToast('Select a pipeline and version first'); return; }
    if (!from || !to) { showToast('Select both source and target'); return; }
    if (from === to) { showToast('Cannot connect a step to itself'); return; }
    const existsFrom = nodes.some(n => n.key === from);
    const existsTo = nodes.some(n => n.key === to);
    if (!existsFrom || !existsTo) { showToast('Invalid nodes selected'); return; }
    const dup = edges.some(e => e.from === from && e.to === to);
    if (dup) { showToast('Edge already exists'); return; }
    setEdges(prev => [...prev, { from, to }]);
    showToast(`Edge added: ${from} → ${to}`);
  }

  // Bulk connect all nodes sequentially: node[i] -> node[i+1]
  function bulkConnectSequential() {
    if (!pipelineId || !version) { showToast('Select a pipeline and version first'); return; }
    if (nodes.length < 2) { showToast('Need at least two nodes to connect'); return; }
    // Build a set of existing edges for O(1) lookup
    const existing = new Set(edges.map(e => `${e.from}|${e.to}`));
    const additions: DagEdge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i].key;
      const to = nodes[i + 1].key;
      if (from && to && from !== to) {
        const key = `${from}|${to}`;
        if (!existing.has(key)) {
          additions.push({ from, to });
          existing.add(key);
        }
      }
    }
    if (additions.length === 0) {
      showToast('All consecutive pairs already connected');
      return;
    }
    setEdges(prev => [...prev, ...additions]);
    console.log('[ManageSteps] Bulk connected sequential pairs', additions);
    showToast(`Added ${additions.length} sequential edge${additions.length === 1 ? '' : 's'}`);
  }
  function objectToDotEntries(obj: any, prefix = ""): ParamRow[] {
    if (obj == null || typeof obj !== "object" || Array.isArray(obj)) {
      const type = typeof obj === "number" ? "number" : typeof obj === "boolean" ? "boolean" : typeof obj === "object" ? "json" : "string";
      return [{ key: prefix || "", value: prefix ? JSON.stringify(obj) : String(obj ?? ""), type: type === "string" ? "string" : (type as any) }].filter(r => r.key);
    }
    const rows: ParamRow[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (v != null && typeof v === "object" && !Array.isArray(v)) {
        rows.push(...objectToDotEntries(v, full));
      } else {
        let type: ParamRow["type"] = "string";
        if (typeof v === "number") type = "number";
        else if (typeof v === "boolean") type = "boolean";
        else if (typeof v === "object") type = "json";
        const valStr = type === "json" ? JSON.stringify(v) : String(v ?? "");
        rows.push({ key: full, value: valStr, type });
      }
    }
    return rows;
  }

  async function activateCurrentVersion() {
    if (!pipelineId || !version) return;
    try {
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(version)}/activate`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      // Update local versions state to reflect activation
      setVersions((vs) => vs.map(v => ({ ...v, isActive: v.version === version })));
      setPv((prev) => prev ? { ...prev, isActive: true } as PV : prev);
      showToast('Version activated');
    } catch (e: any) {
      setError(e?.message || 'Failed to activate version');
    }
  }

  // Initial load for pipelines and steps
  useEffect(() => {
    console.log("[ManageSteps] Mount: loading pipelines and steps");
    loadPipelines();
    loadStepsCatalog();
  }, []);

  // Auto-select first pipeline if none selected after pipelines load
  useEffect(() => {
    if (!pipelineId && pipelines.length > 0) {
      const qp = searchParams.get("pipelineId") || "";
      if (!qp) {
        void onPipelineChange(pipelines[0].id);
      }
    }
  }, [pipelines, pipelineId, searchParams]);

  // Honor URL params (?pipelineId=...&version=...)
  useEffect(() => {
    const pid = searchParams.get("pipelineId") || "";
    const ver = searchParams.get("version") || "";
    if (pid && pid !== pipelineId) {
      (async () => {
        await onPipelineChange(pid);
        if (ver) await onVersionChange(ver);
      })();
    } else if (pid && ver && ver !== version) {
      // same pipeline, different version
      onVersionChange(ver);
    }
  }, [searchParams]);

  function dotEntriesToObject(rows: ParamRow[]): any {
    const root: any = {};
    for (const r of rows) {
      if (!r.key) continue;
      const parts = r.key.split(".");
      let cur = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!(p in cur) || typeof cur[p] !== "object" || Array.isArray(cur[p])) cur[p] = {};
        cur = cur[p];
      }
      const leaf = parts[parts.length - 1];
      let val: any = r.value;
      if (r.type === "number") val = r.value === "" ? undefined : Number(r.value);
      else if (r.type === "boolean") val = r.value === "true";
      else if (r.type === "json") {
        try { val = r.value ? JSON.parse(r.value) : undefined; } catch { val = undefined; }
      }
      if (val !== undefined) cur[leaf] = val;
    }
    return root;
  }

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Version management UI state
  const [newVerOpen, setNewVerOpen] = useState(false);
  const [newVerName, setNewVerName] = useState("");
  const [newVerCopy, setNewVerCopy] = useState(true);
  const [newVerErr, setNewVerErr] = useState<string | null>(null);

  

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
      // non-fatal: keep UI usable even if steps fail to load
      console.warn("Failed to load steps catalog", e);
    }
  }

  async function onPipelineChange(id: string) {
    setPipelineId(id);
    setVersion("");
    setPv(null);
    setNodes([]);
    setEdges([]);
    if (!id) return;
    const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(id)}/versions`);
    const j = await res.json();
    if (!res.ok) {
      showToast(j?.error || res.statusText);
      return;
    }
    const list: PipelineVersion[] = j.data || [];
    setVersions(list);
    // Auto-select active version (or first) to trigger GET on page load
    const active = list.find(v => v.isActive) || list[0];
    if (active) {
      setVersion(active.version);
      await onVersionChange(active.version, id);
    }
  }

  const versionLoadSeq = useRef(0);

  async function onVersionChange(v: string, pidArg?: string) {
    const pid = pidArg ?? pipelineId;
    setVersion(v);
    if (!pid || !v) return;
    const seq = ++versionLoadSeq.current;
    const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pid)}/versions/${encodeURIComponent(v)}`);
    const j = await res.json();
    if (!res.ok) {
      showToast(j?.error || res.statusText);
      return;
    }
    const data = j.data;
    console.log("[ManageSteps] Loaded version", { pipelineId: pid, version: v, raw: data });
    // normalize dag shape: could be object, JSON string, or nested under config
    let dag: any = data?.dag ?? data?.config?.dag ?? data?.dagJson ?? data?.config?.dagJson ?? null;
    if (typeof dag === "string") {
      try { dag = JSON.parse(dag); } catch { dag = null; }
    }
    if (seq !== versionLoadSeq.current) return; // stale
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
    console.log("[ManageSteps] Normalized DAG", { nodes: nodesArray, edges: dag?.edges });
    if (seq === versionLoadSeq.current) setNodes(nodesArray);
    if (seq === versionLoadSeq.current) setEdges(Array.isArray(dag?.edges) ? (dag.edges as DagEdge[]) : []);
  }

  // Create a new pipeline version (optionally copy current DAG)
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
      if (newVerCopy && pv) {
        body.dag = { nodes, edges };
        if (pv.config) body.config = pv.config;
      } else {
        body.dag = { nodes: [], edges: [] };
      }
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      setNewVerOpen(false);
      setNewVerName("");
      setNewVerCopy(true);
      await onPipelineChange(pipelineId);
      await onVersionChange(ver);
      showToast('Version created');
    } catch (e: any) {
      setNewVerErr(e?.message || 'Failed to create version');
    }
  }

  function updateNode(idx: number, patch: Partial<DagNode>) {
    setNodes((arr) => arr.map((n, i) => (i === idx ? { ...n, ...patch } : n)));
  }

  function setDependsInline(idx: number, value: string) {
    const deps = value.split(",").map((s) => s.trim()).filter(Boolean);
    updateNode(idx, { dependsOn: deps });
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
      // Diagnostics: surface action in DevTools
      console.log("[ManageSteps] Save clicked", { pipelineId, version, nodes: nodes.length });
      console.log("[ManageSteps] Saving DAG", { pipelineId, version, nodes: nodes.length, edges: dag.edges?.length || 0 });
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(version)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dag }),
      });
      const j = await res.json().catch(() => ({}));
      console.log("[ManageSteps] Save response", { status: res.status, ok: res.ok, body: j });
      if (!res.ok) throw new Error(j?.error || res.statusText);
      showToast("DAG saved");
      // Keep local PV in sync so button state and UI reflect saved DAG
      setPv((prev) => (prev ? { ...prev, dag } : prev));
      // Re-fetch from server to confirm persistence and load any server-side defaults
      try {
        const res2 = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions/${encodeURIComponent(version)}`);
        const j2 = await res2.json();
        if (res2.ok) {
          const data2 = j2.data;
          let dag2: any = data2?.dag ?? data2?.config?.dag ?? null;
          if (typeof dag2 === 'string') { try { dag2 = JSON.parse(dag2); } catch {} }
          setPv({ ...data2, dag: dag2 });
          let nodesArray2: DagNode[] = [];
          if (dag2?.nodes) {
            nodesArray2 = Array.isArray(dag2.nodes) ? dag2.nodes : Object.entries(dag2.nodes).map(([key, val]: any) => ({ key, ...(val || {}) }));
          } else if (dag2?.steps && typeof dag2.steps === 'object') {
            nodesArray2 = Object.entries(dag2.steps as Record<string, any>).map(([key, val]) => ({ key, ...(val || {}) }));
          }
          setNodes(nodesArray2);
          setEdges(Array.isArray(dag2?.edges) ? (dag2.edges as DagEdge[]) : []);
          console.debug('[ManageSteps] Post-save reloaded DAG', { nodes: nodesArray2.length });
        }
      } catch (e) {
        console.warn('[ManageSteps] Failed to reload version after save', e);
      }
    } catch (e: any) {
      console.error("[ManageSteps] Save failed", e);
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

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50" role="status" aria-live="polite">
          <div className="pointer-events-auto flex items-center gap-2 bg-gray-900/95 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg ring-1 ring-black/10">
            {/* Check icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-400">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-2.59a.75.75 0 10-1.22-.9l-3.53 4.79-1.66-1.66a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.14-.09l3.08-4.46z" clipRule="evenodd" />
            </svg>
            <span className="whitespace-pre-line">{toast}</span>
            <button
              type="button"
              className="ml-1 -mr-1 rounded p-1 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
              aria-label="Close toast"
              onClick={() => setToast(null)}
            >
              <span className="block leading-none">×</span>
            </button>
          </div>
        </div>
      )}

    {/* Quick Add Edge modal */}
    {showAddEdge && (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white rounded shadow p-4 w-full max-w-md space-y-3">
          <div className="font-semibold">Add Edge</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-600 mb-1">From</div>
              <select
                className="border rounded px-2 py-1 w-full"
                value={edgeFromSel}
                onChange={(e) => setEdgeFromSel(e.target.value)}
                disabled={!pipelineId || !version || nodes.length === 0}
              >
                <option value="">Select node…</option>
                {nodes.map((n) => (
                  <option key={n.key} value={n.key}>{n.key}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">To</div>
              <select
                className="border rounded px-2 py-1 w-full"
                value={edgeToSel}
                onChange={(e) => setEdgeToSel(e.target.value)}
                disabled={!pipelineId || !version || nodes.length === 0}
              >
                <option value="">Select node…</option>
                {nodes.map((n) => (
                  <option key={n.key} value={n.key}>{n.key}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Existing edges list removed per request; edge deletion handled elsewhere */}
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => { setShowAddEdge(false); setEdgeFromSel(""); setEdgeToSel(""); }}>Cancel</button>
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
              onClick={() => { addEdge(edgeFromSel.trim(), edgeToSel.trim()); setShowAddEdge(false); setEdgeFromSel(""); setEdgeToSel(""); }}
              disabled={!pipelineId || !version || !edgeFromSel || !edgeToSel}
            >Add</button>
          </div>
        </div>
      </div>
    )}

    {/* Draggable canvas removed */}

     {/* Create/Duplicate Version Modal */}
     {newVerOpen && (
       <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
         <div className="bg-white rounded shadow p-4 w-full max-w-md space-y-3">
           <div className="font-semibold">Create Version</div>
           <div className="text-sm text-gray-600">Pipeline versions let you safely evolve DAGs. Choose a version label (e.g. v2, 2025-08-21).</div>
           <input className="border rounded px-2 py-1 w-full" placeholder="Version label" value={newVerName} onChange={(e)=>setNewVerName(e.target.value)} />
           <label className="text-sm inline-flex items-center gap-2">
             <input type="checkbox" checked={newVerCopy} onChange={(e)=>setNewVerCopy(e.target.checked)} />
             Initialize from current version's DAG
           </label>
           {newVerErr && <div className="text-sm text-red-600">{newVerErr}</div>}
           <div className="flex gap-2 justify-end">
             <button className="px-3 py-1 bg-gray-200 rounded" onClick={()=>{ setNewVerOpen(false); }}>Cancel</button>
             <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={createVersion}>Create</button>
           </div>
         </div>
       </div>
     )}

     {/* Page title */}
    {/* Removed local page title to rely on layout-level headline */}

    {/* Legacy Connect mode removed in favor of draggable overlay */}

     {/* Quick debug and tips */}
     <div className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 inline-flex gap-3">
       <div><span className="font-medium">pipelineId:</span> {pipelineId || '-'}</div>
       <div><span className="font-medium">version:</span> {version || '-'}</div>
       <div><span className="font-medium">nodes:</span> {nodes.length}</div>
       <div><span className="font-medium">steps loaded:</span> {steps.length}</div>
     </div>
     {error && <div className="text-red-600">{error}</div>}
     {!pv && (pipelineId || version) && (
       <div className="text-xs text-gray-600">Tip: choose both Pipeline and Version to enable saving.</div>
     )}

     {/* Pipeline/Version selectors with icon actions */}
    <div className="p-4 border rounded bg-white">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
          <div>
            <div className="text-sm text-gray-600 mb-1">Pipeline</div>
            <select className="w-full border rounded px-2 py-1" value={pipelineId} onChange={(e) => onPipelineChange(e.target.value)}>
              <option value="">Select…</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Version</div>
            <select className="w-full border rounded px-2 py-1" value={version} onChange={(e) => onVersionChange(e.target.value)} disabled={!pipelineId}>
              <option value="">Select…</option>
              {versions.map((v) => (
                <option key={v.id} value={v.version}>v{v.version}{v.isActive ? ' (active)' : ''}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button
              className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50"
              onClick={() => { setNewVerName(suggestNextVersion()); setNewVerCopy(false); setNewVerErr(null); setNewVerOpen(true); }}
              disabled={!pipelineId}
              title={!pipelineId ? 'Select a pipeline first' : 'Create new version'}
              aria-label="New Version"
            >
              <span role="img" aria-hidden className="block">➕</span>
            </button>
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 text-xs bg-black text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">New version</span>
          </div>
          <div className="relative group">
            <button
              className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50"
              onClick={() => { setNewVerName(suggestNextVersion()); setNewVerCopy(true); setNewVerErr(null); setNewVerOpen(true); }}
              disabled={!pipelineId || !version}
              title={!pipelineId || !version ? 'Select a pipeline and version' : 'Duplicate current version'}
              aria-label="Duplicate Version"
            >
              <span role="img" aria-hidden className="block">📄</span>
            </button>
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 text-xs bg-black text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">Duplicate version</span>
          </div>
          <div className="relative group">
            <button
              className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50"
              onClick={activateCurrentVersion}
              disabled={!pipelineId || !version || versions.find(v => v.version === version)?.isActive}
              title="Activate this version"
              aria-label="Activate Version"
            >
              <span role="img" aria-hidden className="block">⚡</span>
            </button>
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 text-xs bg-black text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">Activate version</span>
          </div>
          <div className="relative group">
            <button
              className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50"
              onClick={plan}
              disabled={!pipelineId || !version || planning}
              title="Start Dry Run"
              aria-label="Start Dry Run"
            >
              <span role="img" aria-hidden className="block">{planning ? '⏳' : '🧪'}</span>
            </button>
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 text-xs bg-black text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">Start dry run</span>
          </div>
          <div className="relative group">
            <button
              className="p-2 rounded border hover:bg-gray-50 disabled:opacity-50"
              onClick={() => {
                const qp = new URLSearchParams();
                if (pipelineId) qp.set("pipelineId", pipelineId);
                if (version) qp.set("version", version);
                router.push(`/maintenance/pipelines/runs${qp.toString() ? `?${qp.toString()}` : ''}`);
              }}
              disabled={!pipelineId}
              title={!pipelineId ? 'Select a pipeline first' : 'View recent runs'}
              aria-label="Recent Runs"
            >
              <span role="img" aria-hidden className="block">🕓</span>
            </button>
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 text-xs bg-black text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">Recent runs</span>
          </div>
        </div>
      </div>
    </div>

     {/* Nodes editor */}
    <div className="p-4 border rounded bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">Nodes for selected pipeline/version</div>
        <div className="flex items-center gap-3">
          <label className="text-sm inline-flex items-center gap-2">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            Show only active step versions
          </label>
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
            onClick={() => { setEdgePillFrom(null); setEdgeHoverTarget(null); setShowAddNode(true); }}
            disabled={!pipelineId || !version}
          >Add Node</button>
          <button
            type="button"
            className="p-1.5 rounded border bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50"
            onClick={(e) => {
              setEdgePillFrom(null);
              setEdgeHoverTarget(null);
              // Alt/Cmd opens manual Add Edge dialog; default does bulk connect sequential
              if (e.altKey || e.metaKey) {
                setShowAddEdge(true);
              } else {
                bulkConnectSequential();
              }
            }}
            disabled={!pipelineId || !version}
            title="Bulk connect sequential (Alt/Cmd: open manual Add Edge)"
            aria-label="Bulk connect sequential"
          >
            {/* Link icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M13.06 7.94a3.5 3.5 0 010 4.95l-1.06 1.06a3.5 3.5 0 11-4.95-4.95l1.06-1.06a.75.75 0 011.06 1.06l-1.06 1.06a2 2 0 102.83 2.83l1.06-1.06a2 2 0 00-2.83-2.83.75.75 0 11-1.06-1.06 3.5 3.5 0 014.95 0z" />
              <path d="M10.94 16.06a3.5 3.5 0 010-4.95l1.06-1.06a3.5 3.5 0 114.95 4.95l-1.06 1.06a.75.75 0 11-1.06-1.06l1.06-1.06a2 2 0 10-2.83-2.83l-1.06 1.06a2 2 0 002.83 2.83.75.75 0 111.06 1.06 3.5 3.5 0 01-4.95 0z" />
            </svg>
          </button>
          {edgePillFrom && (
            <div className="ml-2 px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200" role="status" title="Tip: Hold Alt/Option to reverse the direction on drop">
              Connecting from <span className="font-medium">{edgePillFrom}</span> — drop on a target row (Alt to reverse)
            </div>
          )}
        </div>
      </div>
      {(!pipelineId || !version) && <div className="text-sm text-gray-500">Select a pipeline and version to edit steps.</div>}
      {pipelineId && version && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="px-2 py-1 w-8"></th>
                <th className="px-2 py-1">Key</th>
                <th className="px-2 py-1">Step Version</th>
                <th className="px-2 py-1">Edges</th>
                <th className="px-2 py-1 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {nodes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-gray-500">No nodes found in this version's DAG.</td>
                </tr>
              )}
              {nodes.map((n, idx) => (
                <React.Fragment key={n.key}>
                  <tr
                    className={`border-t align-middle ${edgeHoverTarget === n.key ? 'bg-blue-50 ring-2 ring-blue-300' : ''}`}
                    draggable
                    onDragStart={() => setDragIndex(idx)}
                    onDragOver={(e) => {
                      // Accept drop for either edge pill or row reorder
                      e.preventDefault();
                      if (edgePillFrom) setEdgeHoverTarget(n.key);
                    }}
                    onDragEnter={() => {
                      if (edgePillFrom) setEdgeHoverTarget(n.key);
                    }}
                    onDragLeave={() => {
                      if (edgeHoverTarget === n.key) setEdgeHoverTarget(null);
                    }}
                    onDrop={(e) => {
                      if (edgePillFrom) {
                        const alt = e.altKey || e.metaKey; // support Option/Alt (and Cmd as fallback)
                        const src = edgePillFrom;
                        const dst = n.key;
                        if (src !== dst) {
                          if (alt) {
                            addEdge(dst, src);
                          } else {
                            addEdge(src, dst);
                          }
                        }
                        setEdgePillFrom(null);
                        setEdgeHoverTarget(null);
                        return;
                      }
                      if (dragIndex === null || dragIndex === idx) return;
                      setNodes((arr) => {
                        const copy = [...arr];
                        const [moved] = copy.splice(dragIndex, 1);
                        copy.splice(idx, 0, moved);
                        return copy.map((x, i) => ({ ...x, order: i }));
                      });
                      setDragIndex(null);
                    }}
                  >
                    <td className="px-2 py-1 text-gray-400 cursor-grab" title="Drag to reorder">⋮⋮</td>
                    <td className="px-2 py-1 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {n.key}
                        {(() => {
                          const nextKey = nodes[idx + 1]?.key;
                          const isConnectedNext = !!(nextKey && edges.some(e => e.from === n.key && e.to === nextKey));
                          return isConnectedNext ? (
                            <span className="inline-flex items-center text-blue-600" title={`Connected to next: ${nextKey}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h9.586l-3.293-3.293A1 1 0 1111 4.293l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L13.586 11H4a1 1 0 01-1-1z" clipRule="evenodd" />
                              </svg>
                            </span>
                          ) : null;
                        })()}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {(() => {
                        const match = steps.find(s => (s.versions || []).some(v => v.id === n.stepVersionId));
                        const sv = match?.versions.find(v => v.id === n.stepVersionId);
                        return match && sv ? `${match.key} · v${sv.version}${sv.isActive ? ' (active)' : ''}` : (n.stepVersionId ? n.stepVersionId : '—');
                      })()}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap max-w-sm">
                      <div className="flex items-center gap-2 mb-1 select-none">
                        {idx < nodes.length - 1 ? (
                          <label
                            className="inline-flex items-center gap-1 text-xs text-gray-600"
                            title="Connect this node to the next row"
                            onPointerDown={(e) => { e.stopPropagation(); }}
                            onMouseDown={(e) => { e.stopPropagation(); }}
                          >
                            {(() => {
                              const nextKey = nodes[idx + 1]?.key;
                              const isConnected = !!(nextKey && edges.some((e) => e.from === n.key && e.to === nextKey));
                              return (
                                <>
                                  <input
                                    type="checkbox"
                                    className="align-middle"
                                    checked={isConnected}
                                    onChange={(ev) => {
                                      ev.stopPropagation();
                                      const nk = nodes[idx + 1]?.key;
                                      if (!nk) return;
                                      if (ev.target.checked) {
                                        if (!edges.some(e => e.from === n.key && e.to === nk)) addEdge(n.key, nk);
                                      } else {
                                        setEdges(prev => prev.filter(e => !(e.from === n.key && e.to === nk)));
                                        showToast(`Edge removed: ${n.key} → ${nk}`);
                                      }
                                    }}
                                  />
                                  <span>Connect to next node</span>
                                </>
                              );
                            })()}
                          </label>
                        ) : (
                          <span className="text-xs text-gray-400" title="No next row">No next node</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const nextKey = nodes[idx + 1]?.key;
                          return edges
                            .filter(e => e.from === n.key && e.to !== nextKey) // hide the "next" edge chip; icon above reflects it
                            .map((e, i) => (
                          <span key={`${n.key}->${e.to}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                            <span className="font-mono">{e.to}</span>
                            <button
                              type="button"
                              draggable={false}
                              title={`Remove edge ${n.key} → ${e.to}`}
                              aria-label={`Remove edge ${n.key} to ${e.to}`}
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 cursor-pointer pointer-events-auto relative z-10"
                              onPointerDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                              onMouseDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                              onDragStart={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                              onClick={(ev) => {
                                ev.preventDefault(); ev.stopPropagation();
                                console.log('[ManageSteps] Removing edge', { from: n.key, to: e.to });
                                setEdges(prev => prev.filter(x => !(x.from === n.key && x.to === e.to)));
                                showToast(`Edge removed: ${n.key} → ${e.to}`);
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(ev) => {
                                if (ev.key === 'Enter' || ev.key === ' ') {
                                  ev.preventDefault(); ev.stopPropagation();
                                  console.log('[ManageSteps] Removing edge (kbd)', { from: n.key, to: e.to });
                                  setEdges(prev => prev.filter(x => !(x.from === n.key && x.to === e.to)));
                                  showToast(`Edge removed: ${n.key} → ${e.to}`);
                                }
                              }}
                            >
                              <span className="leading-none text-xs" aria-hidden>×</span>
                            </button>
                          </span>
                        ));
                        })()}
                        {/* don't render placeholder when empty */}
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center p-1.5 rounded hover:bg-gray-100 text-gray-700"
                        title="Edit"
                        aria-label="Edit"
                        onClick={async () => {
                          setExpandedIdx(idx);
                          const paramsText = JSON.stringify(n.params || {}, null, 2);
                          setAdvancedParamsText(paramsText);
                          setAdvancedMetricProfileId(n.metricProfileId || '');
                          setAdvancedIrSchemaId('');
                          setAdvancedIrSchemas([]);
                          // Hydrate prompt fields from params.promptsRef if present
                          try {
                            const pr = (n.params as any)?.promptsRef ?? {};
                            setAdvancedPromptId(typeof pr?.promptId === 'string' ? pr.promptId : (typeof pr?.id === 'string' ? pr.id : ''));
                            setAdvancedPromptVersion(typeof pr?.version === 'string' || typeof pr?.version === 'number' ? String(pr.version) : '');
                          } catch { setAdvancedPromptId(''); setAdvancedPromptVersion(''); }
                          setAdvancedMode('form');
                          setAdvancedRows(objectToDotEntries(n.params || {}));
                          if (n.stepVersionId) {
                            try {
                              const res = await fetch(`/api/admin/pipelines/steps/versions/${encodeURIComponent(n.stepVersionId)}/ir-schemas`);
                              const j = await res.json();
                              if (res.ok) {
                                setAdvancedIrSchemas(j.data || []);
                                const current = (n.params as any)?.irSchemaId;
                                if (current) setAdvancedIrSchemaId(current);
                              }
                            } catch {}
                          }
                        }}
                      >
                        {/* Pencil icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M21.731 2.269a2.625 2.625 0 00-3.713 0l-1.157 1.157 3.713 3.713 1.157-1.157a2.625 2.625 0 000-3.713z"/>
                          <path d="M3 17.25V21h3.75L19.44 8.31l-3.713-3.713L3 17.25z"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center p-1.5 rounded text-red-600 hover:bg-red-50 hover:text-red-700"
                        title="Delete"
                        aria-label={`Delete node ${n.key}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNodes(arr => arr.filter((_, i) => i !== idx)); }}
                      >
                        {/* Red X icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path fillRule="evenodd" className="fill-current" d="M12 2.25a9.75 9.75 0 110 19.5 9.75 9.75 0 010-19.5zm-2.47 5.97a.75.75 0 011.06 0L12 9.69l1.41-1.47a.75.75 0 111.08 1.04L13.06 10.7l1.47 1.47a.75.75 0 11-1.06 1.06L12 11.75l-1.47 1.48a.75.75 0 11-1.06-1.06l1.47-1.47-1.47-1.47a.75.75 0 010-1.06z"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {/* Save DAG moved under table, right aligned */}
          <div className="flex justify-end mt-3">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              onClick={onSaveClick}
              disabled={!pipelineId || !version || saving}
              title={saveConfirmReady ? 'Click again to confirm (5s)' : 'Save changes'}
            >{saving ? 'Saving…' : (saveConfirmReady ? 'Confirm Save' : 'Save')}</button>
          </div>
        </div>
      )}
    </div>

     

     {showAddNode && (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white rounded shadow p-4 w-full max-w-xl space-y-3">
          <div className="font-semibold">Add Node</div>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-gray-600 mb-1">Key</div>
              <input
                className="border rounded px-2 py-1 w-full"
                placeholder="unique-node-key"
                value={newNode.key as string}
                onChange={(e) => setNewNode({ ...newNode, key: e.target.value })}
              />
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Step Version</div>
              <select
                className="border rounded px-2 py-1 w-full"
                value={(newNode.stepVersionId as string) || ''}
                onChange={(e) => setNewNode({ ...newNode, stepVersionId: e.target.value })}
              >
                <option value="">Select step version…</option>
                {steps.map((s) => (
                  <optgroup key={s.id} label={`${s.key}${s.name ? ` — ${s.name}` : ''}`}> 
                    {(activeOnly ? s.versions.filter(v => v.isActive) : s.versions).map((v) => (
                      <option key={v.id} value={v.id}>
                        {s.key} · v{v.version}{v.isActive ? ' (active)' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => { setShowAddNode(false); setNewNode({ key: '', stepVersionId: '' }); setEdgePillFrom(null); setEdgeHoverTarget(null); }}>Cancel</button>
              <button
                className="px-3 py-1 bg-green-600 text-white rounded"
                onClick={() => {
                  const key = String(newNode.key || '').trim();
                  const stepVersionId = String(newNode.stepVersionId || '').trim();
                  if (!key) { setError('Key is required'); return; }
                  if (nodes.some(n => n.key === key)) { setError('Key must be unique'); return; }
                  if (!stepVersionId) { setError('Step Version is required'); return; }
                  setNodes(arr => [...arr, { key, stepVersionId }]);
                  setShowAddNode(false);
                  setNewNode({ key: '', stepVersionId: '' });
                  setEdgePillFrom(null);
                  setEdgeHoverTarget(null);
                }}
              >Add</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Details Modal for node advanced editing */}
    {expandedIdx !== null && nodes[expandedIdx] && (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white rounded shadow p-4 w-full max-w-4xl space-y-3 relative">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Node Details — {nodes[expandedIdx].key}</div>
            <button
              type="button"
              className="ml-3 p-1 text-gray-500 hover:text-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
              onClick={() => setExpandedIdx(null)}
              aria-label="Close"
              title="Close"
            >
              <span className="block text-lg leading-none">×</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-600 mb-1">Step Version</div>
              <select
                className="border rounded px-2 py-1 w-full"
                value={nodes[expandedIdx].stepVersionId || ''}
                onChange={(e) => updateNode(expandedIdx, { stepVersionId: e.target.value })}
              >
                <option value="">Select step version…</option>
                {steps.map((s) => (
                  <optgroup key={s.id} label={`${s.key}${s.name ? ` — ${s.name}` : ''}`}>
                    {(activeOnly ? s.versions.filter(v => v.isActive) : s.versions).map((v) => (
                      <option key={v.id} value={v.id}>
                        {s.key} · v{v.version}{v.isActive ? ' (active)' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Position</div>
              <div className="text-sm text-gray-700">{expandedIdx + 1} <span className="text-xs text-gray-500">(drag rows to reorder)</span></div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Condition</div>
              <input className="border rounded px-2 py-1 w-full" placeholder="metrics.validate.passed == true" value={nodes[expandedIdx].condition || ''} onChange={(e) => updateNode(expandedIdx, { condition: e.target.value })} />
            </div>
            <div className="space-x-2 whitespace-nowrap">
              <input className="border rounded px-2 py-1 w-28" type="number" placeholder="retries" value={typeof nodes[expandedIdx].retries === 'number' ? nodes[expandedIdx].retries : ''} onChange={(e) => updateNode(expandedIdx, { retries: e.target.value ? Number(e.target.value) : undefined })} />
              <input className="border rounded px-2 py-1 w-32" type="number" placeholder="timeoutMs" value={typeof nodes[expandedIdx].timeoutMs === 'number' ? nodes[expandedIdx].timeoutMs : ''} onChange={(e) => updateNode(expandedIdx, { timeoutMs: e.target.value ? Number(e.target.value) : undefined })} />
              <input className="border rounded px-2 py-1 w-36" placeholder="parallelGroup" value={nodes[expandedIdx].parallelGroup || ''} onChange={(e) => updateNode(expandedIdx, { parallelGroup: e.target.value })} />
            </div>
          </div>

          <div className="space-y-3">
            {/* Prompt section */}
            <div className="border rounded p-3 bg-gray-50">
              <div className="text-sm font-medium mb-2">Prompt</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-600 mb-1">Prompt ID</div>
                  <input
                    className="border rounded px-2 py-1 w-full"
                    placeholder="e.g. product-copywriter"
                    value={advancedPromptId}
                    onChange={(e) => setAdvancedPromptId(e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Version (optional; blank = active)</div>
                  <input
                    className="border rounded px-2 py-1 w-full"
                    placeholder="e.g. 12 or 2025-08-21"
                    value={advancedPromptVersion}
                    onChange={(e) => setAdvancedPromptVersion(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Provide a Prompt ID to bind this node to a library prompt. Leave Version empty to use the active version.
              </div>
              <div className="mt-2">
                <a
                  className={`inline-flex items-center gap-1 text-sm ${advancedPromptId ? 'text-blue-600 hover:underline' : 'text-gray-400 pointer-events-none'}`}
                  href={advancedPromptId ? `/ai/${encodeURIComponent(advancedPromptId)}/editor` : undefined}
                  target="_blank"
                  rel="noreferrer"
                  title={advancedPromptId ? 'Open Prompt Editor (new tab)' : 'Enter a Prompt ID to open the editor'}
                >
                  Open in Prompt Editor
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M5 4a1 1 0 011-1h9a1 1 0 011 1v9a1 1 0 11-2 0V6.414l-8.293 8.293a1 1 0 01-1.414-1.414L12.586 5H6a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600">Params Editor:</div>
              <label className="text-sm inline-flex items-center gap-1">
                <input type="radio" checked={advancedMode === 'form'} onChange={() => setAdvancedMode('form')} /> Form
              </label>
              <label className="text-sm inline-flex items-center gap-1">
                <input type="radio" checked={advancedMode === 'json'} onChange={() => setAdvancedMode('json')} /> JSON
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="text-xs text-gray-600">Metric Profile ID (optional)</div>
                <input
                  className="border rounded px-2 py-1 w-full"
                  placeholder="metricProfileId"
                  value={advancedMetricProfileId}
                  onChange={(e) => setAdvancedMetricProfileId(e.target.value)}
                />
                <div className="text-xs text-gray-600">IR Schema (optional; bound to selected StepVersion)</div>
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={advancedIrSchemaId}
                  onChange={(e) => setAdvancedIrSchemaId(e.target.value)}
                  disabled={advancedIrSchemas.length === 0}
                >
                  <option value="">Use StepVersion default</option>
                  {advancedIrSchemas.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} v{s.version}{s.isActive ? ' (active)' : ''}</option>
                  ))}
                </select>
              </div>
              {advancedMode === 'json' ? (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">Params (JSON overrides)</div>
                  <textarea
                    className="border rounded px-2 py-1 w-full font-mono text-xs"
                    rows={12}
                    value={advancedParamsText}
                    onChange={(e) => setAdvancedParamsText(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">Params (key/value with types; dot notation for nesting, e.g. prompts.system)</div>
                    <button
                      className="text-sm text-blue-600 underline"
                      onClick={() => setAdvancedRows((r) => [...r, { key: '', value: '', type: 'string' }])}
                    >Add Row</button>
                  </div>
                  <div className="max-h-64 overflow-auto border rounded">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="px-2 py-1 w-1/3">Key</th>
                          <th className="px-2 py-1 w-1/2">Value</th>
                          <th className="px-2 py-1 w-24">Type</th>
                          <th className="px-2 py-1 w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {advancedRows.length === 0 && (
                          <tr><td className="px-2 py-2 text-gray-500" colSpan={4}>No params. Add rows or switch to JSON mode.</td></tr>
                        )}
                        {advancedRows.map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1">
                              <input className="border rounded px-2 py-1 w-full" placeholder="prompts.system" value={row.key} onChange={(e) => {
                                const v = e.target.value; setAdvancedRows(rs => rs.map((r, idx2) => idx2 === i ? { ...r, key: v } : r));
                              }} />
                            </td>
                            <td className="px-2 py-1">
                              <input className="border rounded px-2 py-1 w-full" placeholder="value" value={row.value} onChange={(e) => {
                                const v = e.target.value; setAdvancedRows(rs => rs.map((r, idx2) => idx2 === i ? { ...r, value: v } : r));
                              }} />
                            </td>
                            <td className="px-2 py-1">
                              <select className="border rounded px-2 py-1 w-full" value={row.type} onChange={(e) => {
                                const v = e.target.value as ParamRow['type']; setAdvancedRows(rs => rs.map((r, idx2) => idx2 === i ? { ...r, type: v } : r));
                              }}>
                                <option value="string">string</option>
                                <option value="number">number</option>
                                <option value="boolean">boolean</option>
                                <option value="json">json</option>
                              </select>
                            </td>
                            <td className="px-2 py-1 text-right">
                              <button className="text-red-600 underline" onClick={() => setAdvancedRows(rs => rs.filter((_, idx2) => idx2 !== i))}>Del</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setExpandedIdx(null)}>Close</button>
            <button
              className="px-3 py-1 bg-green-600 text-white rounded"
              onClick={() => {
                const idx = expandedIdx!;
                let parsed: any = {};
                if (advancedMode === 'json') {
                  try {
                    parsed = advancedParamsText.trim() ? JSON.parse(advancedParamsText) : {};
                  } catch {
                    setError('Params must be valid JSON');
                    return;
                  }
                } else {
                  parsed = dotEntriesToObject(advancedRows);
                  setAdvancedParamsText(JSON.stringify(parsed, null, 2));
                }
                if (advancedIrSchemaId) {
                  parsed = { ...parsed, irSchemaId: advancedIrSchemaId };
                }
                // Persist prompt binding under params.promptsRef
                const pr: any = {};
                if (advancedPromptId.trim()) {
                  pr.id = advancedPromptId.trim();
                  pr.promptId = advancedPromptId.trim(); // allow both keys for flexibility
                }
                if (advancedPromptVersion.trim()) {
                  pr.version = advancedPromptVersion.trim();
                }
                if (Object.keys(pr).length > 0) {
                  parsed = { ...parsed, promptsRef: pr };
                } else {
                  // if user cleared both fields, remove promptsRef to avoid stale config
                  if (parsed && typeof parsed === 'object' && 'promptsRef' in parsed) {
                    const { promptsRef, ...rest } = parsed as any;
                    parsed = rest;
                  }
                }
                updateNode(idx, { params: parsed, metricProfileId: advancedMetricProfileId || undefined });
                setExpandedIdx(null);
                showToast('Node updated');
              }}
            >Save</button>
          </div>
        </div>
      </div>
    )}

  </div>
);
}

export default function ManageStepsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading…</div>}>
      <ManageStepsPageInner />
    </Suspense>
  );
}