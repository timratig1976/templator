"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import SplitGenerationPlanner from "@/components/SplitGenerationPlanner";
import { useWorkflow } from "@/contexts/WorkflowContext";

export default function PlanPage() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();
  const projectId = params?.projectId as string;

  const { uploadedImageFile, setUploadedImageFile, setOriginalFileName, hybridAnalysisResult, setGenerationPlan } = useWorkflow();
  const [hydrating, setHydrating] = useState(false);

  const sections = useMemo(() => {
    // Prefer enhancedAnalysis.sections if present, else fallback shapes
    const s1 = hybridAnalysisResult?.enhancedAnalysis?.sections;
    const s2 = hybridAnalysisResult?.sections;
    const s3 = hybridAnalysisResult?.detectedSections;
    const s4 = hybridAnalysisResult?.data?.sections;
    const list = s1 || s2 || s3 || s4 || [];

    // Normalize to planner SectionInput
    return list.map((s: any) => ({
      id: s.id || s.sectionId || String(Math.random()),
      type: s.type || "content",
      description: s.description || s.detectionReason || "",
      confidence: s.aiConfidence ?? s.confidence ?? undefined,
      bounds: s.bounds || { x: s.x ?? 0, y: s.y ?? 0, width: s.width ?? 0, height: s.height ?? 0 },
      storageUrl: s.storageUrl ?? null,
    }));
  }, [hybridAnalysisResult]);

  const designUploadId = search.get("designUploadId");
  const querySplitId = search.get("splitId");
  const designSplitId = (querySplitId || hybridAnalysisResult?.splitId || null) as string | null;

  // Hydrate image file if missing (coming from auto-redirect after New Templator)
  useEffect(() => {
    if (uploadedImageFile) return;
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem('templator.pendingUpload') : null;
    if (!raw) return;
    try {
      setHydrating(true);
      const payload = JSON.parse(raw);
      const { name, type, dataUrl } = payload || {};
      if (!dataUrl || !name || !type) { setHydrating(false); return; }
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], name, { type });
          setUploadedImageFile(file);
          setOriginalFileName(name);
          try { sessionStorage.removeItem('templator.pendingUpload'); } catch {}
        })
        .catch(() => {})
        .finally(() => setHydrating(false));
    } catch {
      setHydrating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBack = () => {
    const qp = new URLSearchParams();
    if (designUploadId) qp.set("designUploadId", designUploadId);
    if (designSplitId) qp.set("splitId", designSplitId);
    router.push(`/projects/${projectId}/split?${qp.toString()}`);
  };

  const onConfirm = (plan: any[]) => {
    // Phase 2: go to generator/editor step (placeholder route for now)
    setGenerationPlan(plan as any);
    const qp = new URLSearchParams();
    if (designUploadId) qp.set("designUploadId", designUploadId);
    if (designSplitId) qp.set("splitId", designSplitId);
    router.push(`/projects/${projectId}/generate?${qp.toString()}`);
  };

  if (hydrating) {
    return (
      <div className="space-y-3">
        <p className="text-gray-600">Loading uploaded image…</p>
      </div>
    );
  }

  if (!uploadedImageFile || sections.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-gray-600">Missing image or sections. Go back to Split and confirm sections.</p>
        <button
          className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white"
          onClick={onBack}
        >Back to Split</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SplitGenerationPlanner
        imageFile={uploadedImageFile}
        sections={sections}
        designSplitId={designSplitId}
        onBack={onBack}
        onConfirm={(p) => onConfirm(p)}
      />
    </div>
  );
}
