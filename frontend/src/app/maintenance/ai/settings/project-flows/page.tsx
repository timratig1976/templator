"use client";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import API_ENDPOINTS from "@/config/api";

type ProjectFlow = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  phases?: DomainPhase[];
  pipeline?: { id: string; name: string } | null;
  pinnedPipelineVersion?: { id: string; version: string; isActive: boolean; pipelineId: string } | null;
};

type DomainPhase = {
  id: string;
  flowId: string;
  key: string;
  name: string;
  description?: string | null;
  orderIndex: number;
};

export default function ProjectFlowsSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [flows, setFlows] = useState<ProjectFlow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string; versions: Array<{ id: string; version: string; isActive: boolean }> }>>([]);

  // Create flow form state
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Inline edit map
  const [editingFlow, setEditingFlow] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ key?: string; name?: string; description?: string; isActive?: boolean }>({});

  // Expand phases state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const backend = useMemo(() => API_ENDPOINTS, []);

  async function fetchFlows() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(backend.ADMIN_PROJECT_FLOWS, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "failed_to_fetch");
      setFlows(json.data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load flows");
    } finally {
      setLoading(false);
    }
  }

  // Pipeline binding state per flow
  const [bindDraft, setBindDraft] = useState<Record<string, { pipelineId?: string; pinnedPipelineVersionId?: string | null }>>({});

  function getFlowPipelineBinding(flow: ProjectFlow) {
    const pipelineName = flow.pipeline?.name || "None";
    const pinned = flow.pinnedPipelineVersion ? `Pinned v${flow.pinnedPipelineVersion.version}` : "Following Active";
    return { pipelineName, pinned };
  }

  async function bindPipeline(flowId: string) {
    const draft = bindDraft[flowId] || {};
    if (!draft.pipelineId && typeof draft.pinnedPipelineVersionId === "undefined") return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(backend.ADMIN_FLOW_BIND_PIPELINE(flowId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "failed_to_bind_pipeline");
      setBindDraft((prev) => ({ ...prev, [flowId]: {} }));
      await fetchFlows();
    } catch (e: any) {
      setError(e?.message || "Failed to bind pipeline");
    } finally {
      setLoading(false);
    }
  }

  async function unpinPipeline(flowId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(backend.ADMIN_FLOW_UNPIN_PIPELINE(flowId), { method: "PATCH" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "failed_to_unpin_pipeline");
      await fetchFlows();
    } catch (e: any) {
      setError(e?.message || "Failed to unpin pipeline");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFlows();
    // Preload pipelines catalog for selectors
    (async () => {
      try {
        const res = await fetch(backend.ADMIN_PIPELINES, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "failed_to_list_pipelines");
        const list = (json.data || []).map((p: any) => ({ id: p.id, name: p.name, versions: p.versions || [] }));
        setPipelines(list);
      } catch (e: any) {
        // non-fatal
        console.warn("Failed to load pipelines", e?.message);
      }
    })();
  }, []);

  async function createFlow() {
    if (!newKey || !newName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(backend.ADMIN_PROJECT_FLOWS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey, name: newName, description: newDesc || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "failed_to_create");
      setNewKey("");
      setNewName("");
      setNewDesc("");
      await fetchFlows();
    } catch (e: any) {
      setError(e?.message || "Failed to create flow");
    } finally {
      setLoading(false);
    }
  }

  async function updateFlow(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backend.ADMIN_PROJECT_FLOWS}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "failed_to_update");
      setEditingFlow(null);
      setEditDraft({});
      await fetchFlows();
    } catch (e: any) {
      setError(e?.message || "Failed to update flow");
    } finally {
      setLoading(false);
    }
  }

  async function deleteFlow(id: string) {
    if (!confirm("Delete this flow?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backend.ADMIN_PROJECT_FLOWS}/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({ error: "failed" }));
        throw new Error(json.error || "failed_to_delete");
      }
      await fetchFlows();
    } catch (e: any) {
      setError(e?.message || "Failed to delete flow");
    } finally {
      setLoading(false);
    }
  }

  // Phase ops
  const [newPhase, setNewPhase] = useState<Record<string, { key: string; name: string; description: string }>>({});

  async function addPhase(flowId: string) {
    const draft = newPhase[flowId] || { key: "", name: "", description: "" };
    if (!draft.key || !draft.name) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(backend.ADMIN_PROJECT_FLOW_PHASES(flowId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: draft.key, name: draft.name, description: draft.description || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "failed_to_add_phase");
      await fetchFlows();
      setNewPhase((prev) => ({ ...prev, [flowId]: { key: "", name: "", description: "" } }));
    } catch (e: any) {
      setError(e?.message || "Failed to add phase");
    } finally {
      setLoading(false);
    }
  }

  async function deletePhase(phaseId: string) {
    if (!confirm("Delete this phase?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(backend.ADMIN_PHASE(phaseId), { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({ error: "failed" }));
        throw new Error(json.error || "failed_to_delete_phase");
      }
      await fetchFlows();
    } catch (e: any) {
      setError(e?.message || "Failed to delete phase");
    } finally {
      setLoading(false);
    }
  }

  async function reorderPhases(flow: ProjectFlow, orderedIds: string[]) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(backend.ADMIN_PHASES_REORDER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowId: flow.id, orderedPhaseIds: orderedIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "failed_to_reorder");
      await fetchFlows();
    } catch (e: any) {
      setError(e?.message || "Failed to reorder phases");
    } finally {
      setLoading(false);
    }
  }

  function movePhase(flow: ProjectFlow, phaseId: string, dir: -1 | 1) {
    const ordered = (flow.phases || []).sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = ordered.findIndex((p) => p.id === phaseId);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    const swapped = [...ordered];
    const [a, b] = [swapped[idx], swapped[swapIdx]];
    [a.orderIndex, b.orderIndex] = [b.orderIndex, a.orderIndex];
    const ids = swapped.sort((x, y) => x.orderIndex - y.orderIndex).map((p) => p.id);
    reorderPhases(flow, ids);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Project Flows</h2>
        <Link className="text-sm underline" href="/maintenance/ai/settings/project-flows/ai">Create via AI</Link>
      </div>
      <p className="text-sm text-gray-600">Manage flows and their Domain Phases. Bind phases to AI Steps and optionally pin Step Versions.</p>

      {/* Create Flow */}
      <div className="rounded border p-4 bg-white">
        <div className="text-sm font-medium mb-2">Create Flow</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className="border rounded px-2 py-1" placeholder="key (unique)" value={newKey} onChange={(e)=>setNewKey(e.target.value)} />
          <input className="border rounded px-2 py-1" placeholder="name" value={newName} onChange={(e)=>setNewName(e.target.value)} />
          <input className="border rounded px-2 py-1 md:col-span-2" placeholder="description (optional)" value={newDesc} onChange={(e)=>setNewDesc(e.target.value)} />
        </div>
        <div className="mt-2">
          <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={createFlow} disabled={loading}>Create</button>
        </div>
      </div>

      {/* Errors */}
      {error && <div className="rounded border border-red-200 bg-red-50 text-red-700 p-2 text-sm">{error}</div>}

      {/* Flows List */}
      <div className="space-y-3">
        {loading && flows.length === 0 && <div className="text-sm text-gray-500">Loading...</div>}
        {flows.map((f) => (
          <div key={f.id} className="rounded border bg-white">
            <div className="flex items-center justify-between p-3">
              <div className="flex-1">
                {editingFlow === f.id ? (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input className="border rounded px-2 py-1" defaultValue={f.key} onChange={(e)=>setEditDraft((d)=>({ ...d, key: e.target.value }))} />
                    <input className="border rounded px-2 py-1" defaultValue={f.name} onChange={(e)=>setEditDraft((d)=>({ ...d, name: e.target.value }))} />
                    <input className="border rounded px-2 py-1 md:col-span-2" defaultValue={f.description ?? ''} onChange={(e)=>setEditDraft((d)=>({ ...d, description: e.target.value }))} />
                  </div>
                ) : (
                  <div>
                    <div className="font-medium">{f.name} <span className="text-xs text-gray-500">({f.key})</span></div>
                    {f.description && <div className="text-sm text-gray-600">{f.description}</div>}
                    {/* Pipeline binding summary */}
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-semibold">Pipeline:</span> {getFlowPipelineBinding(f).pipelineName} · {getFlowPipelineBinding(f).pinned}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editingFlow === f.id ? (
                  <>
                    <button className="px-2 py-1 border rounded" onClick={()=>{ setEditingFlow(null); setEditDraft({}); }}>Cancel</button>
                    <button className="px-2 py-1 border rounded bg-blue-600 text-white" onClick={()=>updateFlow(f.id)} disabled={loading}>Save</button>
                  </>
                ) : (
                  <>
                    <button className="px-2 py-1 border rounded" onClick={()=>{ setEditingFlow(f.id); setEditDraft({ key: f.key, name: f.name, description: f.description ?? undefined, isActive: f.isActive }); }}>Edit</button>
                    <button className="px-2 py-1 border rounded text-red-700" onClick={()=>deleteFlow(f.id)} disabled={loading}>Delete</button>
                    <Link className="px-2 py-1 border rounded bg-white hover:bg-gray-50" href={`/maintenance/ai/settings/project-flows/${f.id}/phases?context=project-flow`}>Manage Phases</Link>
                    <Link className="px-2 py-1 border rounded bg-white hover:bg-gray-50" href={`/admin/flow-runner/${f.id}`}>Open Runner</Link>
                    <button className="px-2 py-1 border rounded" onClick={()=>setExpanded((ex)=>({ ...ex, [f.id]: !ex[f.id] }))}>{expanded[f.id] ? 'Hide Phases' : 'Show Phases'}</button>
                  </>
                )}
              </div>
            </div>

            {expanded[f.id] && (
              <div className="border-t p-3">
                {/* Pipeline binding controls */}
                <div className="mb-4 p-3 border rounded bg-gray-50">
                  <div className="text-sm font-medium mb-2">Pipeline Binding</div>
                  {/* Helper: explain bind vs pin */}
                  <div className="text-xs text-gray-600 mb-2">
                    <p>
                      <span className="font-semibold">Bind</span> attaches this flow to a pipeline. If you also choose a specific version, the flow is <span className="font-semibold">pinned</span> to that version. Without a pin, the flow <span className="font-semibold">follows the pipeline's active version</span>.
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">Save Binding</span> applies your selection. <span className="font-semibold">Unpin</span> clears any pinned version so the flow follows whatever version is active for the selected pipeline.
                    </p>
                  </div>
                  {/* Warnings about current binding state */}
                  {(() => {
                    const selPid = bindDraft[f.id]?.pipelineId ?? f.pipeline?.id ?? '';
                    const selPinned = (bindDraft[f.id]?.pinnedPipelineVersionId ?? f.pinnedPipelineVersion?.id) ?? '';
                    const selectedPipeline = pipelines.find(p => p.id === selPid);
                    const hasActiveVersion = !!selectedPipeline?.versions?.some(v => v.isActive);
                    return (
                      <>
                        {!selPid && (
                          <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            This flow is not bound to any pipeline. It cannot execute until you bind a pipeline.
                          </div>
                        )}
                        {selPid && !selPinned && !hasActiveVersion && (
                          <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            Following active version, but the selected pipeline has no active version. Activate a pipeline version or pin a specific version.
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                    <select
                      className="border rounded px-2 py-1"
                      value={bindDraft[f.id]?.pipelineId ?? f.pipeline?.id ?? ''}
                      onChange={(e)=>{
                        const pid = e.target.value || undefined;
                        setBindDraft((prev)=>({ ...prev, [f.id]: { ...(prev[f.id]||{}), pipelineId: pid, pinnedPipelineVersionId: undefined } }));
                      }}
                    >
                      <option value="">Select Pipeline</option>
                      {pipelines.map(p=> (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>

                    {/* Version selector (optional pin) */}
                    <select
                      className="border rounded px-2 py-1"
                      value={bindDraft[f.id]?.pinnedPipelineVersionId ?? f.pinnedPipelineVersion?.id ?? ''}
                      onChange={(e)=>{
                        const val = e.target.value;
                        setBindDraft((prev)=>({ ...prev, [f.id]: { ...(prev[f.id]||{}), pinnedPipelineVersionId: val || undefined } }));
                      }}
                      disabled={!(bindDraft[f.id]?.pipelineId ?? f.pipeline?.id)}
                    >
                      <option value="">Follow Active Version</option>
                      {(pipelines.find(p=> p.id === (bindDraft[f.id]?.pipelineId ?? f.pipeline?.id))?.versions || []).map(v => (
                        <option key={v.id} value={v.id}>{`v${v.version}${v.isActive ? ' (active)' : ''}`}</option>
                      ))}
                    </select>

                    <div className="flex gap-2 items-center">
                      <button
                        className="px-3 py-1 rounded border"
                        onClick={()=>bindPipeline(f.id)}
                        disabled={loading || !(bindDraft[f.id]?.pipelineId ?? f.pipeline?.id)}
                      >
                        Save Binding
                      </button>
                      <button className="px-3 py-1 rounded border" onClick={()=>unpinPipeline(f.id)} disabled={loading || !f.pinnedPipelineVersion}>Unpin</button>
                      {!(bindDraft[f.id]?.pipelineId ?? f.pipeline?.id) && (
                        <span className="text-xs text-gray-500">Select a pipeline to enable Save</span>
                      )}
                    </div>
                  </div>
                  {/* Empty state hint when no pipelines exist */}
                  {pipelines.length === 0 && (
                    <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      No pipelines found. Create a pipeline first on the <Link className="underline" href="/maintenance/ai/settings/pipelines">Pipelines</Link> page, then return here to bind it to this flow.
                    </div>
                  )}
                </div>
                <div className="text-sm font-medium mb-2">Phases</div>
                <div className="space-y-2">
                  {(f.phases || []).sort((a,b)=>a.orderIndex-b.orderIndex).map((p, i, arr) => (
                    <div key={p.id} className="flex items-center justify-between border rounded p-2">
                      <div>
                        <div className="font-medium">{p.name} <span className="text-xs text-gray-500">({p.key})</span></div>
                        {p.description && <div className="text-xs text-gray-600">{p.description}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="px-2 py-1 border rounded" onClick={()=>movePhase(f, p.id, -1)} disabled={i===0}>Up</button>
                        <button className="px-2 py-1 border rounded" onClick={()=>movePhase(f, p.id, +1)} disabled={i===arr.length-1}>Down</button>
                        <Link className="px-2 py-1 border rounded bg-white hover:bg-gray-50" href={`/maintenance/ai/settings/project-flows/${f.id}/phases/${p.id}/steps`}>Manage Steps</Link>
                        <button className="px-2 py-1 border rounded text-red-700" onClick={()=>deletePhase(p.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                  {(!f.phases || f.phases.length===0) && <div className="text-sm text-gray-500">No phases yet</div>}
                </div>

                {/* Add phase */}
                <div className="mt-3 p-3 border rounded">
                  <div className="text-sm font-medium mb-2">Add Phase</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input className="border rounded px-2 py-1" placeholder="key" value={(newPhase[f.id]?.key)||""} onChange={(e)=>setNewPhase((prev)=>({ ...prev, [f.id]: { ...(prev[f.id]||{ key:"", name:"", description:""}), key: e.target.value } }))} />
                    <input className="border rounded px-2 py-1" placeholder="name" value={(newPhase[f.id]?.name)||""} onChange={(e)=>setNewPhase((prev)=>({ ...prev, [f.id]: { ...(prev[f.id]||{ key:"", name:"", description:""}), name: e.target.value } }))} />
                    <input className="border rounded px-2 py-1" placeholder="description" value={(newPhase[f.id]?.description)||""} onChange={(e)=>setNewPhase((prev)=>({ ...prev, [f.id]: { ...(prev[f.id]||{ key:"", name:"", description:""}), description: e.target.value } }))} />
                  </div>
                  <div className="mt-2">
                    <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={()=>addPhase(f.id)} disabled={loading}>Add Phase</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {(!loading && flows.length === 0) && <div className="text-sm text-gray-500">No flows yet</div>}
      </div>

      <div className="text-xs text-gray-500">Links: <Link className="underline" href="/maintenance/ai/settings/steps">AI Steps</Link> • <Link className="underline" href="/maintenance/ai/settings/pipelines">Pipelines</Link></div>
    </div>
  );
}
