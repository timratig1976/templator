import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/generation`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export type SectionVersion = {
  id: string;
  designSplitId?: string | null;
  type: string; // 'html'
  content?: string | null;
  contentUrl?: string | null;
  meta?: any;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export async function getSectionVersions(sectionId: string, designSplitId?: string) {
  const res = await apiClient.get(`/sections/${encodeURIComponent(sectionId)}/versions`, {
    params: { designSplitId },
  });
  return res.data as { success: boolean; versions: SectionVersion[] };
}

export async function createSectionVersion(
  sectionId: string,
  payload: { designSplitId?: string | null; basePrompt?: string; customPrompt?: string; label?: string; useRag?: boolean }
) {
  const res = await apiClient.post(`/sections/${encodeURIComponent(sectionId)}/versions`, payload);
  return res.data as { success: boolean; version: SectionVersion };
}

export async function ragPreview(
  sectionId: string,
  payload: { basePrompt?: string; customPrompt?: string; label?: string }
) {
  const res = await apiClient.post(`/sections/${encodeURIComponent(sectionId)}/rag-preview`, payload);
  return res.data as { success: boolean; enhancedPrompt: string };
}

export async function selectSectionVersion(
  sectionId: string,
  versionId: string,
  designSplitId?: string | null
) {
  const res = await apiClient.patch(`/sections/${encodeURIComponent(sectionId)}/versions/${encodeURIComponent(versionId)}/select`, {
    designSplitId,
  });
  return res.data as { success: boolean };
}

export async function getSectionPrompts(sectionId: string, designSplitId?: string) {
  const res = await apiClient.get(`/sections/${encodeURIComponent(sectionId)}/prompts`, {
    params: { designSplitId },
  });
  return res.data as { success: boolean; prompts: { basePrompt: string; customPrompt: string; label: string | null } | null };
}

export async function saveSectionPrompts(
  sectionId: string,
  payload: { designSplitId: string; basePrompt?: string; customPrompt?: string; label?: string | null }
) {
  const res = await apiClient.put(`/sections/${encodeURIComponent(sectionId)}/prompts`, payload);
  return res.data as { success: boolean; prompts: { basePrompt: string; customPrompt: string; label: string | null } };
}

export default { getSectionVersions, createSectionVersion, selectSectionVersion, getSectionPrompts, saveSectionPrompts };
