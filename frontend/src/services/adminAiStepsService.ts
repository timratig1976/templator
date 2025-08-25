import API_ENDPOINTS from "@/config/api";

export interface StepDefinition {
  id: string;
  key: string;
  name?: string | null;
  description?: string | null;
  process?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const adminAiStepsService = {
  async search(q: string, take: number = 50, skip: number = 0): Promise<StepDefinition[]> {
    const url = new URL(API_ENDPOINTS.ADMIN_AI_STEPS, typeof window !== 'undefined' ? window.location.origin : undefined);
    // If API_BASE_URL is absolute, URL ctor above may be wrong; fallback to string concat
    const target = API_ENDPOINTS.ADMIN_AI_STEPS.includes("http")
      ? `${API_ENDPOINTS.ADMIN_AI_STEPS}?q=${encodeURIComponent(q)}&take=${take}&skip=${skip}`
      : `${API_ENDPOINTS.ADMIN_AI_STEPS}?q=${encodeURIComponent(q)}&take=${take}&skip=${skip}`;

    const res = await fetch(target, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to fetch step definitions: ${res.status}`);
    const json = await res.json();
    if (json && typeof json === "object" && "success" in json) {
      if (!json.success) throw new Error(json.error || "Failed to fetch step definitions");
      return json.data || [];
    }
    return json as StepDefinition[];
  },
};
