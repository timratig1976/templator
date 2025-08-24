"use client";
import React, { useEffect, useMemo, useState } from "react";

type PipelineVersion = { id: string; version: string; isActive: boolean };

type PipelineDef = {
  id: string;
  name: string;
  description?: string;
  versionCount: number;
  versions: PipelineVersion[];
};

export default function PipelinesPage() {
  const [items, setItems] = useState<PipelineDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newActivateInitial, setNewActivateInitial] = useState<boolean>(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  // edit form state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editErr, setEditErr] = useState<string | null>(null);

  // delete modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PipelineDef | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // row expand/collapse
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // create version UI state
  const [addVersionForId, setAddVersionForId] = useState<string | null>(null);
  const [addVersionLabel, setAddVersionLabel] = useState<string>("");
  const [addVersionActive, setAddVersionActive] = useState<boolean>(false);
  const [addVersionErr, setAddVersionErr] = useState<string | null>(null);

  // toasts
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function createPipelineVersion(pipelineId: string) {
    setAddVersionErr(null);
    const label = addVersionLabel.trim();
    if (!label) { setAddVersionErr("Version label is required"); return; }
    try {
      const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(pipelineId)}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: label, dag: { nodes: [] }, config: {}, isActive: addVersionActive }),
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || res.statusText);
      // reset and reload
      setAddVersionForId(null);
      setAddVersionLabel("");
      setAddVersionActive(false);
      await load();
      showToast(addVersionActive ? 'Version created and activated' : 'Version created');
      setExpanded((ex) => ({ ...ex, [pipelineId]: true }));
    } catch (e:any) {
      setAddVersionErr(e?.message || 'Failed to create version');
    }
  }


  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
  }, [items, search]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pipelines/pipelines`);
      const json = await res.json();
      setItems(json.data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  }

  async function createPipeline() {
    setCreateErr(null);
    const nm = newName.trim();
    if (!nm) { setCreateErr("Name is required"); return; }
    // uniqueness (case-insensitive)
    if (items.some(i => i.name.toLowerCase() === nm.toLowerCase())) {
      setCreateErr("A pipeline with this name already exists");
      return;
    }
    const res = await fetch(`/api/admin/pipelines/pipelines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nm, description: newDesc, createInitialVersion: true, activateInitial: newActivateInitial }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Create failed: ${j.error || res.statusText}`);
      return;
    }
    setNewName("");
    setNewDesc("");
    setNewActivateInitial(false);
    setCreateOpen(false);
    load();
    showToast("Pipeline created");
  }

  async function activateVersion(pipelineId: string, version: string) {
    if (!confirm(`Activate version ${version}?`)) return;
    const res = await fetch(`/api/admin/pipelines/pipelines/${pipelineId}/versions/${encodeURIComponent(version)}/activate`, { method: "POST" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Activation failed: ${j.error || res.statusText}`);
      return;
    }
    load();
    showToast("Version activated");
  }

  async function startEdit(p: PipelineDef) {
    setEditId(p.id);
    setEditName(p.name);
    setEditDesc(p.description || "");
  }

  async function saveEdit() {
    if (!editId) return;
    setEditErr(null);
    const nm = editName.trim();
    if (!nm) { setEditErr("Name is required"); return; }
    if (items.some(i => i.id !== editId && i.name.toLowerCase() === nm.toLowerCase())) {
      setEditErr("A pipeline with this name already exists");
      return;
    }
    const res = await fetch(`/api/admin/pipelines/pipelines/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nm, description: editDesc }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Update failed: ${j.error || res.statusText}`);
      return;
    }
    setEditId(null);
    load();
    showToast("Pipeline updated");
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-black text-white text-sm px-3 py-2 rounded shadow">{toast}</div>
      )}
      <div className="flex items-center justify-between">
        {/* Left-aligned space for filters/search (if any) */}
        <div className="flex items-center gap-2" />
        {/* Right-aligned primary action */}
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setCreateOpen(true)}>New Pipeline</button>
        </div>
      </div>

      {createOpen && (
        <div className="p-4 border rounded bg-white space-y-2">
          <div className="font-medium">Create Pipeline</div>
          <input className="w-full border rounded px-2 py-1" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className="w-full border rounded px-2 py-1" placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={newActivateInitial} onChange={(e)=>setNewActivateInitial(e.target.checked)} />
            Activate initial version (v1)
          </label>
          {createErr && <div className="text-sm text-red-600">{createErr}</div>}
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={createPipeline}>Create</button>
          </div>
        </div>
      )}

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {/* Empty state when there are no pipelines at all */}
      {!loading && !error && items.length === 0 && (
        <div className="p-6 border rounded bg-white text-center text-gray-600">
          <div className="text-lg font-medium text-gray-800">No pipelines yet</div>
          <div className="mt-1 text-sm">Create your first pipeline to get started.</div>
          <div className="mt-3">
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setCreateOpen(true)}>New Pipeline</button>
          </div>
        </div>
      )}

      {/* Empty state when search yields no results but pipelines exist */}
      {!loading && !error && items.length > 0 && filtered.length === 0 && (
        <div className="p-4 border rounded bg-white text-center text-gray-600">
          <div className="font-medium text-gray-800">No pipelines match your search</div>
          <div className="mt-2 flex justify-center gap-2">
            <button className="px-3 py-1 border rounded" onClick={() => setSearch("")}>Clear search</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filtered.map((p) => (
          <div key={p.id} className="p-4 border rounded bg-white">
            <div className="flex items-start justify-between">
              <div>
                {editId === p.id ? (
                  <div className="space-y-2">
                    <input className="border rounded px-2 py-1 w-full" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <input className="border rounded px-2 py-1 w-full" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                    {editErr && <div className="text-sm text-red-600">{editErr}</div>}
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setEditId(null)}>Cancel</button>
                      <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={saveEdit}>Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-gray-500">{p.description || ""}</div>
                  </>
                )}
              </div>
              <div className="text-sm text-gray-500 flex items-center gap-3">
                <button
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-white hover:bg-gray-50 text-green-700"
                  onClick={() => { setAddVersionForId(p.id); setAddVersionLabel(""); setAddVersionActive(false); setAddVersionErr(null); setExpanded((ex)=>({...ex, [p.id]: true})); }}
                  title="Create new version"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/></svg>
                  New Version
                </button>
                <button
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-white hover:bg-gray-50"
                  onClick={() => setExpanded((ex) => ({ ...ex, [p.id]: !ex[p.id] }))}
                  aria-expanded={!!expanded[p.id]}
                  title={expanded[p.id] ? 'Hide versions' : 'Show versions'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: expanded[p.id] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
                    <path d="M8 5l8 7-8 7" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Versions: {p.versionCount}</span>
                </button>
                <a
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-white hover:bg-gray-50 text-indigo-700"
                  href={`/maintenance/pipelines/manage-steps?pipelineId=${encodeURIComponent(p.id)}${p.versions?.find(v=>v.isActive) ? `&version=${encodeURIComponent(p.versions.find(v=>v.isActive)!.version)}` : ''}`}
                  title="Manage Steps"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 8h18M3 16h18M8 3v18" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/></svg>
                  Manage Steps
                </a>
                
                <a
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-white hover:bg-gray-50 text-gray-700"
                  href={`/maintenance/pipelines/runs${p.versions?.find(v=>v.isActive) ? `?pvId=${encodeURIComponent(p.versions.find(v=>v.isActive)!.id)}&pvLabel=${encodeURIComponent('v'+p.versions.find(v=>v.isActive)!.version)}` : ''}`}
                  title="Recent Runs"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="9" stroke="#374151" strokeWidth="2"/>
                    <path d="M12 7v5l3 3" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Recent Runs
                </a>
                {editId !== p.id && (
                  <button
                    className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-white hover:bg-gray-50 text-gray-700"
                    onClick={() => startEdit(p)}
                    title="Edit Pipeline"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20h9" stroke="#374151" strokeWidth="2" strokeLinecap="round"/><path d="M16.5 3.5a2.121 2.121 0 013 3L8 18l-4 1 1-4 11.5-11.5z" stroke="#374151" strokeWidth="2"/></svg>
                    Edit
                  </button>
                )}
                <button
                  className={`inline-flex items-center gap-1 px-2 py-1 border rounded ${p.versions?.some(v=>v.isActive) ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50 text-red-700'}`}
                  onClick={() => { if (!p.versions?.some(v=>v.isActive)) { setDeleteTarget(p); setDeleteConfirm(''); setDeleteOpen(true); } }}
                  title={p.versions?.some(v=>v.isActive) ? 'Cannot delete a pipeline with an active version' : 'Delete Pipeline'}
                  disabled={p.versions?.some(v=>v.isActive)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round"/><path d="M8 6v14a2 2 0 002 2h4a2 2 0 002-2V6" stroke="#b91c1c" strokeWidth="2"/><path d="M10 10v8M14 10v8" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round"/></svg>
                  Delete
                </button>
              </div>
            </div>
            {expanded[p.id] && (
              <div className="mt-3 border rounded bg-gray-50">
                <div className="px-3 py-2 text-sm font-medium border-b">Versions</div>
                <div className="p-3 space-y-2">
                  {addVersionForId === p.id && (
                    <div className="p-3 bg-white rounded border space-y-2">
                      <div className="text-sm font-medium">Create New Version</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input className="border rounded px-2 py-1 text-sm" placeholder="Version label (e.g. 1.0.0)" value={addVersionLabel} onChange={(e)=>setAddVersionLabel(e.target.value)} />
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={addVersionActive} onChange={(e)=>setAddVersionActive(e.target.checked)} />
                          Activate after create
                        </label>
                        <div className="ml-auto flex gap-2">
                          <button className="px-2 py-1 border rounded bg-gray-100" onClick={()=>{ setAddVersionForId(null); setAddVersionErr(null); }}>Cancel</button>
                          <button className="px-2 py-1 border rounded bg-green-600 text-white" onClick={()=>createPipelineVersion(p.id)}>Create</button>
                        </div>
                      </div>
                      {addVersionErr && <div className="text-xs text-red-600">{addVersionErr}</div>}
                    </div>
                  )}
                  {p.versions?.length === 0 && addVersionForId !== p.id && (
                    <div className="p-2 text-sm text-gray-500 bg-white rounded border">No versions yet</div>
                  )}
                  {p.versions?.map((v) => (
                    <div key={v.id} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded border text-sm ${v.isActive ? 'border-green-600 text-green-700' : 'border-gray-300 text-gray-700'}`}>v{v.version}</span>
                        {v.isActive && <span className="text-xs text-green-700">active</span>}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {!v.isActive && (
                          <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-blue-700" onClick={() => activateVersion(p.id, v.version)}>Activate</button>
                        )}
                        <a
                          className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-indigo-700"
                          href={`/maintenance/pipelines/manage-steps?pipelineId=${encodeURIComponent(p.id)}&version=${encodeURIComponent(v.version)}`}
                        >Manage Steps</a>
                        <a
                          className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-gray-700"
                          href={`/maintenance/pipelines/runs?pvId=${encodeURIComponent(v.id)}&pvLabel=${encodeURIComponent('v'+v.version)}`}
                        >Recent Runs</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {deleteOpen && deleteTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-4 w-full max-w-md space-y-3">
            <div className="font-semibold text-red-700">Delete Pipeline</div>
            <div className="text-sm">This action permanently deletes pipeline <span className="font-medium">{deleteTarget.name}</span>. Type the pipeline name to confirm.</div>
            <input className="border rounded px-2 py-1 w-full" placeholder={deleteTarget.name} value={deleteConfirm} onChange={(e)=>setDeleteConfirm(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-1 bg-gray-200 rounded" onClick={()=>{setDeleteOpen(false); setDeleteTarget(null);}}>Cancel</button>
              <button
                className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-60"
                disabled={deleteConfirm !== deleteTarget.name}
                onClick={async ()=>{
                  if (!deleteTarget) return;
                  try {
                    const res = await fetch(`/api/admin/pipelines/pipelines/${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' });
                    const j = await res.json().catch(()=>({}));
                    if (!res.ok) throw new Error(j?.error || res.statusText);
                    setDeleteOpen(false); setDeleteTarget(null);
                    showToast('Pipeline deleted');
                    load();
                  } catch (e:any) {
                    showToast(`Delete failed: ${e?.message || 'Unknown error'}`);
                  }
                }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

