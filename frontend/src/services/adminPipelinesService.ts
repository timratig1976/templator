import API_ENDPOINTS from "@/config/api";

export interface GenerateFromFlowOptions {
  dryRun?: boolean; // default: true unless apply is true
  apply?: boolean;
  bindToFlow?: boolean;
  pipelineName?: string;
  description?: string;
}

export interface GenerateFromFlowDryRunResult {
  dryRun: true;
  pipeline: { name: string; description: string; version: string; dag: any };
  summary: { stepCount: number; issues: { key: string; reason: string }[] };
}

export interface GenerateFromFlowApplyResult {
  dryRun: false;
  pipeline: { id: string; name: string; description?: string | null };
  version: { id: string; version: string; isActive: boolean; dag: any };
  boundFlow?: { id: string } | false;
  summary: { stepCount: number; issues: { key: string; reason: string }[] };
}

export type GenerateFromFlowResponse = GenerateFromFlowDryRunResult | GenerateFromFlowApplyResult;

export const adminPipelinesService = {
  async generateFromFlow(flowId: string, opts: GenerateFromFlowOptions = {}): Promise<GenerateFromFlowResponse> {
    const url = API_ENDPOINTS.ADMIN_GENERATE_PIPELINE_FROM_FLOW(flowId);
    const payload: any = {
      // default dryRun true unless apply is explicitly true
      dryRun: opts.apply ? false : opts.dryRun !== false,
      apply: !!opts.apply,
      bindToFlow: !!opts.bindToFlow,
      pipelineName: opts.pipelineName,
      description: opts.description,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      const message = (json && (json.message || json.error)) || `HTTP ${res.status}`;
      throw new Error(`generate-from-flow failed: ${message}`);
    }
    // Backend returns { data: ..., summary? }
    if (json && typeof json === "object" && "data" in json) {
      return json.data as GenerateFromFlowResponse;
    }
    // Fallback to raw
    return json as GenerateFromFlowResponse;
  },
};

export default adminPipelinesService;
