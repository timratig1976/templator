import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/ai-enhancement`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request deduplication to prevent double-calls
const pendingRequests = new Map<string, Promise<any>>();

export type CropSectionInput = {
  id?: string;
  index: number;
  bounds: { x: number; y: number; width: number; height: number };
  unit: 'px' | 'percent';
  name?: string;
  type?: string;
};

export async function createCrops(
  splitId: string,
  sections: CropSectionInput[],
  opts?: { force?: boolean; projectId?: string }
) {
  // Create unique request key for deduplication
  const requestKey = `createCrops-${splitId}-${sections.length}-${opts?.force ? 'force' : 'normal'}`;
  
  // Check if identical request is already pending
  if (pendingRequests.has(requestKey)) {
    console.log('🔄 Duplicate createCrops request detected, returning existing promise');
    return pendingRequests.get(requestKey)!;
  }

  // Create the request promise
  const requestPromise = (async () => {
    try {
      // If force is true, clean up existing crops first
      if (opts?.force) {
        console.log('🧹 Force mode: cleaning up existing crops before generation...');
        try {
          const existing = await listSplitAssets(splitId, 'image-crop');
          const assets = existing?.data?.assets || [];
          console.log(`🗑️ Found ${assets.length} existing crops to clean up`);
          
          // Delete all existing crops
          for (const asset of assets) {
            const key = asset?.meta?.key || asset?.key;
            if (key) {
              await deleteSplitAsset(splitId, key);
              console.log(`✅ Deleted crop: ${key}`);
            }
          }
        } catch (e) {
          console.warn('⚠️ Failed to clean up existing crops:', e);
        }
      }

      const force = opts?.force ? '1' : undefined;
      const payload: any = { sections, force };
      if (opts?.projectId) payload.projectId = opts.projectId;
      
      console.log(`🎯 Creating ${sections.length} new crops for splitId: ${splitId}`);
      const res = await api.post(
        `/splits/${encodeURIComponent(splitId)}/crops`,
        payload,
        { params: force ? { force } : undefined }
      );
      
      const result = res.data as { success: boolean; data: { assets: any[] } };
      console.log(`✅ Created ${result?.data?.assets?.length || 0} new crops`);
      return result;
    } finally {
      // Clean up the pending request
      pendingRequests.delete(requestKey);
    }
  })();

  // Store the promise to prevent duplicates
  pendingRequests.set(requestKey, requestPromise);
  
  return requestPromise;
}

export async function getSignedUrl(key: string, ttlMs: number = 300000) {
  const res = await api.get(`/assets/signed`, { params: { key, ttl: ttlMs } });
  return res.data as { success: boolean; data: { url: string; exp: number } };
}

export async function listSplitAssets(splitId: string, kind?: string) {
  const res = await api.get(`/splits/${encodeURIComponent(splitId)}/assets`, { params: kind ? { kind } : undefined });
  return res.data as { success: boolean; data: { assets: any[] } };
}

export async function deleteSplitAsset(splitId: string, key: string) {
  const res = await api.delete(`/splits/${encodeURIComponent(splitId)}/assets`, { params: { key } });
  return res.data as { success: boolean };
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

export default { createCrops, getSignedUrl, listSplitAssets, deleteSplitAsset, listRecentSplits, getSplitSummary };
