import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/ai-enhancement`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export type CropSectionInput = {
  id?: string;
  index: number;
  bounds: { x: number; y: number; width: number; height: number };
  unit: 'px' | 'percent';
};

export async function createCrops(splitId: string, sections: CropSectionInput[], opts?: { force?: boolean }) {
  const force = opts?.force ? '1' : undefined;
  const res = await api.post(`/splits/${encodeURIComponent(splitId)}/crops`, { sections, force }, { params: force ? { force } : undefined });
  return res.data as { success: boolean; data: { assets: any[] } };
}

export async function getSignedUrl(key: string, ttlMs: number = 300000) {
  const res = await api.get(`/assets/signed`, { params: { key, ttl: ttlMs } });
  return res.data as { success: boolean; data: { url: string; exp: number } };
}

export async function listSplitAssets(splitId: string, kind?: string) {
  const res = await api.get(`/splits/${encodeURIComponent(splitId)}/assets`, { params: kind ? { kind } : undefined });
  return res.data as { success: boolean; data: { assets: any[] } };
}

// Minimal read helpers to load previously processed splits
export async function listRecentSplits(limit: number = 20) {
  const res = await api.get(`/splits/recent`, { params: { limit } });
  // Expected shape: { success, data: { items: Array<{ designSplitId: string; createdAt: string; name?: string; sectionCount?: number }> } }
  return res.data as { success: boolean; data: { items: any[] } };
}

export async function getSplitSummary(designSplitId: string) {
  const res = await api.get(`/splits/${encodeURIComponent(designSplitId)}/summary`);
  // Expected shape: { success, data: { designSplitId, imageUrl, sections } }
  return res.data as { success: boolean; data: { designSplitId: string; imageUrl?: string | null; sections: any[] } };
}

export default { createCrops, getSignedUrl, listSplitAssets, listRecentSplits, getSplitSummary };
