"use client";
import React, { useEffect, useMemo, useState } from "react";

type StepVersion = { id: string; version: string; isActive: boolean };

type StepDef = { id: string; key: string; name?: string; versions: StepVersion[] };

type IRSchema = { id: string; name: string; version: string; isActive: boolean; schema: any };

export default function IRSchemasPage() {
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedStepVersionId, setSelectedStepVersionId] = useState<string | null>(null);
  const [schemas, setSchemas] = useState<IRSchema[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [schemaName, setSchemaName] = useState("");
  const [schemaVersion, setSchemaVersion] = useState("");
  const [schemaJson, setSchemaJson] = useState("{\n  \"type\": \"object\"\n}");
  const [schemaActive, setSchemaActive] = useState(false);

  // edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editVersion, setEditVersion] = useState("");
  const [editJson, setEditJson] = useState("{}");

  // toasts
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const filteredSteps = useMemo(() => {
    const q = search.toLowerCase();
    return steps.filter((s) => s.key.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q));
  }, [steps, search]);

  async function loadSteps() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pipelines/steps`);
      const json = await res.json();
      setSteps((json.data || []).map((s: any) => ({ id: s.id, key: s.key, name: s.name, versions: s.versions })));
    } catch (e: any) {
      setError(e?.message || "Failed to load steps");
    } finally { setLoading(false); }
  }

  async function loadSchemas(stepVersionId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pipelines/steps/versions/${stepVersionId}/ir-schemas`);
      const json = await res.json();
      setSchemas(json.data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load IR Schemas");
    } finally { setLoading(false); }
  }

  async function createSchema() {
    if (!selectedStepVersionId) return;
    let parsed: any;
    try { parsed = JSON.parse(schemaJson); } catch {
      showToast("Schema JSON must be valid JSON");
      return;
    }
    const res = await fetch(`/api/admin/pipelines/steps/versions/${selectedStepVersionId}/ir-schemas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: schemaName, version: schemaVersion, schema: parsed, isActive: schemaActive }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Create failed: ${j.error || res.statusText}`);
      return;
    }
    setCreateOpen(false); setSchemaName(""); setSchemaVersion(""); setSchemaJson("{\n  \"type\": \"object\"\n}"); setSchemaActive(false);
    loadSchemas(selectedStepVersionId);
    showToast("IR Schema created");
  }

  async function activateSchema(id: string) {
    const res = await fetch(`/api/admin/pipelines/ir-schemas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Activation failed: ${j.error || res.statusText}`);
      return;
    }
    if (selectedStepVersionId) loadSchemas(selectedStepVersionId);
    showToast("Schema activated");
  }

  async function deleteSchema(id: string) {
    if (!confirm("Delete schema?")) return;
    const res = await fetch(`/api/admin/pipelines/ir-schemas/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Delete failed: ${j.error || res.statusText}`);
      return;
    }
    if (selectedStepVersionId) loadSchemas(selectedStepVersionId);
    showToast("Schema deleted");
  }

  function startEdit(sc: IRSchema) {
    setEditId(sc.id);
    setEditName(sc.name);
    setEditVersion(sc.version);
    setEditJson(JSON.stringify(sc.schema ?? {}, null, 2));
  }

  async function saveEdit() {
    if (!editId) return;
    let parsed: any;
    try { parsed = JSON.parse(editJson || "{}"); } catch {
      showToast("Schema JSON must be valid JSON");
      return;
    }
    const res = await fetch(`/api/admin/pipelines/ir-schemas/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, version: editVersion, schema: parsed }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      showToast(`Update failed: ${j.error || res.statusText}`);
      return;
    }
    setEditId(null);
    if (selectedStepVersionId) loadSchemas(selectedStepVersionId);
    showToast("Schema updated");
  }

  useEffect(() => { loadSteps(); }, []);

  useEffect(() => {
    if (selectedStepId) {
      const v = steps.find((s) => s.id === selectedStepId)?.versions?.[0];
      const vId = v?.id || null;
      setSelectedStepVersionId(vId);
      if (vId) loadSchemas(vId);
      else setSchemas([]);
    } else {
      setSelectedStepVersionId(null);
      setSchemas([]);
    }
  }, [selectedStepId, steps]);

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-black text-white text-sm px-3 py-2 rounded shadow">{toast}</div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">IR Schemas</h2>
        <div className="flex items-center gap-2">
          <input className="border rounded px-2 py-1" placeholder="Search steps…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <a
            className="px-3 py-1 bg-gray-200 rounded"
            href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009'}/api/monitoring/pipelines/runs`}
            target="_blank"
            rel="noreferrer"
          >Recent Runs (API)</a>
        </div>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      <div className="grid grid-cols-1 gap-4">
        <div className="p-4 border rounded bg-white">
          <div className="font-medium mb-2">Select Step</div>
          <select className="border rounded px-2 py-1" value={selectedStepId || ""} onChange={(e) => setSelectedStepId(e.target.value || null)}>
            <option value="">-- choose step --</option>
            {filteredSteps.map((s) => (
              <option key={s.id} value={s.id}>{s.key} {s.name ? `- ${s.name}` : ""}</option>
            ))}
          </select>

          {selectedStepId && (
            <div className="mt-3">
              <div className="text-sm mb-1">Step Versions</div>
              <div className="flex flex-wrap gap-2">
                {steps.find((s) => s.id === selectedStepId)?.versions?.map((v) => (
                  <button
                    key={v.id}
                    className={`px-2 py-1 rounded border ${selectedStepVersionId === v.id ? 'border-blue-600 text-blue-700' : 'border-gray-300 text-gray-700'}`}
                    onClick={() => { setSelectedStepVersionId(v.id); loadSchemas(v.id); }}
                  >v{v.version} {v.isActive ? '(active)' : ''}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedStepVersionId && (
          <div className="p-4 border rounded bg-white">
            <div className="flex items-center justify-between">
              <div className="font-medium">Schemas</div>
              <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setCreateOpen(true)}>New Schema</button>
            </div>
            <div className="mt-3 space-y-2">
              {schemas.map((sc) => (
                <div key={sc.id} className="p-3 border rounded">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{sc.name} v{sc.version} {sc.isActive ? <span className="text-green-700">(active)</span> : null}</div>
                    <div className="flex items-center gap-2">
                      {!sc.isActive && (
                        <button className="text-blue-600 underline text-sm" onClick={() => activateSchema(sc.id)}>Activate</button>
                      )}
                      <button className="text-blue-600 underline text-sm" onClick={() => startEdit(sc)}>Edit</button>
                      <button className="text-red-600 underline text-sm" onClick={() => deleteSchema(sc.id)}>Delete</button>
                    </div>
                  </div>
                  {editId === sc.id ? (
                    <div className="mt-2 space-y-2">
                      <input className="w-full border rounded px-2 py-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <input className="w-full border rounded px-2 py-1" value={editVersion} onChange={(e) => setEditVersion(e.target.value)} />
                      <textarea className="w-full border rounded px-2 py-1 font-mono text-xs" rows={10} value={editJson} onChange={(e) => setEditJson(e.target.value)} />
                      <div className="flex gap-2">
                        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setEditId(null)}>Cancel</button>
                        <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={saveEdit}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <pre className="mt-2 bg-gray-50 p-2 rounded overflow-auto text-xs"><code>{JSON.stringify(sc.schema, null, 2)}</code></pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {createOpen && (
        <div className="p-4 border rounded bg-white space-y-2">
          <div className="font-medium">Create IR Schema</div>
          <input className="w-full border rounded px-2 py-1" placeholder="Name" value={schemaName} onChange={(e) => setSchemaName(e.target.value)} />
          <input className="w-full border rounded px-2 py-1" placeholder="Version" value={schemaVersion} onChange={(e) => setSchemaVersion(e.target.value)} />
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={schemaActive} onChange={(e) => setSchemaActive(e.target.checked)} />
            Set Active
          </label>
          <textarea className="w-full border rounded px-2 py-1 font-mono text-xs" rows={10} placeholder="Schema JSON" value={schemaJson} onChange={(e) => setSchemaJson(e.target.value)} />
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={createSchema}>Create</button>
          </div>
        </div>
      )}
    </div>
  );
}
