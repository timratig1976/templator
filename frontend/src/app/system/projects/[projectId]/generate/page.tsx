"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useWorkflow } from "@/contexts/WorkflowContext";
import { createSectionVersion } from "@/services/generationService";

export default function GeneratePage() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();
  const projectId = params?.projectId as string;

  const designUploadId = search.get("designUploadId");
  const splitId = search.get("splitId");
  const { generationPlan, hybridAnalysisResult } = useWorkflow();

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, 'pending' | 'ok' | 'err'>>({});
  const [results, setResults] = useState<Record<string, string>>({});

  const effectiveSplitId = useMemo(() => {
    return splitId || hybridAnalysisResult?.splitId || null;
  }, [splitId, hybridAnalysisResult]);

  const onBack = () => {
    const qp = new URLSearchParams();
    if (designUploadId) qp.set("designUploadId", designUploadId);
    if (splitId) qp.set("splitId", splitId!);
    router.push(`/projects/${projectId}/plan?${qp.toString()}`);
  };

  const onRun = async () => {
    if (!generationPlan || generationPlan.length === 0) return;
    if (!effectiveSplitId) {
      setError("Missing splitId. Go back to Split and confirm sections.");
      return;
    }
    setRunning(true);
    setError(null);
    const toGenerate = generationPlan.filter(p => p.generateHtml);
    const initial: Record<string, 'pending' | 'ok' | 'err'> = {};
    toGenerate.forEach(p => (initial[p.id] = 'pending'));
    setStatuses(initial);

    await Promise.allSettled(
      toGenerate.map(async (p) => {
        try {
          const res = await createSectionVersion(p.id, { designSplitId: effectiveSplitId });
          setStatuses(prev => ({ ...prev, [p.id]: 'ok' }));
          setResults(prev => ({ ...prev, [p.id]: res.version?.id || 'ok' }));
        } catch (e: any) {
          setStatuses(prev => ({ ...prev, [p.id]: 'err' }));
          setResults(prev => ({ ...prev, [p.id]: e?.message || 'error' }));
        }
      })
    );

    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Generate</h1>
        <p className="text-gray-600">Phase 2 scaffold: generator/editor coming next. Use Back to adjust your plan.</p>
      </div>
      {(!generationPlan || generationPlan.length === 0) ? (
        <div className="text-sm text-gray-700">
          No generation plan found. Go back and confirm your plan first.
        </div>
      ) : (
        <div className="border rounded p-3 bg-white">
          <div className="text-sm font-medium mb-2">Planned sections ({generationPlan.length}):</div>
          <ul className="text-sm list-disc ml-5">
            {generationPlan.map((p) => (
              <li key={p.id} className="mb-1">
                <span className="font-medium">{p.label}</span>
                <span className="text-gray-500"> — {p.type}</span>
                <span className="ml-2 inline-block text-xs px-1.5 py-0.5 rounded border bg-gray-50">HTML: {p.generateHtml ? 'yes' : 'no'}</span>
                <span className="ml-1 inline-block text-xs px-1.5 py-0.5 rounded border bg-gray-50">Module: {p.generateModule ? 'yes' : 'no'}</span>
                {p.moduleName && <span className="ml-1 text-xs text-gray-600">({p.moduleName})</span>}
                {p.generateHtml && (
                  <span className="ml-2 text-xs">
                    {statuses[p.id] === 'pending' && <span className="text-blue-700">…running</span>}
                    {statuses[p.id] === 'ok' && <span className="text-green-700">✓ generated</span>}
                    {statuses[p.id] === 'err' && <span className="text-red-700">✕ failed</span>}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {error && <div className="mt-2 text-sm text-red-600" role="alert">{error}</div>}
        </div>
      )}
      <div className="flex gap-2">
        <button className="px-3 py-1.5 text-sm rounded border" onClick={onBack}>Back to Plan</button>
        <button className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:opacity-50" disabled={!generationPlan?.length || running} onClick={onRun}>
          {running ? 'Running…' : 'Run Generation'}
        </button>
      </div>
      <div className="text-xs text-gray-500">
        {designUploadId && <div>designUploadId: {designUploadId}</div>}
        {(splitId || effectiveSplitId) && <div>splitId: {splitId || effectiveSplitId}</div>}
      </div>
    </div>
  );
}
