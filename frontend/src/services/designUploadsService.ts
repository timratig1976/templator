import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

export type DesignUpload = {
  id: string;
  userId?: string | null;
  filename: string;
  mime: string;
  size: number;
  checksum?: string | null;
  storageUrl?: string | null;
  createdAt?: string;
  meta?: any;
};

export type ListResponse = {
  success: boolean;
  data: DesignUpload[];
  pagination: { limit: number; offset: number; count: number; total: number; hasMore: boolean };
};

const http = axios.create({ baseURL: `${API_BASE_URL}/api`, timeout: 30000, headers: { 'Content-Type': 'application/json' } });

export async function listDesignUploads(params: { userId?: string; limit?: number; offset?: number } = {}): Promise<ListResponse> {
  const query = new URLSearchParams();
  if (params.userId) query.set('userId', params.userId);
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.offset != null) query.set('offset', String(params.offset));
  const q = query.toString();
  const res = await http.get(`/design-uploads${q ? `?${q}` : ''}`);
  return res.data as ListResponse;
}

export async function getDesignUpload(id: string) {
  const res = await http.get(`/design-uploads/${id}`);
  return res.data;
}

export async function deleteDesignUpload(id: string) {
  const res = await http.delete(`/design-uploads/${id}`);
  return res.data;
}
