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

export async function createCrops(splitId: string, sections: CropSectionInput[]) {
  const res = await api.post(`/splits/${encodeURIComponent(splitId)}/crops`, { sections });
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

export default { createCrops, getSignedUrl, listSplitAssets };
