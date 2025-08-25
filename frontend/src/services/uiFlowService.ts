import API_ENDPOINTS from "../config/api";

export type UiManifest = {
  flow: { id: string; key: string; name: string; description?: string | null };
  phases: Array<{
    id: string;
    key: string;
    name: string;
    description?: string | null;
    orderIndex: number;
    steps: Array<{
      id: string;
      stepId: string;
      title: string;
      stepKey: string | null;
      orderIndex: number;
      executionMode: "manual" | "auto";
      actions: string[];
      uiHints?: Record<string, any> | null;
      params: Record<string, any>;
      pinnedStepVersionId: string | null;
    }>;
  }>;
};

export async function fetchFlowManifest(flowId: string): Promise<UiManifest> {
  const res = await fetch(API_ENDPOINTS.UI_FLOW_MANIFEST(flowId), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);
  const json = await res.json();
  if (!json?.success) throw new Error(json?.error || "manifest_error");
  return json.data as UiManifest;
}

export async function postManualAction(
  flowId: string,
  phaseStepId: string,
  payload: { action: string; comment?: string; input?: Record<string, any> }
): Promise<any> {
  const res = await fetch(API_ENDPOINTS.UI_FLOW_STEP_ACTION(flowId, phaseStepId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `action_failed_${res.status}`);
  }
  return json.data;
}
