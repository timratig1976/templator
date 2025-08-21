"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

export type MetricDefinition = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  unit?: string | null;
  target?: number | null;
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'latest' | null;
  scope?: 'prompt' | 'step' | 'pipeline' | null;
};

export type MetricProfileItem = {
  id: string;
  metricId: string;
  weight?: number | null;
  threshold?: number | null;
  config?: any;
  metric?: MetricDefinition;
};

export type MetricProfile = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  items: MetricProfileItem[];
};

const base = () => process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009';

export function useMetricsRegistry() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [definitions, setDefinitions] = useState<MetricDefinition[]>([]);
  const [profiles, setProfiles] = useState<MetricProfile[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [defRes, profRes] = await Promise.all([
        fetch(`${base()}/api/metrics/definitions`),
        fetch(`${base()}/api/metrics/profiles`),
      ]);
      if (!defRes.ok) throw new Error(`Definitions HTTP ${defRes.status}`);
      if (!profRes.ok) throw new Error(`Profiles HTTP ${profRes.status}`);
      const defs = await defRes.json();
      const profs = await profRes.json();
      setDefinitions(defs.items || []);
      setProfiles(profs.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Definitions CRUD
  const createDefinition = useCallback(async (input: Partial<MetricDefinition> & { key: string; name: string }) => {
    const res = await fetch(`${base()}/api/metrics/definitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Create definition failed: ${res.status}`);
    await loadAll();
  }, [loadAll]);

  const updateDefinition = useCallback(async (id: string, patch: Partial<MetricDefinition>) => {
    const res = await fetch(`${base()}/api/metrics/definitions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Update definition failed: ${res.status}`);
    await loadAll();
  }, [loadAll]);

  // Profiles CRUD
  const createProfile = useCallback(async (input: { name: string; description?: string; isActive?: boolean }) => {
    const res = await fetch(`${base()}/api/metrics/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Create profile failed: ${res.status}`);
    await loadAll();
  }, [loadAll]);

  const updateProfile = useCallback(async (id: string, patch: { name?: string; description?: string; isActive?: boolean }) => {
    const res = await fetch(`${base()}/api/metrics/profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Update profile failed: ${res.status}`);
    await loadAll();
  }, [loadAll]);

  const addProfileItem = useCallback(async (profileId: string, input: { metricId: string; weight?: number; threshold?: number; config?: any }) => {
    const res = await fetch(`${base()}/api/metrics/profiles/${profileId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Add profile item failed: ${res.status}`);
    await loadAll();
  }, [loadAll]);

  const removeProfileItem = useCallback(async (itemId: string) => {
    const res = await fetch(`${base()}/api/metrics/profiles/items/${itemId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Remove profile item failed: ${res.status}`);
    await loadAll();
  }, [loadAll]);

  return {
    loading, error,
    definitions, profiles,
    actions: { loadAll, createDefinition, updateDefinition, createProfile, updateProfile, addProfileItem, removeProfileItem },
  };
}
