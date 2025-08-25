import API_ENDPOINTS from "@/config/api";

export interface DomainPhaseStep {
  id: string;
  phaseId: string;
  stepId: string;
  pinnedStepVersionId?: string | null;
  orderIndex: number;
  params?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReorderItem {
  id: string;
  orderIndex: number;
}

export const adminPhaseStepsService = {
  async list(phaseId: string): Promise<DomainPhaseStep[]> {
    const res = await fetch(API_ENDPOINTS.ADMIN_PHASE_STEPS(phaseId), { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to list steps: ${res.status}`);
    const json = await res.json();
    if (Array.isArray(json)) return json;
    if (json && typeof json === "object" && "success" in json) {
      if (!json.success) throw new Error(json.error || "Failed to list steps");
      return json.data || [];
    }
    return json as DomainPhaseStep[];
  },

  async create(phaseId: string, payload: Partial<DomainPhaseStep>): Promise<DomainPhaseStep> {
    const res = await fetch(API_ENDPOINTS.ADMIN_PHASE_STEPS(phaseId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to create step: ${res.status}`);
    const json = await res.json();
    if (json && typeof json === "object" && "success" in json) {
      if (!json.success) throw new Error(json.error || "Failed to create step");
      return json.data;
    }
    return json as DomainPhaseStep;
  },

  async update(id: string, payload: Partial<DomainPhaseStep>): Promise<DomainPhaseStep> {
    const res = await fetch(API_ENDPOINTS.ADMIN_PHASE_STEP(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to update step: ${res.status}`);
    const json = await res.json();
    if (json && typeof json === "object" && "success" in json) {
      if (!json.success) throw new Error(json.error || "Failed to update step");
      return json.data;
    }
    return json as DomainPhaseStep;
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(API_ENDPOINTS.ADMIN_PHASE_STEP(id), {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Failed to delete step: ${res.status}`);
  },

  async reorder(phaseId: string, items: ReorderItem[]): Promise<void> {
    const res = await fetch(API_ENDPOINTS.ADMIN_PHASE_STEPS_REORDER(phaseId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      // Backend previously used { orderedIds }, keep compatibility
      body: JSON.stringify({ orderedIds: items.sort((a,b)=>a.orderIndex-b.orderIndex).map(i=>i.id) }),
    });
    if (!res.ok) throw new Error(`Failed to reorder steps: ${res.status}`);
    // tolerate envelopes but ignore content
    try { await res.json(); } catch {}
  },

  async getParams(id: string): Promise<any> {
    const res = await fetch(API_ENDPOINTS.ADMIN_DPS_PARAMS(id), { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to get params: ${res.status}`);
    const json = await res.json();
    if (json && typeof json === 'object' && 'data' in json) {
      return (json as any).data?.params ?? {};
    }
    return json;
  },

  async updateParams(id: string, params: Record<string, any>): Promise<any> {
    const res = await fetch(API_ENDPOINTS.ADMIN_DPS_PARAMS(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Failed to update params: ${res.status}`);
    const json = await res.json();
    if (json && typeof json === 'object' && 'data' in json) {
      return (json as any).data?.params ?? {};
    }
    return json;
  },
};
