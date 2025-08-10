import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/monitoring`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export type PromptSummaryItem = {
  id: string;
  pipelineId: string;
  sectionId: string | null;
  prompt: string;
  updatedAt: string;
  usageCount: number;
  avgQuality: number | null;
  lastUsed: string;
  ragUsageCount?: number;
  lastRagUsedAt?: string | null;
};

export async function getPromptsSummary(params: {
  sectionId?: string;
  designSplitId?: string;
  search?: string;
  offset?: number;
  limit?: number;
  ragOnly?: boolean;
}) {
  const res = await api.get('/prompts/summary', { params });
  return res.data as { success: boolean; total: number; offset: number; limit: number; items: PromptSummaryItem[] };
}

export async function getPromptDetail(id: string) {
  const res = await api.get(`/prompts/${encodeURIComponent(id)}`);
  return res.data as {
    success: boolean;
    item: {
      id: string;
      pipelineId: string;
      sectionId: string | null;
      prompt: string;
      context: any;
      metadata: any;
      createdAt: string;
      updatedAt: string;
      usageCount: number;
      avgQuality: number | null;
      lastUsed: string;
      results: Array<{ id: string; result: string; qualityScore: number | null; metrics: any; createdAt: string }>;
      relatedArtifacts: Array<{ id: string; createdAt: string; label?: string | null; ragUsed?: boolean; enhancedPrompt?: string | null; selected?: boolean; type: string }>;
    };
  };
}

export default { getPromptsSummary, getPromptDetail };
