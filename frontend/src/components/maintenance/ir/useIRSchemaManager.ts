"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

export type StepDef = { id: string; key: string; name?: string | null };
export type StepVersion = { id: string; version: string; isActive: boolean };
export type IRSchema = { id: string; stepVersionId: string; name: string; version: string; schema: any; isActive: boolean; createdAt?: string };

function backendBase() {
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3009';
}

export function useIRSchemaManager() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [steps, setSteps] = useState<StepDef[]>([]);
  const [stepVersions, setStepVersions] = useState<StepVersion[]>([]);
  const [schemas, setSchemas] = useState<IRSchema[]>([]);

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [selectedStepVersionId, setSelectedStepVersionId] = useState<string | null>(null);

  const selectedStep = useMemo(() => steps.find(s => s.id === selectedStepId) || null, [steps, selectedStepId]);
  const selectedVersion = useMemo(() => stepVersions.find(v => v.id === selectedStepVersionId) || null, [stepVersions, selectedStepVersionId]);

  const listSteps = useCallback(async () => {
    setError(null);
    const res = await fetch(`${backendBase()}/api/admin/pipelines/steps`);
    if (!res.ok) throw new Error(`Failed to load steps: ${res.status}`);
    const data = await res.json();
    // data: { id, key, name, description, versionCount, versions }
    const items: StepDef[] = data.data.map((d: any) => ({ id: d.id, key: d.key, name: d.name }));
    setSteps(items);
  }, []);

  const listStepVersions = useCallback(async (stepId: string) => {
    setError(null);
    const res = await fetch(`${backendBase()}/api/admin/pipelines/steps/${stepId}/versions`);
    if (!res.ok) throw new Error(`Failed to load step versions: ${res.status}`);
    const data = await res.json();
    const items: StepVersion[] = data.data;
    setStepVersions(items);
  }, []);

  const listSchemas = useCallback(async (stepVersionId: string) => {
    setError(null);
    const res = await fetch(`${backendBase()}/api/admin/pipelines/steps/versions/${stepVersionId}/ir-schemas`);
    if (!res.ok) throw new Error(`Failed to load IR schemas: ${res.status}`);
    const data = await res.json();
    setSchemas(data.data as IRSchema[]);
  }, []);

  useEffect(() => {
    setLoading(true);
    listSteps()
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [listSteps]);

  useEffect(() => {
    if (!selectedStepId) return;
    setStepVersions([]);
    setSchemas([]);
    setSelectedStepVersionId(null);
    listStepVersions(selectedStepId).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [selectedStepId, listStepVersions]);

  useEffect(() => {
    if (!selectedStepVersionId) return;
    listSchemas(selectedStepVersionId).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [selectedStepVersionId, listSchemas]);

  const createSchema = useCallback(async (input: { stepVersionId: string; name: string; version: string; schema: any; isActive?: boolean }) => {
    const res = await fetch(`${backendBase()}/api/admin/pipelines/steps/versions/${input.stepVersionId}/ir-schemas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: input.name, version: input.version, schema: input.schema, isActive: !!input.isActive }),
    });
    if (!res.ok) throw new Error(`Create failed: ${res.status}`);
    await listSchemas(input.stepVersionId);
  }, [listSchemas]);

  const updateSchema = useCallback(async (id: string, patch: Partial<Pick<IRSchema, 'name' | 'version' | 'schema' | 'isActive'>>) => {
    const res = await fetch(`${backendBase()}/api/admin/pipelines/ir-schemas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    if (selectedStepVersionId) await listSchemas(selectedStepVersionId);
  }, [selectedStepVersionId, listSchemas]);

  const deleteSchema = useCallback(async (id: string) => {
    const res = await fetch(`${backendBase()}/api/admin/pipelines/ir-schemas/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    if (selectedStepVersionId) await listSchemas(selectedStepVersionId);
  }, [selectedStepVersionId, listSchemas]);

  return {
    loading,
    error,
    steps,
    stepVersions,
    schemas,
    selectedStepId,
    setSelectedStepId,
    selectedStepVersionId,
    setSelectedStepVersionId,
    selectedStep,
    selectedVersion,
    actions: { listSteps, listStepVersions, listSchemas, createSchema, updateSchema, deleteSchema },
  };
}
