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

  const [addVersionFor, setAddVersionFor] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState("");
  const [newDefaultConfig, setNewDefaultConfig] = useState("{}");
  const [newIsActive, setNewIsActive] = useState(false);

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((i) => i.key.toLowerCase().includes(q) || i.name?.toLowerCase().includes(q));
  }, [items, search]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pipelines/steps`);
      const json = await res.json();
      setItems(json.data || []);
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
      body: JSON.stringify({ key: newKey.trim(), name: newName, description: newDesc }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Create failed: ${j.error || res.statusText}`);
      return;
    }
    setNewKey(""); setNewName(""); setNewDesc(""); setCreateOpen(false);
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
    load();
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
        <h2 className="text-xl font-semibold">Steps</h2>
        <div className="flex items-center gap-2">
          <input className="border rounded px-2 py-1" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <a
            className="px-3 py-1 bg-gray-200 rounded"
            href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009'}/api/monitoring/pipelines/runs`}
            target="_blank"
            rel="noreferrer"
          >Recent Runs (API)</a>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setCreateOpen(true)}>New Step</button>
        </div>
      </div>

      {createOpen && (
        <div className="p-4 border rounded bg-white space-y-2">
          <div className="font-medium">Create Step</div>
          <input className="w-full border rounded px-2 py-1" placeholder="Key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <input className="w-full border rounded px-2 py-1" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className="w-full border rounded px-2 py-1" placeholder="Description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={createStep}>Create</button>
          </div>
        </div>
      )}

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

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
                    <div className="text-sm text-gray-500">{s.description || ""}</div>
                  </>
                )}
              </div>
              <div className="text-sm text-gray-500 flex items-center gap-3">
                <span>Versions: {s.versionCount}</span>
                {editId !== s.id && (
                  <button className="text-blue-600 underline" onClick={() => startEdit(s)}>Edit</button>
                )}
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Versions</div>
                <button className="text-blue-600 text-sm underline" onClick={() => setAddVersionFor(s.id)}>Add Version</button>
              </div>
              {s.versions?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {s.versions.map((v) => (
                    <span key={v.id} className={`inline-flex items-center gap-2 px-2 py-1 rounded border ${v.isActive ? 'border-green-600 text-green-700' : 'border-gray-300 text-gray-700'}`}>
                      v{v.version}
                      {!v.isActive && (
                        <button className="text-blue-600 text-xs underline" onClick={() => activateVersion(s.id, v.version)}>Activate</button>
                      )}
                      {v.isActive && <span className="text-xs">(active)</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {addVersionFor === s.id && (
              <div className="mt-3 p-3 border rounded bg-gray-50 space-y-2">
                <div className="font-medium text-sm">New Version</div>
                <input className="w-full border rounded px-2 py-1" placeholder="Version" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} />
                <textarea className="w-full border rounded px-2 py-1 font-mono text-xs" rows={6} placeholder="Default Config (JSON)" value={newDefaultConfig} onChange={(e) => setNewDefaultConfig(e.target.value)} />
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newIsActive} onChange={(e) => setNewIsActive(e.target.checked)} />
                  Set Active
                </label>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setAddVersionFor(null)}>Cancel</button>
                  <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => addVersion(s.id)}>Create</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
