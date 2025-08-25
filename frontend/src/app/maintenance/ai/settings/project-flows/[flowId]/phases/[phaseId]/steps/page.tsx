"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { adminPhaseStepsService, type DomainPhaseStep as PhaseStep, type ReorderItem } from "@/services/adminPhaseStepsService";
import { adminAiStepsService, type StepDefinition } from "@/services/adminAiStepsService";
import adminProjectFlowsService, { type AllowedStepsResponse } from "@/services/adminProjectFlowsService";
import adminPipelinesService, { type GenerateFromFlowResponse } from "@/services/adminPipelinesService";

// Lightweight steps management placeholder with CRUD + pin/unpin controls

type StepVersion = { id: string; version: string; isActive: boolean };

export default function PhaseStepsPage({ params }: { params: { flowId: string; phaseId: string } }) {
  const { flowId, phaseId } = params;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PhaseStep[]>([]);

  // new item form
  const [draft, setDraft] = useState<{ stepId: string; params: string }>({ stepId: "", params: "" });
  const [search, setSearch] = useState<string>("");
  const [options, setOptions] = useState<StepDefinition[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [allowed, setAllowed] = useState<AllowedStepsResponse | null>(null);
  const [allowedLoading, setAllowedLoading] = useState<boolean>(false);
  const [genLoading, setGenLoading] = useState<boolean>(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<GenerateFromFlowResponse | null>(null);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const list = await adminPhaseStepsService.list(phaseId);
      setItems(list.sort((a, b) => a.orderIndex - b.orderIndex));
    } catch (e: any) {
      setError(e?.message || "Failed to load phase steps");
    } finally {
      setLoading(false);
    }
  }

function ManualUiHintsEditor({ phaseStepId, initialParams, onSaved }: { phaseStepId: string; initialParams: any; onSaved?: () => void | Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);

  const [manual, setManual] = useState<boolean>(() => !!(initialParams && initialParams.manual === true));
  const [uiHints, setUiHints] = useState<any>(() => (initialParams && initialParams.uiHints) || {});
  const [rawJson, setRawJson] = useState<string>("");

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const params = await adminPhaseStepsService.getParams(phaseStepId);
      setManual(!!(params && params.manual === true));
      setUiHints((params && params.uiHints) || {});
    } catch (e: any) {
      setError(e?.message || "Failed to load params");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [phaseStepId]);

  function onField<K extends string>(path: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const val = e.target.value;
      setUiHints((prev: any) => ({ ...(prev || {}), [path]: val }));
    };
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let payload: any = { manual };
      // If raw JSON provided, try to merge/override uiHints via JSON
      let parsed: any = null;
      if (rawJson && rawJson.trim()) {
        try { parsed = JSON.parse(rawJson); } catch { setError("Invalid JSON in advanced editor"); setSaving(false); return; }
      }
      const hints = parsed && typeof parsed === 'object' ? parsed : uiHints || {};
      payload.uiHints = {};
      for (const key of ["commentLabel","commentPlaceholder","helpText","approveLabel","rejectLabel"]) {
        if (hints && typeof hints[key] !== 'undefined' && hints[key] !== null) payload.uiHints[key] = hints[key];
      }
      // Remove empty uiHints to avoid noisy writes
      if (Object.keys(payload.uiHints).length === 0) delete payload.uiHints;

      await adminPhaseStepsService.updateParams(phaseStepId, payload);
      setSuccess("Saved");
      if (onSaved) {
        try { await onSaved(); } catch {}
      }
    } catch (e: any) {
      setError(e?.message || "Failed to save params");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border rounded p-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium">Manual Step UI</div>
        <button className="text-xs underline" onClick={() => setExpanded(v=>!v)}>{expanded ? "Hide" : "Edit"}</button>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2">
          {error && <div className="text-xs text-red-700">{error}</div>}
          {success && <div className="text-xs text-green-700">{success}</div>}
          <div className="flex items-center gap-2">
            <input id={`manual-${phaseStepId}`} type="checkbox" className="h-4 w-4" checked={manual} onChange={(e)=>setManual(e.target.checked)} disabled={loading||saving} />
            <label htmlFor={`manual-${phaseStepId}`} className="text-sm">Manual step (requires approve/reject)</label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Comment Label</label>
              <input className="border rounded px-2 py-1 text-sm" value={uiHints?.commentLabel || ""} onChange={onField("commentLabel")} placeholder="e.g. Decision note" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Comment Placeholder</label>
              <input className="border rounded px-2 py-1 text-sm" value={uiHints?.commentPlaceholder || ""} onChange={onField("commentPlaceholder")} placeholder="e.g. Explain your decision…" />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs text-gray-600">Help Text</label>
              <input className="border rounded px-2 py-1 text-sm" value={uiHints?.helpText || ""} onChange={onField("helpText")} placeholder="Shown under the comment box" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Approve Button Label</label>
              <input className="border rounded px-2 py-1 text-sm" value={uiHints?.approveLabel || ""} onChange={onField("approveLabel")} placeholder="Approve" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Reject Button Label</label>
              <input className="border rounded px-2 py-1 text-sm" value={uiHints?.rejectLabel || ""} onChange={onField("rejectLabel")} placeholder="Reject" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-gray-500">Advanced: Provide uiHints as JSON (optional)</div>
            <button className="text-[11px] underline" onClick={()=>setRawJson(JSON.stringify(uiHints || {}, null, 2))}>Load current as JSON</button>
          </div>
          <textarea className="w-full border rounded p-2 text-xs" rows={3} value={rawJson} onChange={(e)=>setRawJson(e.target.value)} placeholder='{"commentLabel":"Decision note", "approveLabel":"Approve & Continue"}' />
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 border rounded" onClick={save} disabled={loading||saving}>{saving ? "Saving..." : "Save Manual/UI Hints"}</button>
            <button className="px-2 py-1 border rounded" onClick={load} disabled={loading}>Reset</button>
          </div>
        </div>
      )}
    </div>
  );
}

  async function addItem() {
    if (!draft.stepId) return;
    setLoading(true);
    setError(null);
    try {
      const body: any = { stepId: draft.stepId };
      if (draft.params) {
        try { body.params = JSON.parse(draft.params); } catch { body.params = {}; }
      }
      await adminPhaseStepsService.create(phaseId, body);
      setDraft({ stepId: "", params: "" });
      await fetchAll();
    } catch (e: any) {
      setError(e?.message || "Failed to add step");
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this phase step?")) return;
    setLoading(true);
    setError(null);
    try {
      await adminPhaseStepsService.remove(id);
      await fetchAll();
    } catch (e: any) {
      setError(e?.message || "Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  async function saveItem(id: string, patch: Partial<PhaseStep>) {
    setLoading(true);
    setError(null);
    try {
      await adminPhaseStepsService.update(id, patch);
      await fetchAll();
    } catch (e: any) {
      setError(e?.message || "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  async function reorderItems(orderedIds: string[]) {
    setLoading(true);
    setError(null);
    try {
      const ordered = orderedIds
        .map((id, idx) => ({ id, orderIndex: idx })) as ReorderItem[];
      await adminPhaseStepsService.reorder(phaseId, ordered);
      await fetchAll();
    } catch (e: any) {
      setError(e?.message || "Failed to reorder");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, [phaseId]);

  // search step definitions
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setSearchLoading(true);
        // Use allowed steps if available; otherwise empty until loaded
        const base = allowed?.allowedSteps || [];
        const q = (search || "").toLowerCase();
        const filtered = base
          .filter((s) => !q || (s.name || s.key || "").toLowerCase().includes(q))
          .slice(0, 50)
          .map((s) => ({ id: s.id, key: s.key, name: s.name, description: s.description } as StepDefinition));
        if (!cancelled) setOptions(filtered);
      } catch (e) {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }
    const t = setTimeout(run, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, allowed]);

  // Load allowed steps for the flow (bound pipeline/version)
  useEffect(() => {
    let cancelled = false;
    async function loadAllowed() {
      try {
        setAllowedLoading(true);
        const res = await adminProjectFlowsService.getAllowedSteps(flowId);
        if (!cancelled) setAllowed(res);
      } catch (e) {
        if (!cancelled) setAllowed({ allowedSteps: [], pipelineBound: false, activePipelineVersion: null });
      } finally {
        if (!cancelled) setAllowedLoading(false);
      }
    }
    loadAllowed();
  }, [flowId]);

  function move(id: string, dir: -1 | 1) {
    const ordered = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = ordered.findIndex((x) => x.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const [a, b] = [ordered[idx], ordered[swapIdx]];
    [a.orderIndex, b.orderIndex] = [b.orderIndex, a.orderIndex];
    reorderItems(ordered.sort((x, y) => x.orderIndex - y.orderIndex).map((x) => x.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Manage Phase Steps</h2>
        <Link href={`/maintenance/ai/settings/project-flows`} className="text-sm underline">Back to Flows</Link>
      </div>
      {/* Generate Pipeline from Flow */}
      <div className="rounded border p-3 bg-white">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Generate Pipeline from this Flow</div>
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 border rounded"
              onClick={async ()=>{
                setGenLoading(true); setGenError(null); setGenResult(null);
                try {
                  const res = await adminPipelinesService.generateFromFlow(flowId, { dryRun: true });
                  setGenResult(res);
                } catch (e:any) {
                  setGenError(e?.message || "Dry-run failed");
                } finally {
                  setGenLoading(false);
                }
              }}
              disabled={genLoading}
            >{genLoading ? "Running..." : "Preview (Dry Run)"}</button>
            <button
              className="px-2 py-1 border rounded bg-blue-600 text-white"
              onClick={async ()=>{
                if (!confirm("Create a new pipeline + version from this flow and bind to the flow?")) return;
                setGenLoading(true); setGenError(null); setGenResult(null);
                try {
                  const res = await adminPipelinesService.generateFromFlow(flowId, { apply: true, bindToFlow: true });
                  setGenResult(res);
                  alert("Pipeline generated successfully.");
                } catch (e:any) {
                  setGenError(e?.message || "Apply failed");
                } finally {
                  setGenLoading(false);
                }
              }}
              disabled={genLoading}
            >Apply & Bind</button>
          </div>
        </div>
        {genError && <div className="mt-2 text-xs text-red-700">{genError}</div>}
        {genResult && (
          <div className="mt-2 text-xs text-gray-700 space-y-1">
            {"dryRun" in genResult && genResult.dryRun ? (
              <div><span className="font-medium">Dry Run:</span> {genResult.pipeline?.name} (v{genResult.pipeline?.version}) Steps: {genResult.summary?.stepCount}</div>
            ) : (
              <div><span className="font-medium">Applied:</span> {(genResult as any).pipeline?.name} (v{(genResult as any).version?.version}) Steps: {genResult.summary?.stepCount}</div>
            )}
            {genResult.summary?.issues?.length ? (
              <div>
                <div className="font-medium">Issues:</div>
                <ul className="list-disc pl-5">
                  {genResult.summary.issues.map((it:any, idx:number)=>(
                    <li key={idx}>{it.key}: {it.reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div>No issues reported.</div>
            )}
          </div>
        )}
      </div>
      {error && <div className="rounded border border-red-200 bg-red-50 text-red-700 p-2 text-sm">{error}</div>}

      {/* Add */}
      <div className="rounded border p-3 bg-white">
        <div className="text-sm font-medium mb-2">Add Step</div>
        {/* Warnings about pipeline binding */}
        {allowed && !allowed.pipelineBound && (
          <div className="mb-2 text-xs rounded border border-yellow-200 bg-yellow-50 text-yellow-800 p-2">
            This flow isn’t bound to a pipeline. You can still add steps by entering a StepDefinition ID below. When bound, the selector will list allowed steps from the pipeline DAG.
          </div>
        )}
        {allowed && allowed.pipelineBound && allowed.allowedSteps.length === 0 && (
          <div className="mb-2 text-xs rounded border border-yellow-200 bg-yellow-50 text-yellow-800 p-2">
            The bound pipeline version has no steps in its DAG. Add nodes to the pipeline version to enable selection here.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <input
              className="border rounded px-2 py-1"
              placeholder="Search steps by name or key (when bound)"
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
              disabled={allowedLoading}
            />
            {(allowed && allowed.pipelineBound) ? (
              <select
                className="border rounded px-2 py-1"
                value={draft.stepId}
                onChange={(e)=>setDraft((d)=>({ ...d, stepId: e.target.value }))}
                disabled={allowedLoading || (allowed && allowed.allowedSteps.length === 0)}
              >
                <option value="">{(allowedLoading || searchLoading) ? "Loading..." : "Select a StepDefinition"}</option>
                {options.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {(opt.name || opt.key)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="border rounded px-2 py-1"
                placeholder="Enter StepDefinition ID (unbound flow)"
                value={draft.stepId}
                onChange={(e)=>setDraft((d)=>({ ...d, stepId: e.target.value }))}
                disabled={allowedLoading}
              />
            )}
            {draft.stepId && (
              <div className="text-[11px] text-gray-500">Selected ID: {draft.stepId}</div>
            )}
          </div>
          <input className="border rounded px-2 py-1 md:col-span-2" placeholder="params JSON (optional)" value={draft.params} onChange={(e)=>setDraft((d)=>({ ...d, params: e.target.value }))} />
        </div>
        <div className="mt-2">
          <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={addItem} disabled={loading}>Add</button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {items.map((it, i, arr) => (
          <div key={it.id} className="border rounded p-3 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{it.stepId} <span className="text-xs text-gray-500">(stepId)</span></div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Order: {it.orderIndex}</span>
                  {it?.params?.manual === true ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-200">Manual</span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">Auto</span>
                  )}
                </div>
                {it.pinnedStepVersionId ? (
                  <div className="text-xs"><span className="font-medium">Pinned:</span> {it.pinnedStepVersionId}</div>
                ) : (
                  <div className="text-xs text-gray-600">Following active version</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 border rounded" onClick={()=>move(it.id, -1)} disabled={i===0}>Up</button>
                <button className="px-2 py-1 border rounded" onClick={()=>move(it.id, +1)} disabled={i===arr.length-1}>Down</button>
                <button className="px-2 py-1 border rounded" onClick={()=>saveItem(it.id, { pinnedStepVersionId: null })}>Unpin</button>
                <button className="px-2 py-1 border rounded text-red-700" onClick={()=>deleteItem(it.id)}>Delete</button>
              </div>
            </div>

            {/* Pin to version */}
            <div className="mt-2">
              <PinVersionEditor stepId={it.stepId} currentPinned={it.pinnedStepVersionId || null} onPin={(versionId)=>saveItem(it.id, { pinnedStepVersionId: versionId })} />
            </div>

            {/* Manual / UI Hints (flow-specific) */}
            <div className="mt-2">
              <ManualUiHintsEditor phaseStepId={it.id} initialParams={it.params || {}} onSaved={fetchAll} />
            </div>

            {/* Params editor */}
            <div className="mt-2">
              <ParamsEditor value={it.params} onSave={(json)=>saveItem(it.id, { params: json })} />
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-sm text-gray-500">No steps yet</div>}
      </div>
    </div>
  );
}

function ParamsEditor({ value, onSave }: { value: any; onSave: (json: any)=>void }) {
  const [text, setText] = useState<string>(() => value ? JSON.stringify(value, null, 2) : "");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="border rounded p-2">
      <div className="text-xs font-medium mb-1">Params (JSON)</div>
      <textarea className="w-full border rounded p-2 text-sm" rows={4} value={text} onChange={(e)=>setText(e.target.value)} />
      {err && <div className="text-xs text-red-600 mt-1">{err}</div>}
      <div className="mt-2">
        <button className="px-2 py-1 border rounded" onClick={()=>{
          try { const parsed = text ? JSON.parse(text) : {}; onSave(parsed); setErr(null); } catch (e:any) { setErr("Invalid JSON"); }
        }}>Save Params</button>
      </div>
    </div>
  );
}

function PinVersionEditor({ stepId, currentPinned, onPin }: { stepId: string; currentPinned: string | null; onPin: (versionId: string)=>void }) {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<StepVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string>(currentPinned || "");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // If a versions endpoint exists, you can load here; for now we allow manual entry with optional fetched list.
      setVersions([]);
    } catch (e: any) {
      setError(e?.message || "Failed to load versions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [stepId]);

  return (
    <div className="border rounded p-2">
      <div className="text-xs font-medium mb-1">Pin to Version</div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex flex-col gap-2">
        {/* Optional dropdown if versions are fetched */}
        {versions.length > 0 && (
          <div className="flex items-center gap-2">
            <select className="border rounded px-2 py-1" value={sel} onChange={(e)=>setSel(e.target.value)}>
              <option value="">Follow Active</option>
              {versions.map((v)=> (
                <option key={v.id} value={v.id}>{v.version}{v.isActive ? " (active)" : ""}</option>
              ))}
            </select>
            <button className="px-2 py-1 border rounded" onClick={()=> sel ? onPin(sel) : onPin(null as any)} disabled={loading}>Apply</button>
          </div>
        )}
        {/* Manual entry fallback */}
        <div className="flex items-center gap-2">
          <input className="border rounded px-2 py-1" placeholder="Version ID (leave empty to follow active)" value={sel} onChange={(e)=>setSel(e.target.value)} />
          <button className="px-2 py-1 border rounded" onClick={()=> sel ? onPin(sel) : onPin(null as any)} disabled={loading}>Apply</button>
        </div>
      </div>
    </div>
  );
}

