"use client";
import React, { useEffect, useMemo, useState } from "react";

type StepVersion = { id: string; version: string; isActive: boolean };

type StepDef = {
  id: string;
  key: string;
  name?: string;
  description?: string;
  versionCount: number;
  versions: StepVersion[];
};

export default function StepsPage() {
  const [items, setItems] = useState<StepDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newActivateInitial, setNewActivateInitial] = useState<boolean>(false);

  const [addVersionFor, setAddVersionFor] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState("");
  const [newDefaultConfig, setNewDefaultConfig] = useState("{}");
  const [newIsActive, setNewIsActive] = useState(false);

  // row expand/collapse
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // prompt assets UI state
  type PromptAsset = { id: string; name: string; promptContent: any; irSchema?: any };
  const [promptOpen, setPromptOpen] = useState<Record<string, boolean>>({}); // by versionId
  const [assetsByVersion, setAssetsByVersion] = useState<Record<string, PromptAsset[]>>({});
  const [creatingForVersion, setCreatingForVersion] = useState<string | null>(null);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetPromptJson, setNewAssetPromptJson] = useState("{\n  \"messages\": []\n}");
  const [newAssetIRJson, setNewAssetIRJson] = useState("{}");

  // edit form state
  const [editId, setEditId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // toasts
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function loadPromptAssets(versionId: string) {
    try {
      const res = await fetch(`/api/admin/ai-steps/prompt-assets?stepVersionId=${encodeURIComponent(versionId)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || res.statusText);
      setAssetsByVersion((m) => ({ ...m, [versionId]: j.data || [] }));
    } catch (e: any) {
      showToast(`Load prompts failed: ${e?.message || 'error'}`);
    }
  }

  async function createPromptAsset(stepId: string, versionId: string) {
    let promptObj: any = {};
    let irObj: any = undefined;
    try { promptObj = JSON.parse(newAssetPromptJson || '{}'); } catch { showToast('Prompt JSON invalid'); return; }
    try { irObj = newAssetIRJson?.trim() ? JSON.parse(newAssetIRJson) : undefined; } catch { showToast('IR Schema JSON invalid'); return; }
    try {
      const res = await fetch(`/api/admin/ai-steps/prompt-assets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAssetName || 'prompt', promptContent: promptObj, irSchema: irObj, stepId, stepVersionId: versionId })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || res.statusText);
      setNewAssetName(""); setNewAssetPromptJson("{\n  \"messages\": []\n}"); setNewAssetIRJson("{}"); setCreatingForVersion(null);
      await loadPromptAssets(versionId);
      showToast('Prompt asset created');
    } catch (e: any) {
      showToast(`Create prompt failed: ${e?.message || 'error'}`);
    }
  }

  async function bindProductionPrompt(versionId: string, assetId: string | null) {
    try {
      const res = await fetch(`/api/admin/ai-steps/versions/${encodeURIComponent(versionId)}/production-prompt`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || res.statusText);
      await loadPromptAssets(versionId);
      showToast(assetId ? 'Production prompt set' : 'Production prompt cleared');
    } catch (e: any) {
      showToast(`Set production failed: ${e?.message || 'error'}`);
    }
  }

  async function bindDefaultPrompt(versionId: string, assetId: string | null) {
    try {
      const res = await fetch(`/api/admin/ai-steps/versions/${encodeURIComponent(versionId)}/default-prompt`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetId })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || res.statusText);
      await loadPromptAssets(versionId);
      showToast(assetId ? 'Default prompt set' : 'Default prompt cleared');
    } catch (e: any) {
      showToast(`Set default failed: ${e?.message || 'error'}`);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((i) => i.key.toLowerCase().includes(q) || i.name?.toLowerCase().includes(q));
  }, [items, search]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pipelines/steps`);
      // Be resilient to non-JSON responses (e.g., HTML error pages or plain text)
      let json: any = null;
      let textBody: string | null = null;
      try {
        json = await res.json();
      } catch {
        try {
          textBody = await res.text();
        } catch {
          textBody = null;
        }
      }

      if (!res.ok) {
        const message = json?.error || textBody || res.statusText || `Request failed (${res.status})`;
        setError(message);
        return;
      }

      setItems((json && json.data) || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load steps");
    } finally {
      setLoading(false);
    }
  }

  async function createStep() {
    if (!newKey.trim()) return;
    const res = await fetch(`/api/admin/pipelines/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey.trim(), name: newName, description: newDesc, createInitialVersion: true, activateInitial: newActivateInitial }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Create failed: ${j.error || res.statusText}`);
      return;
    }
    setNewKey(""); setNewName(""); setNewDesc(""); setNewActivateInitial(false); setCreateOpen(false);
    load();
    showToast("Step created");
  }

  async function addVersion(stepId: string) {
    let parsed: any = {};
    try { parsed = JSON.parse(newDefaultConfig || "{}"); } catch {
      showToast("Default config must be valid JSON");
      return;
    }
    const res = await fetch(`/api/admin/pipelines/steps/${stepId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: newVersion, defaultConfig: parsed, isActive: newIsActive }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Version create failed: ${j.error || res.statusText}`);
      return;
    }
    setAddVersionFor(null); setNewVersion(""); setNewDefaultConfig("{}"); setNewIsActive(false);
    await load();
    setExpanded((ex) => ({ ...ex, [stepId]: true }));
    showToast("Step version created");
  }

  async function activateVersion(stepId: string, version: string) {
    if (!confirm(`Activate step version ${version}?`)) return;
    const res = await fetch(`/api/admin/pipelines/steps/${stepId}/versions/${encodeURIComponent(version)}/activate`, { method: "POST" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Activation failed: ${j.error || res.statusText}`);
      return;
    }
    load();
    showToast("Step version activated");
  }

  async function startEdit(s: StepDef) {
    setEditId(s.id);
    setEditKey(s.key);
    setEditName(s.name || "");
    setEditDesc(s.description || "");
  }

  async function saveEdit() {
    if (!editId) return;
    const res = await fetch(`/api/admin/pipelines/steps/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: editKey, name: editName, description: editDesc }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Update failed: ${j.error || res.statusText}`);
      return;
    }
    setEditId(null);
    load();
    showToast("Step updated");
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-black text-white text-sm px-3 py-2 rounded shadow">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input className="border rounded px-2 py-1" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <a
            className="px-3 py-1 bg-gray-200 rounded"
            href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009'}/api/monitoring/pipelines/runs`}
            target="_blank"
            rel="noreferrer"
          >Recent Runs (API)</a>
        </div>
        <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setCreateOpen(true)}>New Step</button>
      </div>

      {createOpen && (
        <div className="p-4 border rounded bg-white space-y-2">
          <div className="font-medium">Create Step</div>
          <input className="w-full border rounded px-2 py-1" placeholder="Key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <input className="w-full border rounded px-2 py-1" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className="w-full border rounded px-2 py-1" placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={newActivateInitial} onChange={(e)=>setNewActivateInitial(e.target.checked)} />
            Activate initial version (v1)
          </label>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={createStep}>Create</button>
          </div>
        </div>
      )}

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="p-6 border rounded bg-white text-center text-gray-600">
          <div className="text-lg font-medium text-gray-800">No steps yet</div>
          <div className="mt-1 text-sm">Create your first step to get started with the step-first workflow.</div>
          <div className="mt-3">
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setCreateOpen(true)}>New Step</button>
          </div>
        </div>
      )}

      {!loading && !error && items.length > 0 && filtered.length === 0 && (
        <div className="p-4 border rounded bg-white text-center text-gray-600">
          <div className="font-medium text-gray-800">No steps match your search</div>
          <div className="mt-2 flex justify-center gap-2">
            <button className="px-3 py-1 border rounded" onClick={() => setSearch("")}>Clear search</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filtered.map((s) => (
          <div key={s.id} className="p-4 border rounded bg-white">
            <div className="flex items-start justify-between">
              <div>
                {editId === s.id ? (
                  <div className="space-y-2">
                    <input className="border rounded px-2 py-1 w-full" value={editKey} onChange={(e) => setEditKey(e.target.value)} />
                    <input className="border rounded px-2 py-1 w-full" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <input className="border rounded px-2 py-1 w-full" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setEditId(null)}>Cancel</button>
                      <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={saveEdit}>Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="font-semibold">{s.key}</div>
                    <div className="text-sm text-gray-500">{s.name || ""}</div>
                  </>
                )}
              </div>

              <div className="text-sm text-gray-500 flex items-center gap-3">
                <button
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-white hover:bg-gray-50 text-green-700"
                  onClick={() => { setAddVersionFor(s.id); setNewVersion(""); setNewDefaultConfig("{}"); setNewIsActive(false); setExpanded((ex)=>({...ex, [s.id]: true})); }}
                  title="Create new version"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/></svg>
                  New Version
                </button>
                <button
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-white hover:bg-gray-50"
                  onClick={() => setExpanded((ex) => ({ ...ex, [s.id]: !ex[s.id] }))}
                  aria-expanded={!!expanded[s.id]}
                  title={expanded[s.id] ? 'Hide versions' : 'Show versions'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: expanded[s.id] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
                    <path d="M8 5l8 7-8 7" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Versions: {s.versionCount}</span>
                </button>
                <a
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-white hover:bg-gray-50 text-indigo-700"
                  href={`/maintenance/ai/optimization/step/editor/${encodeURIComponent(s.id)}`}
                  title="Open Step Editor"
                >
                  Step Editor
                </a>
                {editId !== s.id && (
                  <button className="text-blue-600 underline" onClick={() => startEdit(s)}>Edit</button>
                )}
                <button
                  className={`inline-flex items-center gap-1 px-2 py-1 border rounded ${s.versionCount > 0 ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50 text-red-700'}`}
                  onClick={async () => {
                    if (s.versionCount > 0) return;
                    if (!confirm(`Delete step ${s.key}? This cannot be undone.`)) return;
                    const res = await fetch(`/api/admin/pipelines/steps/${s.id}`, { method: 'DELETE' });
                    if (!res.ok && res.status !== 204) {
                      const j = await res.json().catch(()=>({}));
                      showToast(`Delete failed: ${j.error || res.statusText}`);
                      return;
                    }
                    await load();
                    showToast('Step deleted');
                  }}
                  title={s.versionCount > 0 ? 'Cannot delete a step with versions' : 'Delete Step'}
                  disabled={s.versionCount > 0}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round"/><path d="M8 6v14a2 2 0 002 2h4a2 2 0 002-2V6" stroke="#b91c1c" strokeWidth="2"/><path d="M10 10v8M14 10v8" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round"/></svg>
                  Delete
                </button>
              </div>
            </div>

            {expanded[s.id] && (
              <div className="mt-3 border rounded bg-gray-50">
                <div className="px-3 py-2 text-sm font-medium border-b">Versions</div>
                <div className="p-3 space-y-2">
                  {addVersionFor === s.id && (
                    <div className="p-3 bg-white rounded border space-y-2">
                      <div className="text-sm font-medium">Create New Version</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input className="border rounded px-2 py-1 text-sm" placeholder="Version" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} />
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={newIsActive} onChange={(e) => setNewIsActive(e.target.checked)} />
                          Set Active
                        </label>
                        <div className="ml-auto flex gap-2">
                          <button className="px-2 py-1 border rounded bg-gray-100" onClick={()=>{ setAddVersionFor(null); }}>Cancel</button>
                          <button className="px-2 py-1 border rounded bg-green-600 text-white" onClick={()=>addVersion(s.id)}>Create</button>
                        </div>
                      </div>
                      <textarea className="w-full border rounded px-2 py-1 font-mono text-xs" rows={6} placeholder="Default Config (JSON)" value={newDefaultConfig} onChange={(e) => setNewDefaultConfig(e.target.value)} />
                    </div>
                  )}
                  {(!s.versions || s.versions.length === 0) && addVersionFor !== s.id && (
                    <div className="p-2 text-sm text-gray-500 bg-white rounded border">No versions yet</div>
                  )}
                  {s.versions?.map((v) => (
                    <div key={v.id} className="p-2 bg-white rounded border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded border text-sm ${v.isActive ? 'border-green-600 text-green-700' : 'border-gray-300 text-gray-700'}`}>v{v.version}</span>
                          {v.isActive && <span className="text-xs text-green-700">active</span>}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <button
                            className="px-2 py-1 border rounded bg-white hover:bg-gray-50"
                            onClick={() => {
                              setPromptOpen((m) => ({ ...m, [v.id]: !m[v.id] }));
                              if (!promptOpen[v.id]) loadPromptAssets(v.id);
                            }}
                          >Prompts</button>
                          {!v.isActive && (
                            <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-blue-700" onClick={() => activateVersion(s.id, v.version)}>Activate</button>
                          )}
                          {v.isActive && (
                            <button
                              className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-amber-700"
                              onClick={async () => {
                                if (!confirm(`Deactivate active version ${v.version}?`)) return;
                                const res = await fetch(`/api/admin/pipelines/steps/${s.id}/versions/${encodeURIComponent(v.version)}/deactivate`, { method: 'POST' });
                                if (!res.ok) {
                                  const j = await res.json().catch(() => ({}));
                                  showToast(`Deactivate failed: ${j.error || res.statusText}`);
                                  return;
                                }
                                await load();
                                setExpanded((ex) => ({ ...ex, [s.id]: true }));
                                showToast('Version deactivated');
                              }}
                              title="Deactivate version"
                            >
                              Deactivate
                            </button>
                          )}
                          {!v.isActive && (
                            <button
                              className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-red-700"
                              onClick={async () => {
                                if (!confirm(`Delete version ${v.version}? This cannot be undone.`)) return;
                                const res = await fetch(`/api/admin/pipelines/steps/${s.id}/versions/${encodeURIComponent(v.version)}`, { method: 'DELETE' });
                                if (!res.ok && res.status !== 204) {
                                  const j = await res.json().catch(() => ({}));
                                  showToast(`Delete failed: ${j.error || res.statusText}`);
                                  return;
                                }
                                await load();
                                setExpanded((ex) => ({ ...ex, [s.id]: true }));
                                showToast('Version deleted');
                              }}
                              title="Delete version"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {promptOpen[v.id] && (
                        <div className="mt-2 p-2 rounded bg-gray-50 border">
                          <div className="text-sm font-medium mb-2">Prompt Assets</div>
                          <div className="space-y-2">
                            {(assetsByVersion[v.id] || []).map((pa) => (
                              <div key={pa.id} className="flex items-center justify-between p-2 bg-white rounded border">
                                <div className="text-sm">
                                  <div className="font-medium">{pa.name}</div>
                                  <div className="text-xs text-gray-500">{pa.id}</div>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-green-700" onClick={() => bindProductionPrompt(v.id, pa.id)}>Set Production</button>
                                  <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50" onClick={() => bindDefaultPrompt(v.id, pa.id)}>Set Default</button>
                                </div>
                              </div>
                            ))}
                            {(!assetsByVersion[v.id] || assetsByVersion[v.id].length === 0) && (
                              <div className="p-2 bg-white rounded border text-sm text-gray-500">No prompt assets yet</div>
                            )}
                          </div>

                          {creatingForVersion === v.id ? (
                            <div className="mt-3 p-3 bg-white rounded border space-y-2">
                              <div className="text-sm font-medium">Create Prompt Asset</div>
                              <input className="w-full border rounded px-2 py-1 text-sm" placeholder="Name" value={newAssetName} onChange={(e)=>setNewAssetName(e.target.value)} />
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div>
                                  <div className="text-xs text-gray-600 mb-1">Prompt JSON</div>
                                  <textarea className="w-full border rounded px-2 py-1 font-mono text-xs" rows={8} value={newAssetPromptJson} onChange={(e)=>setNewAssetPromptJson(e.target.value)} />
                                </div>
                                <div>
                                  <div className="text-xs text-gray-600 mb-1">IR Schema JSON (optional)</div>
                                  <textarea className="w-full border rounded px-2 py-1 font-mono text-xs" rows={8} value={newAssetIRJson} onChange={(e)=>setNewAssetIRJson(e.target.value)} />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button className="px-2 py-1 border rounded" onClick={()=>{ setCreatingForVersion(null); }}>Cancel</button>
                                <button className="px-2 py-1 border rounded bg-green-600 text-white" onClick={()=>createPromptAsset(s.id, v.id)}>Create</button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2">
                              <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-sm" onClick={()=>{ setCreatingForVersion(v.id); }}>New Prompt Asset</button>
                              <button className="ml-2 px-2 py-1 border rounded bg-white hover:bg-gray-50 text-sm text-green-700" onClick={()=>bindProductionPrompt(v.id, null)}>Clear Production</button>
                              <button className="ml-2 px-2 py-1 border rounded bg-white hover:bg-gray-50 text-sm" onClick={()=>bindDefaultPrompt(v.id, null)}>Clear Default</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
