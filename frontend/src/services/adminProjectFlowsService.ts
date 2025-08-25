import API_ENDPOINTS from "@/config/api";

export interface AllowedStepsResponse {
  allowedSteps: { id: string; key: string; name?: string | null; description?: string | null }[];
  pipelineBound: boolean;
  activePipelineVersion: string | null;
}

export const adminProjectFlowsService = {
  async getAllowedSteps(flowId: string): Promise<AllowedStepsResponse> {
    const url = API_ENDPOINTS.ADMIN_FLOW_ALLOWED_STEPS(flowId);
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to fetch allowed steps: ${res.status}`);
    const json = await res.json();
    if (json && typeof json === "object" && "success" in json) {
      if (!json.success) throw new Error(json.error || "Failed to fetch allowed steps");
      return json.data as AllowedStepsResponse;
    }
    return json as AllowedStepsResponse;
  },

  async generateFromBrief(params: {
    brief: string;
    apply?: boolean;
    overwrite?: boolean;
    flowId?: string;
    flowKey?: string;
    flowName?: string;
    description?: string | null;
  }): Promise<any> {
    const res = await fetch(API_ENDPOINTS.ADMIN_GENERATE_FLOW_FROM_BRIEF, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(params),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      const msg = json?.error || `Failed to generate flow from brief (${res.status})`;
      throw new Error(msg);
    }
    return json.data;
  },
};

export default adminProjectFlowsService;
