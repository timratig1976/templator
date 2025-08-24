"use client";

import React, { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// Thin wrapper to support step-first deep links:
// /maintenance/ai/optimization/step/editor/[id]?stepVersion=...&runId=...
// It resolves the step's process and redirects to
// /maintenance/ai/optimization/[process]/editor?stepId=[id]&stepVersion=...&runId=...
export default function StepEditorRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const runId = search.get("runId");
  const stepVersion = search.get("stepVersion");

  useEffect(() => {
    const go = async () => {
      if (!id) return;
      try {
        // Fetch step to discover process key
        const res = await fetch(`/api/admin/ai-steps/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        const step = json?.data || json;
        const process = step?.process || step?.key || "general"; // fallback if process not present
        const searchParams = new URLSearchParams();
        searchParams.set("stepId", id);
        if (runId) searchParams.set("runId", runId);
        if (stepVersion) searchParams.set("stepVersion", stepVersion);
        router.replace(`/maintenance/ai/optimization/${encodeURIComponent(process)}/editor?${searchParams.toString()}`);
      } catch {
        // As a fallback, navigate to generic editor without process
        const searchParams = new URLSearchParams();
        searchParams.set("stepId", id);
        if (runId) searchParams.set("runId", runId);
        if (stepVersion) searchParams.set("stepVersion", stepVersion);
        router.replace(`/maintenance/ai/optimization/split-detection/editor?${searchParams.toString()}`);
      }
    };
    go();
  }, [id, runId, stepVersion, router]);

  return (
    <div className="p-4 text-sm text-gray-600">Opening Step Editor…</div>
  );
}
