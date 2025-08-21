"use client";

import React, { useMemo, useState } from 'react';
import { useIRSchemaManager } from './useIRSchemaManager';
import MonacoJsonEditor from '../../common/MonacoJsonEditor';
import dynamic from 'next/dynamic';
import type { DiffEditorProps } from '@monaco-editor/react';

const DiffEditor = dynamic<DiffEditorProps>(
  () => import('@monaco-editor/react').then(m => m.DiffEditor as any),
  { ssr: false }
);

function tryParseJson(input: string): { ok: boolean; value?: any; error?: string } {
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function IRSchemaManager() {
  const {
    loading,
    error,
    steps,
    stepVersions,
    schemas,
    selectedStepId,
    setSelectedStepId,
    selectedStepVersionId,
    setSelectedStepVersionId,
    selectedStep,
    selectedVersion,
    actions: { createSchema, updateSchema, deleteSchema },
  } = useIRSchemaManager();

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createVersion, setCreateVersion] = useState('v1');
  const [createIsActive, setCreateIsActive] = useState(true);
  const [createJson, setCreateJson] = useState(`{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {}
}`);

  const createParsed = useMemo(() => tryParseJson(createJson), [createJson]);

  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editJson, setEditJson] = useState('');
  const [originalJson, setOriginalJson] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const editParsed = useMemo(() => tryParseJson(editJson), [editJson]);

  const openEdit = (id: string) => {
    const s = schemas.find(x => x.id === id);
    if (!s) return;
    setEditTargetId(id);
    setEditName(s.name);
    const pretty = JSON.stringify(s.schema, null, 2);
    setEditJson(pretty);
    setOriginalJson(pretty);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">IR Schemas Manager</h1>
        <div className="text-sm text-gray-500">Define and activate IR schemas per Step Version</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded p-3">
          <div className="font-medium mb-2">Steps</div>
          <select
            className="w-full border rounded p-2"
            value={selectedStepId || ''}
            onChange={(e) => setSelectedStepId(e.target.value || null)}
          >
            <option value="">Select a step…</option>
            {steps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.key}{s.name ? ` — ${s.name}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border rounded p-3">
          <div className="font-medium mb-2">Step Versions</div>
          <select
            className="w-full border rounded p-2"
            disabled={!selectedStepId}
            value={selectedStepVersionId || ''}
            onChange={(e) => setSelectedStepVersionId(e.target.value || null)}
          >
            <option value="">Select a version…</option>
            {stepVersions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.version}{v.isActive ? ' (active)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border rounded p-3 flex items-end">
          <button
            disabled={!selectedStepVersionId}
            onClick={() => setCreateOpen(true)}
            className={`px-3 py-2 rounded text-white ${selectedStepVersionId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'}`}
          >
            New IR Schema
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
      )}

      <div className="bg-white border rounded">
        <div className="p-3 border-b font-medium flex items-center justify-between">
          <div>
            Schemas {selectedStep ? `for ${selectedStep.key}` : ''}
            {selectedVersion ? ` / ${selectedVersion.version}` : ''}
          </div>
          {loading && <div className="text-sm text-gray-500">Loading…</div>}
        </div>
        <div className="divide-y">
          {schemas.length === 0 && (
            <div className="p-4 text-gray-500">No schemas yet.</div>
          )}
          {schemas.map((s) => (
            <div key={s.id} className="p-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">
                  {s.name} <span className="text-gray-500">({s.version})</span> {s.isActive && <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">active</span>}
                </div>
                <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40 border">{JSON.stringify(s.schema, null, 2)}</pre>
              </div>
              <div className="flex gap-2">
                <button className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded" onClick={() => openEdit(s.id)}>Edit</button>
                {!s.isActive && (
                  <button
                    className="px-2 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
                    onClick={async () => {
                      await updateSchema(s.id, { isActive: true });
                    }}
                  >
                    Activate
                  </button>
                )}
                <button
                  className="px-2 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
                  onClick={async () => {
                    try {
                      await deleteSchema(s.id);
                    } catch (e) {
                      // surface common guard error
                      alert(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-3xl overflow-hidden">
            <div className="p-3 border-b font-medium">Create IR Schema</div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Name</label>
                  <input className="w-full border rounded p-2" value={createName} onChange={(e) => setCreateName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Version</label>
                  <input className="w-full border rounded p-2" value={createVersion} onChange={(e) => setCreateVersion(e.target.value)} />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={createIsActive} onChange={(e) => setCreateIsActive(e.target.checked)} />
                Mark as active
              </label>
              <div>
                <label className="block text-sm text-gray-600 mb-1">JSON Schema</label>
                <MonacoJsonEditor value={createJson} onChange={setCreateJson} height={320} validateAsJsonSchema />
                {!createParsed.ok && (
                  <div className="mt-2 text-sm text-red-600">JSON parse error: {createParsed.error}</div>
                )}
              </div>
            </div>
            <div className="p-3 border-t flex justify-end gap-2">
              <button className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button
                disabled={!selectedStepVersionId || !createName || !createParsed.ok}
                className={`px-3 py-1 rounded text-white ${selectedStepVersionId && createName && createParsed.ok ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'}`}
                onClick={async () => {
                  if (!selectedStepVersionId || !createParsed.ok) return;
                  await createSchema({ stepVersionId: selectedStepVersionId, name: createName, version: createVersion, schema: createParsed.value, isActive: createIsActive });
                  setCreateOpen(false);
                  setCreateName('');
                  setCreateVersion('v1');
                  setCreateIsActive(true);
                  setCreateJson(`{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {}
}`);
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTargetId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-3xl overflow-hidden">
            <div className="p-3 border-b font-medium">Edit IR Schema</div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Name</label>
                <input className="w-full border rounded p-2" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-gray-600">JSON Schema</label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} />
                    Show diff
                  </label>
                </div>
                {showDiff ? (
                  <div className="h-[320px] border rounded overflow-hidden">
                    <DiffEditor
                      original={originalJson}
                      modified={editJson}
                      language="json"
                      options={{
                        readOnly: false,
                        renderSideBySide: true,
                        automaticLayout: true,
                        minimap: { enabled: false },
                      } as any}
                      onChange={(v) => setEditJson(v || '')}
                    />
                  </div>
                ) : (
                  <MonacoJsonEditor value={editJson} onChange={setEditJson} height={320} validateAsJsonSchema />
                )}
                {!editParsed.ok && (
                  <div className="mt-2 text-sm text-red-600">JSON parse error: {editParsed.error}</div>
                )}
              </div>
            </div>
            <div className="p-3 border-t flex justify-end gap-2">
              <button className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200" onClick={() => setEditTargetId(null)}>Cancel</button>
              <button
                disabled={!editParsed.ok || !editName}
                className={`px-3 py-1 rounded text-white ${editParsed.ok && editName ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400'}`}
                onClick={async () => {
                  if (!editTargetId || !editParsed.ok) return;
                  await updateSchema(editTargetId, { name: editName, schema: editParsed.value });
                  setEditTargetId(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
