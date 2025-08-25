"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import API_ENDPOINTS from "@/config/api";

type DomainPhase = {
  id: string;
  flowId: string;
  key: string;
  name: string;
  description: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

async function api<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let err: any = undefined;
    try {
      err = await res.json();
    } catch {}
    throw new Error(err?.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export default function FlowPhasesPage() {
  const params = useParams();
  const router = useRouter();
  const qp = useSearchParams();
  const flowId = String(params?.flowId || "");

  // Guard: ensure context is domain phases, not steps
  const context = qp?.get("context") || "";

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [phases, setPhases] = useState<DomainPhase[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchPhases = useCallback(async () => {
    if (!flowId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ success: boolean; data: DomainPhase[] }>(
        API_ENDPOINTS.ADMIN_PROJECT_FLOW_PHASES(flowId)
      );
      setPhases(data.data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load phases");
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    fetchPhases();
  }, [fetchPhases]);

  // Create phase form state
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const canCreate = useMemo(() => newKey.trim() && newName.trim(), [newKey, newName]);

  const createPhase = useCallback(async () => {
    if (!flowId || !canCreate) return;
    setSaving(true);
    setError(null);
    try {
      await api<{ success: boolean; data: DomainPhase }>(
        API_ENDPOINTS.ADMIN_PROJECT_FLOW_PHASES(flowId),
        {
          method: "POST",
          body: JSON.stringify({ key: newKey.trim(), name: newName.trim(), description: newDesc.trim() || null }),
        }
      );
      setNewKey("");
      setNewName("");
      setNewDesc("");
      await fetchPhases();
    } catch (e: any) {
      setError(e?.message || "Failed to create phase");
    } finally {
      setSaving(false);
    }
  }, [flowId, canCreate, newKey, newName, newDesc, fetchPhases]);

  const updatePhase = useCallback(
    async (phaseId: string, partial: Partial<Pick<DomainPhase, "key" | "name" | "description">>) => {
      setSaving(true);
      setError(null);
      try {
        await api<{ success: boolean; data: DomainPhase }>(API_ENDPOINTS.ADMIN_PHASE(phaseId), {
          method: "PATCH",
          body: JSON.stringify(partial),
        });
        await fetchPhases();
      } catch (e: any) {
        setError(e?.message || "Failed to update phase");
      } finally {
        setSaving(false);
      }
    },
    [fetchPhases]
  );

  const deletePhase = useCallback(
    async (phaseId: string) => {
      if (!confirm("Delete this phase? This cannot be undone.")) return;
      setSaving(true);
      setError(null);
      try {
        await fetch(API_ENDPOINTS.ADMIN_PHASE(phaseId), { method: "DELETE" });
        await fetchPhases();
      } catch (e: any) {
        setError(e?.message || "Failed to delete phase");
      } finally {
        setSaving(false);
      }
    },
    [fetchPhases]
  );

  const movePhase = useCallback(
    async (phaseId: string, direction: -1 | 1) => {
      // compute new order by swapping in local state, then submit full ordered ids
      const idx = phases.findIndex((p) => p.id === phaseId);
      if (idx < 0) return;
      const swapWith = idx + direction;
      if (swapWith < 0 || swapWith >= phases.length) return;
      const reordered = phases.slice();
      const tmp = reordered[idx];
      reordered[idx] = reordered[swapWith];
      reordered[swapWith] = tmp;
      // submit
      setSaving(true);
      setError(null);
      try {
        await api<{ success: boolean }>(API_ENDPOINTS.ADMIN_PHASES_REORDER, {
          method: "POST",
          body: JSON.stringify({ flowId, orderedPhaseIds: reordered.map((p) => p.id) }),
        });
        await fetchPhases();
      } catch (e: any) {
        setError(e?.message || "Failed to reorder phases");
      } finally {
        setSaving(false);
      }
    },
    [phases, flowId, fetchPhases]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Domain Phases</h1>
        <div className="text-sm text-gray-500">
          {saving ? "Saving…" : loading ? "Loading…" : null}
        </div>
      </div>

      {/* Context hint: this route manages domain_phases only */}
      {context && (
        <div className="text-xs text-gray-500">Context: {context}</div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Create new phase */}
      <div className="rounded-md border p-4 space-y-3">
        <div className="font-medium">Create Phase</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Key (unique)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 w-full"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
        </div>
        <div>
          <button
            className="mt-2 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            disabled={!canCreate || saving}
            onClick={createPhase}
          >
            Add Phase
          </button>
        </div>
      </div>

      {/* Phases list */}
      <div className="rounded-md border">
        <div className="px-4 py-2 border-b bg-gray-50 font-medium">Phases</div>
        {loading ? (
          <div className="p-4 text-sm text-gray-500">Loading…</div>
        ) : phases.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No phases yet. Create the first one above.</div>
        ) : (
          <ul className="divide-y">
            {phases
              .slice()
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((p, idx) => (
                <li key={p.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 border text-xs">
                        {idx + 1}
                      </span>
                      <input
                        className="border rounded px-2 py-1 text-sm w-36"
                        title="Key"
                        value={p.key}
                        onChange={(e) => updatePhase(p.id, { key: e.target.value })}
                      />
                      <input
                        className="border rounded px-2 py-1 text-sm w-48"
                        title="Name"
                        value={p.name}
                        onChange={(e) => updatePhase(p.id, { name: e.target.value })}
                      />
                    </div>
                    <div className="mt-2">
                      <input
                        className="border rounded px-2 py-1 text-sm w-full"
                        title="Description"
                        placeholder="Description"
                        value={p.description || ""}
                        onChange={(e) => updatePhase(p.id, { description: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 border rounded text-sm disabled:opacity-50"
                      onClick={() => movePhase(p.id, -1)}
                      disabled={idx === 0 || saving}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      className="px-2 py-1 border rounded text-sm disabled:opacity-50"
                      onClick={() => movePhase(p.id, 1)}
                      disabled={idx === phases.length - 1 || saving}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      className="px-2 py-1 border rounded text-sm text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => deletePhase(p.id)}
                      disabled={saving}
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="text-xs text-gray-500">
        Note: This page manages <strong>domain_phases</strong> only. Step definitions are managed elsewhere.
      </div>
    </div>
  );
}
