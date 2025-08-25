"use client";

import React from "react";
import { fetchFlowManifest, postManualAction, UiManifest } from "../../services/uiFlowService";
import { getOverrideComponent } from "./registry";

type Props = { flowId: string };

type LoadState = {
  loading: boolean;
  error: string | null;
  manifest: UiManifest | null;
};

export default function DynamicFlowRunner({ flowId }: Props) {
  const [state, setState] = React.useState<LoadState>({ loading: true, error: null, manifest: null });
  const [commentByStep, setCommentByStep] = React.useState<Record<string, string>>({});
  const [busyStep, setBusyStep] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setState((s) => ({ ...s, loading: true, error: null }));
      const manifest = await fetchFlowManifest(flowId);
      setState({ loading: false, error: null, manifest });
    } catch (e: any) {
      setState({ loading: false, error: e?.message || "load_failed", manifest: null });
    }
  }, [flowId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onAction = async (phaseStepId: string, action: string) => {
    try {
      setBusyStep(phaseStepId);
      const comment = commentByStep[phaseStepId];
      await postManualAction(flowId, phaseStepId, { action, comment });
      // Future: refresh per-step state; for now just clear comment
      setCommentByStep((m) => ({ ...m, [phaseStepId]: "" }));
    } catch (e: any) {
      alert(e?.message || "Action failed");
    } finally {
      setBusyStep(null);
    }
  };

  if (state.loading) {
    return <div className="p-4 text-sm text-gray-600">Loading flow…</div>;
  }
  if (state.error) {
    return (
      <div className="p-4 text-sm bg-red-50 text-red-700 border border-red-200 rounded">
        Failed to load: {state.error}
        <button className="ml-3 text-xs underline" onClick={load}>Retry</button>
      </div>
    );
  }
  if (!state.manifest) return null;

  const { flow, phases } = state.manifest;

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="text-xl font-semibold">{flow.name}</div>
        {flow.description && <div className="text-sm text-gray-600">{flow.description}</div>}
      </div>

      <div className="space-y-4">
        {phases.map((ph) => (
          <div key={ph.id} className="border rounded">
            <div className="px-3 py-2 bg-gray-50 border-b">
              <div className="font-medium">{ph.name}</div>
              {ph.description && <div className="text-xs text-gray-600">{ph.description}</div>}
            </div>
            <div className="p-3 space-y-3">
              {ph.steps.map((s) => {
                const Override = getOverrideComponent(s.stepKey || undefined);
                if (Override) {
                  return (
                    <div key={s.id} className="p-3 border rounded">
                      <Override
                        flowId={flow.id}
                        phaseStepId={s.id}
                        step={s as any}
                        onAction={async (a, payload) => {
                          await postManualAction(flow.id, s.id, { action: a, ...(payload || {}) });
                        }}
                      />
                    </div>
                  );
                }

                return (
                  <div key={s.id} className="p-3 border rounded">
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-gray-600">Step Key: {s.stepKey || "-"} • Mode: {s.executionMode}</div>

                    {s.executionMode === "manual" ? (
                      <div className="mt-2">
                        {s.uiHints && s.uiHints.commentLabel ? (
                          <label className="block text-xs text-gray-700 mb-1">
                            {s.uiHints.commentLabel as string}
                          </label>
                        ) : null}
                        <textarea
                          className="w-full border rounded p-2 text-sm"
                          placeholder={
                            (s.uiHints && (s.uiHints.commentPlaceholder as string)) || "Optional comment"
                          }
                          value={commentByStep[s.id] || ""}
                          onChange={(e) => setCommentByStep((m) => ({ ...m, [s.id]: e.target.value }))}
                        />
                        {s.uiHints && s.uiHints.helpText ? (
                          <div className="mt-1 text-[11px] text-gray-500">
                            {s.uiHints.helpText as string}
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center gap-2">
                          {s.actions.includes("approve") && (
                            <button
                              className="px-3 py-1 rounded bg-emerald-600 text-white text-sm disabled:opacity-50"
                              disabled={busyStep === s.id}
                              onClick={() => onAction(s.id, "approve")}
                            >
                              {busyStep === s.id
                                ? "Working…"
                                : (s.uiHints && (s.uiHints.approveLabel as string)) || "Approve"}
                            </button>
                          )}
                          {s.actions.includes("reject") && (
                            <button
                              className="px-3 py-1 rounded bg-red-600 text-white text-sm disabled:opacity-50"
                              disabled={busyStep === s.id}
                              onClick={() => onAction(s.id, "reject")}
                            >
                              {busyStep === s.id
                                ? "Working…"
                                : (s.uiHints && (s.uiHints.rejectLabel as string)) || "Reject"}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-gray-600">Automatic step. No user action required.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
