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

  // edit form state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // toasts
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
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
    if (!newName.trim()) return;
    const res = await fetch(`/api/admin/pipelines/pipelines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDesc }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Create failed: ${j.error || res.statusText}`);
      return;
    }
    setNewName("");
    setNewDesc("");
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
    const res = await fetch(`/api/admin/pipelines/pipelines/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc }),
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
        <h2 className="text-xl font-semibold">Pipelines</h2>
        <div className="flex items-center gap-2">
          <input
            className="border rounded px-2 py-1"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <a
            className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded"
            href="/maintenance/pipelines/manage-steps"
            title="Manage steps for a single pipeline"
          >Manage Steps</a>
          <a
            className="px-3 py-1 bg-gray-200 rounded"
            href="/maintenance/pipelines/runs"
          >Recent Runs</a>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setCreateOpen(true)}>New Pipeline</button>
        </div>
      </div>

      {createOpen && (
        <div className="p-4 border rounded bg-white space-y-2">
          <div className="font-medium">Create Pipeline</div>
          <input className="w-full border rounded px-2 py-1" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className="w-full border rounded px-2 py-1" placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={createPipeline}>Create</button>
          </div>
        </div>
      )}

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      <div className="grid grid-cols-1 gap-4">
        {filtered.map((p) => (
          <div key={p.id} className="p-4 border rounded bg-white">
            <div className="flex items-start justify-between">
              <div>
                {editId === p.id ? (
                  <div className="space-y-2">
                    <input className="border rounded px-2 py-1 w-full" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <input className="border rounded px-2 py-1 w-full" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
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
                <span>Versions: {p.versionCount}</span>
                <a
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-white hover:bg-gray-50 text-indigo-700"
                  href={`/maintenance/pipelines/manage-steps?pipelineId=${encodeURIComponent(p.id)}${p.versions?.find(v=>v.isActive) ? `&version=${encodeURIComponent(p.versions.find(v=>v.isActive)!.version)}` : ''}`}
                  title="Manage Steps"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 8h18M3 16h18M8 3v18" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/></svg>
                  Manage Steps
                </a>
                {p.versions?.find(v=>v.isActive) ? (
                  <a
                    className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-white hover:bg-gray-50 text-indigo-700"
                    href={`/maintenance/pipelines/${encodeURIComponent(p.id)}/versions/${encodeURIComponent(p.versions.find(v=>v.isActive)!.version)}`}
                    title="Manage DAG (active)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 3v6h6" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/><path d="M6 9l4 4" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/><circle cx="18" cy="6" r="3" stroke="#4f46e5" strokeWidth="2"/><circle cx="10" cy="16" r="3" stroke="#4f46e5" strokeWidth="2"/></svg>
                    Manage DAG
                  </a>
                ) : (
                  <button className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-gray-50 text-gray-400 cursor-not-allowed" title="No active version" disabled>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 3v6h6" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/></svg>
                    Manage DAG
                  </button>
                )}
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
              </div>
            </div>
            {p.versions?.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium mb-1">Versions</div>
                <div className="flex flex-wrap gap-2">
                  {p.versions.map((v) => (
                    <span key={v.id} className={`inline-flex items-center gap-2 px-2 py-1 rounded border ${v.isActive ? 'border-green-600 text-green-700' : 'border-gray-300 text-gray-700'}`}>
                      v{v.version}
                      {!v.isActive && (
                        <button className="text-blue-600 text-xs underline" onClick={() => activateVersion(p.id, v.version)}>Activate</button>
                      )}
                      {v.isActive && <span className="text-xs">(active)</span>}
                    </span>
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
