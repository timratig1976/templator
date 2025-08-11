"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import HybridLayoutSplitter from "@/components/HybridLayoutSplitter";
import { useWorkflow } from "@/contexts/WorkflowContext";
import hybridLayoutService from "@/services/hybridLayoutService";
import aiEnhancementService from "@/services/aiEnhancementService";

export default function SplitPage() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();
  const projectId = params?.projectId as string;
  const { uploadedImageFile, setUploadedImageFile, setOriginalFileName, hybridAnalysisResult, setHybridAnalysisResult, setError } = useWorkflow();
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(false);

  const aiSections = useMemo(() => {
    // Try common shapes used in the app for analysis results
    const s1 = hybridAnalysisResult?.sections;
    const s2 = hybridAnalysisResult?.detectedSections;
    const s3 = hybridAnalysisResult?.data?.sections;
    const s4 = hybridAnalysisResult?.hybridSections;
    const s5 = hybridAnalysisResult?.enhancedAnalysis?.sections;
    return s1 || s2 || s3 || s4 || s5 || [];
  }, [hybridAnalysisResult]);

  const designUploadId = search.get("designUploadId") || undefined;
  const splitId = search.get("splitId") || undefined;

  // If we have a designUploadId but no splitId, try to resolve the latest split for this upload
  useEffect(() => {
    let cancelled = false;
    const resolveSplit = async () => {
      if (!designUploadId || splitId || uploadedImageFile) return;
      try {
        setHydrating(true);
        const recent = await aiEnhancementService.listRecentSplits(50);
        const items = (recent?.data?.items || []).filter((it: any) => it?.designUploadId === designUploadId);
        if (!items.length) return;
        // Assume items are already sorted recent-first; otherwise sort by createdAt desc
        const sorted = items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const best = sorted[0];
        const nextSplitId = best?.designSplitId;
        if (!nextSplitId) return;
        // Update URL to include splitId so downstream hydration effect runs
        const qp = new URLSearchParams();
        qp.set('designUploadId', designUploadId);
        qp.set('splitId', String(nextSplitId));
        if (!cancelled) router.replace(`/projects/${projectId}/split?${qp.toString()}`);
      } catch (e) {
        // non-fatal
        console.debug('Split resolve by designUploadId failed', e);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    };
    resolveSplit();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designUploadId, splitId, uploadedImageFile]);

  // Attempt to hydrate uploaded image from sessionStorage when coming from Dashboard "New Templator"
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
          // Clear after hydration to avoid stale reuse
          try { sessionStorage.removeItem('templator.pendingUpload'); } catch {}
        })
        .catch(() => {})
        .finally(() => setHydrating(false));
    } catch {
      setHydrating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If this is an existing project (splitId present), load saved cutlines and image.
  useEffect(() => {
    let cancelled = false;
    const hydrateFromExistingSplit = async () => {
      if (!splitId) return;
      try {
        setHydrating(true);
        const summary = await aiEnhancementService.getSplitSummary(String(splitId));
        const data = summary?.data;
        if (!data) return;
        const sections = Array.isArray(data.sections) ? data.sections : [];
        // Set analysis result with sections and splitId so the UI shows cutlines and prevents auto AI run
        setHybridAnalysisResult((prev: any) => ({ ...(prev || {}), sections, splitId }));

        // If we don't yet have an imageFile, fetch the layout image (preferring signed URL) and hydrate as File
        if (!uploadedImageFile && data.imageUrl) {
          let imgUrl = data.imageUrl as string;
          // Prefer signed URL even if the value is an http(s) path, because legacy records may hold
          // absolute filesystem paths exposed via the dev server which 404. Fallback to raw on failure.
          try {
            const sig = await aiEnhancementService.getSignedUrl(imgUrl);
            if (sig?.data?.url) imgUrl = sig.data.url;
          } catch (e) {
            console.debug('Signed URL fetch failed, trying raw imageUrl', e);
          }
          const res = await fetch(imgUrl);
          const blob = await res.blob();
          const type = blob.type || 'image/png';
          const name = `layout_${splitId}.png`;
          const file = new File([blob], name, { type });
          if (!cancelled) {
            setUploadedImageFile(file);
            setOriginalFileName(name);
          }
        }
      } catch (e: any) {
        console.error('Failed to hydrate existing split:', e);
        setError(e?.message || 'Failed to load existing split');
      } finally {
        if (!cancelled) setHydrating(false);
      }
    };
    hydrateFromExistingSplit();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitId]);

  // Removed previous auto-redirects to ensure the AI splitting UI is visible.

  // If we have an image but no sections yet, auto-run analysis (guarded against StrictMode double-invoke)
  const ranForFileRef = useRef<string | null>(null);
  useEffect(() => {
    const run = async () => {
      if (!uploadedImageFile) return;
      if (aiSections && aiSections.length > 0) return;
      const fileKey = `${uploadedImageFile.name}|${uploadedImageFile.size}`;
      if (ranForFileRef.current === fileKey) return;
      ranForFileRef.current = fileKey;
      try {
        setLoading(true);
        const result = await hybridLayoutService.analyzeLayout(uploadedImageFile);
        setHybridAnalysisResult(result as any);
        try {
          console.debug('[Split] Analysis result received', {
            sectionsCandidates: {
              sections: Array.isArray((result as any)?.sections) ? (result as any).sections.length : undefined,
              detectedSections: Array.isArray((result as any)?.detectedSections) ? (result as any).detectedSections.length : undefined,
              dataSections: Array.isArray((result as any)?.data?.sections) ? (result as any).data.sections.length : undefined,
              hybridSections: Array.isArray((result as any)?.hybridSections) ? (result as any).hybridSections.length : undefined,
              enhancedSections: Array.isArray((result as any)?.enhancedAnalysis?.sections) ? (result as any).enhancedAnalysis.sections.length : undefined,
            },
            splitId: (result as any)?.splitId,
          });
        } catch {}
      } catch (e: any) {
        console.error("Hybrid analysis failed:", e);
        setError(e?.message || "Hybrid analysis failed");
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedImageFile]);

  // When user confirms sections, navigate to Plan step with same IDs
  const handleConfirmed = () => {
    const qp = new URLSearchParams();
    if (designUploadId) qp.set("designUploadId", designUploadId);
    const nextSplitId = hybridAnalysisResult?.splitId || splitId;
    if (nextSplitId) qp.set("splitId", nextSplitId);
    router.push(`/projects/${projectId}/plan?${qp.toString()}`);
  };

  const handleBack = () => {
    const qp = new URLSearchParams();
    if (designUploadId) qp.set("designUploadId", designUploadId);
    router.push(`/projects/${projectId}/upload?${qp.toString()}`);
  };

  if (hydrating) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Split Layout</h1>
        <div className="flex items-center gap-3 text-gray-700">
          <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <span>Loading uploaded image…</span>
        </div>
      </div>
    );
  }

  if (!uploadedImageFile) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Split</h1>
        <p className="text-gray-600">Missing image. Please start from Upload, or use the Reuse Data button to hydrate this step.</p>
      </div>
    );
  }

  if (loading || !aiSections?.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Split Layout</h1>
        <div className="flex items-center gap-3 text-gray-700">
          <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <span>Analyzing layout with AI…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Split Layout</h1>
        <p className="text-gray-600">Review and adjust AI-detected cutlines, then confirm to proceed.</p>
      </div>
      <HybridLayoutSplitter
        imageFile={uploadedImageFile}
        aiDetectedSections={aiSections}
        onSectionsConfirmed={handleConfirmed}
        onBack={handleBack}
        enhancedAnalysis={hybridAnalysisResult?.enhancedAnalysis}
      />
    </div>
  );
}
