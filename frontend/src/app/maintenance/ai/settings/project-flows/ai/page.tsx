"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import API_ENDPOINTS from "@/config/api";
import adminProjectFlowsService from "@/services/adminProjectFlowsService";

type ProjectFlow = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
};

type Proposal = {
  phases: Array<{
    key: string;
    name: string;
    steps: Array<{
      stepId: string;
      stepKey?: string | null;
      stepName?: string | null;
      confidence?: number;
      rationale?: string;
      orderIndex: number;
    }>;
  }>;
  summary?: { totalSteps: number; proposedStepCount: number; tokensConsidered: number };
};

export default function GenerateFlowFromBriefPage() {
  const backend = useMemo(() => API_ENDPOINTS, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flows, setFlows] = useState<ProjectFlow[]>([]);

  // Form state
  const [brief, setBrief] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [flowKey, setFlowKey] = useState("");
  const [flowName, setFlowName] = useState("");
  const [flowDescription, setFlowDescription] = useState("");
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [overwrite, setOverwrite] = useState(false);

  // Results
  const [dryRunData, setDryRunData] = useState<{ proposal: Proposal } | null>(null);
  const [applied, setApplied] = useState<{ flow?: ProjectFlow; createdPhase?: any } | null>(null);

  useEffect(() => {
    // Load existing flows for selection
    (async () => {
      try {
        const res = await fetch(backend.ADMIN_PROJECT_FLOWS, { cache: "no-store" });
        const json = await res.json();
        if (json?.success) setFlows(json.data || []);
      } catch {
        // non-fatal
      }
    })();
  }, [backend]);

  async function onDryRun() {
    setError(null);
    setApplied(null);
    setDryRunData(null);
    if (!brief.trim()) {
      setError("Please enter a brief.");
      return;
    }
    setLoading(true);
    try {
      const data = await adminProjectFlowsService.generateFromBrief({ brief: brief.trim(), apply: false });
      setDryRunData({ proposal: data.proposal });
    } catch (e: any) {
      setError(e?.message || "Failed to run dry-run");
    } finally {
      setLoading(false);
    }
  }

  async function onApply() {
    setError(null);
    setApplied(null);
    if (!brief.trim()) {
      setError("Please enter a brief.");
      return;
    }
    if (mode === "existing" && !selectedFlowId) {
      setError("Select a target flow or switch to Create New.");
      return;
    }
    if (mode === "new" && (!flowKey || !flowName)) {
      setError("Provide key and name for the new flow.");
      return;
    }
    setLoading(true);
    try {
      const params: any = { brief: brief.trim(), apply: true, overwrite };
      if (mode === "existing") params.flowId = selectedFlowId;
      if (mode === "new") {
        params.flowKey = flowKey.trim();
        params.flowName = flowName.trim();
        params.description = flowDescription.trim() || null;
      }
      const data = await adminProjectFlowsService.generateFromBrief(params);
      setApplied({ flow: data.flow, createdPhase: data.createdPhase });
      // Refresh flows list
      const res = await fetch(backend.ADMIN_PROJECT_FLOWS, { cache: "no-store" });
      const json = await res.json();
      if (json?.success) setFlows(json.data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to apply generation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Create Project Flow via AI</h2>
        <Link className="text-sm underline" href="/maintenance/ai/settings/project-flows">Back to Project Flows</Link>
      </div>
      <p className="text-sm text-gray-600">Provide a brief describing the project. We'll propose a phase with steps mapped to existing AI Step Definitions. You can preview (dry-run) and then apply to create or update a flow.</p>

      {/* Brief input */}
      <div className="rounded border bg-white p-4 space-y-2">
        <div className="text-sm font-medium">Brief</div>
        <textarea
          className="w-full border rounded p-2 text-sm"
          rows={6}
          placeholder="e.g., Build a marketing landing page with image processing, AI HTML generation, QA checks, and packaging"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />
      </div>

      {/* Target selection */}
      <div className="rounded border bg-white p-4 space-y-3">
        <div className="text-sm font-medium">Target Flow</div>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} /> Create New
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} /> Use Existing
          </label>
        </div>

        {mode === "new" ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input className="border rounded px-2 py-1" placeholder="Flow key (unique)" value={flowKey} onChange={(e)=>setFlowKey(e.target.value)} />
            <input className="border rounded px-2 py-1" placeholder="Flow name" value={flowName} onChange={(e)=>setFlowName(e.target.value)} />
            <input className="border rounded px-2 py-1 md:col-span-1" placeholder="Description (optional)" value={flowDescription} onChange={(e)=>setFlowDescription(e.target.value)} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select className="border rounded px-2 py-1" value={selectedFlowId} onChange={(e)=>setSelectedFlowId(e.target.value)}>
              <option value="">Select flow…</option>
              {flows.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.key})</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={overwrite} onChange={(e)=>setOverwrite(e.target.checked)} /> Overwrite existing phases
            </label>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="px-3 py-1 rounded border" onClick={onDryRun} disabled={loading}>Dry Run</button>
        <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={onApply} disabled={loading}>Apply</button>
        {loading && <span className="text-xs text-gray-500">Working…</span>}
      </div>

      {/* Error */}
      {error && <div className="rounded border border-red-200 bg-red-50 text-red-700 p-2 text-sm">{error}</div>}

      {/* Dry-run preview */}
      {dryRunData && (
        <div className="rounded border bg-white p-4">
          <div className="text-sm font-medium mb-2">Dry Run Result</div>
          <div className="text-xs text-gray-600 mb-2">
            Proposed Phase(s): {dryRunData.proposal.phases.length} · Steps: {dryRunData.proposal.phases.reduce((acc, p) => acc + p.steps.length, 0)}
          </div>
          <div className="space-y-3">
            {dryRunData.proposal.phases.map((ph, i) => (
              <div key={i} className="border rounded p-3">
                <div className="font-medium text-sm">{ph.name} <span className="text-xs text-gray-500">({ph.key})</span></div>
                <div className="mt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th className="py-1">#</th>
                        <th className="py-1">Step</th>
                        <th className="py-1">Key</th>
                        <th className="py-1">Confidence</th>
                        <th className="py-1">Rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ph.steps.map((s, idx) => (
                        <tr key={s.stepId} className="border-t">
                          <td className="py-1 pr-2">{idx+1}</td>
                          <td className="py-1 pr-2">{s.stepName || s.stepId}</td>
                          <td className="py-1 pr-2 text-gray-600">{s.stepKey}</td>
                          <td className="py-1 pr-2">{typeof s.confidence === 'number' ? `${Math.round(s.confidence*100)}%` : '-'}</td>
                          <td className="py-1 pr-2 text-gray-600">{s.rationale || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Applied summary */}
      {applied && (
        <div className="rounded border bg-white p-4">
          <div className="text-sm font-medium mb-2">Applied</div>
          {applied.flow ? (
            <div className="text-sm">Created/Updated Flow: <Link className="underline" href={`/maintenance/ai/settings/project-flows/${applied.flow.id}/phases`}>{applied.flow.name} ({applied.flow.key})</Link></div>
          ) : (
            <div className="text-sm">Flow updated</div>
          )}
          {applied.createdPhase && (
            <div className="text-xs text-gray-600 mt-1">Created Phase: {applied.createdPhase.name} ({applied.createdPhase.key})</div>
          )}
        </div>
      )}
    </div>
  );
}
