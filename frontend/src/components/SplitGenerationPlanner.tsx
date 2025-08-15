"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createSectionVersion, getSectionVersions, selectSectionVersion, getSectionPrompts, saveSectionPrompts, ragPreview } from "@/services/generationService";
import { createCrops, getSignedUrl, listSplitAssets } from "@/services/aiEnhancementService";

export type SectionInput = {
  id: string;
  filename?: string | null;
  type:
    | "header"
    | "hero"
    | "content"
    | "sidebar"
    | "footer"
    | "navigation"
    | "form"
    | "gallery"
    | "testimonial"
    | "cta"
    | "other";
  description?: string;
  confidence?: number;
  // normalized percentage bounds from 0..1 relative to original image
  bounds: { x: number; y: number; width: number; height: number };
  storageUrl?: string | null;
};

export type GenerationPlanItem = {
  id: string;
  label: string;
  type: SectionInput["type"];
  generateHtml: boolean;
  generateModule: boolean;
  moduleName?: string;
  notes?: string;
};

export type SplitGenerationPlannerProps = {
  imageFile?: File | null;
  imageUrl?: string | null; // optional if URL already known
  sections: SectionInput[];
  designSplitId?: string | null;
  onBack: () => void;
  onConfirm: (plan: GenerationPlanItem[]) => void;
};

export default function SplitGenerationPlanner({
  imageFile,
  imageUrl,
  sections,
  designSplitId,
  onBack,
  onConfirm,
}: SplitGenerationPlannerProps) {
  const [url, setUrl] = useState<string | null>(imageUrl || null);
  const [plan, setPlan] = useState<GenerationPlanItem[]>(() =>
    sections.map((s, idx) => ({
      id: s.id,
      label: defaultLabelFor(s, idx + 1),
      type: s.type,
      generateHtml: true,
      generateModule: s.type === "header" || s.type === "hero" || s.type === "footer" || s.type === "navigation" || s.type === "form" || s.type === "gallery" || s.type === "testimonial" || s.type === "cta",
      moduleName: defaultModuleNameFor(s, idx + 1),
      notes: s.description || "",
    }))
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [display, setDisplay] = useState({ w: 0, h: 0, scale: 1 });
  // crops state
  const [cropAssets, setCropAssets] = useState<any[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [loadingCrops, setLoadingCrops] = useState<boolean>(false);
  const [cropError, setCropError] = useState<string | null>(null);
  // per-section prompts and version history
  type Version = { id: string; html: string; prompt: string; createdAt: number; label?: string; ragUsed?: boolean; enhancedPrompt?: string };
  const [basePrompt, setBasePrompt] = useState<string>(
    'Generate clean, responsive, semantic HTML with Tailwind classes. Use accessible markup and preserve visual hierarchy.'
  );
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<Record<string, Version[]>>({});
  const [activeVersionId, setActiveVersionId] = useState<Record<string, string | null>>({});
  const [useRag, setUseRag] = useState<boolean>(false);
  // Simplified prompt editing: one full prompt buffer per section
  const [fullPrompt, setFullPrompt] = useState<Record<string, string>>({});
  const [ragPreviewLoading, setRagPreviewLoading] = useState<boolean>(false);
  const [ragPreviewError, setRagPreviewError] = useState<string | null>(null);
  // Approval and per-row tabs + editable HTML buffers
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  type RowTab = 'image' | 'prompt' | 'html' | 'preview';
  const [rowTab, setRowTab] = useState<Record<string, RowTab>>({});
  const [workingHtml, setWorkingHtml] = useState<Record<string, string>>({});

  // Reconcile plan when sections prop changes (e.g., user re-cuts a large upload)
  useEffect(() => {
    if (!sections || !sections.length) return;
    setPlan((prev) => {
      const prevById = new Map(prev.map((p) => [p.id, p] as const));
      const next: GenerationPlanItem[] = sections.map((s, idx) => {
        const existing = prevById.get(s.id);
        if (existing) {
          // keep user-modified fields; update type if changed
          return {
            ...existing,
            type: s.type,
            label: existing.label || defaultLabelFor(s, idx + 1),
            moduleName: existing.moduleName ?? defaultModuleNameFor(s, idx + 1),
          };
        }
        return {
          id: s.id,
          label: defaultLabelFor(s, idx + 1),
          type: s.type,
          generateHtml: true,
          generateModule: s.type === 'header' || s.type === 'hero' || s.type === 'footer' || s.type === 'navigation' || s.type === 'form' || s.type === 'gallery' || s.type === 'testimonial' || s.type === 'cta',
          moduleName: defaultModuleNameFor(s, idx + 1),
          notes: s.description || '',
        };
      });
      return next;
    });
  }, [sections]);

  // Simple RAG hints by section type to enrich prompts and generation
  const ragHintsByType: Record<SectionInput['type'], string> = {
    header: 'Include site branding, concise navigation entry points, and accessibility (nav with aria-label).',
    hero: 'Large headline, supporting paragraph, primary CTA button, optional secondary link, responsive spacing, prominent imagery placeholder.',
    content: 'Semantic headings (h2-h3), paragraphs, lists, and responsive layout using Tailwind utility classes.',
    sidebar: 'Complementary content, list of links or filters, subtle separators, and sticky behavior on large screens.',
    footer: 'Multi-column links, small print, social icons placeholders, and contrasting background.',
    navigation: 'Responsive nav with hamburger for mobile, focus rings, aria-expanded for menus.',
    form: 'Labels tied to inputs via htmlFor/id, required indicators, help text, validation states, and accessible error messages.',
    gallery: 'Responsive grid, lazy-loaded images, captions, and keyboard-focus styles.',
    testimonial: 'Quote, author, role/company, optional avatar, and balanced spacing.',
    cta: 'Short message, one primary action, high-contrast button, responsive padding.',
    other: 'Clean, accessible Tailwind HTML with semantic markup and responsive design.'
  };

  // Keep workingHtml in sync with active version when it changes (initialize if empty)
  useEffect(() => {
    Object.keys(activeVersionId).forEach((sid) => {
      const vId = activeVersionId[sid];
      if (!vId) return;
      if (workingHtml[sid] != null) return;
      const v = (versions[sid] || []).find(x => x.id === vId);
      if (v) setWorkingHtml(prev => ({ ...prev, [sid]: v.html }));
    });
  }, [activeVersionId, versions]);

  // Track async error messages by action
  const [errors, setErrors] = useState<{ regenerate?: string; save?: string; load?: string; ragPreview?: string }>({});

  // Track per-section regeneration state
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});

  // Keep last saved prompt snapshots for debounce autosave comparison
  const [lastSaved, setLastSaved] = useState<Record<string, { basePrompt: string; customPrompt: string; label: string | null }>>({});

  // Helper to compose default full prompt from global base + per-section custom
  function composePrompt(base: string, custom?: string) {
    const parts = [base?.trim() || ""];
    const c = (custom || "").trim();
    if (c) parts.push("\n\n" + c);
    return parts.join("");
  }

  // Derive custom from a full prompt relative to current base
  function deriveCustomFromFull(full: string, base: string) {
    const f = (full || "").trim();
    const b = (base || "").trim();
    if (!f) return "";
    if (!b) return f; // if no base, all goes to custom
    if (f.startsWith(b)) {
      return f.slice(b.length).trim();
    }
    return f; // fallback: treat entire text as custom
  }

  // Save prompts for a specific section (persist to backend)
  async function savePromptsFor(id: string) {
    const label = plan.find((p) => p.id === id)?.label || null;
    const full = fullPrompt[id] ?? composePrompt(basePrompt, customPrompts[id] || "");
    const custom = deriveCustomFromFull(full, basePrompt);
    try {
      await saveSectionPrompts(id, {
        basePrompt,
        customPrompt: custom,
        label: label || undefined,
        designSplitId: designSplitId || undefined,
      });
      setCustomPrompts((prev) => ({ ...prev, [id]: custom }));
      setFullPrompt((prev) => ({ ...prev, [id]: composePrompt(basePrompt, custom) }));
      setLastSaved((prev) => ({ ...prev, [id]: { basePrompt, customPrompt: custom, label } }));
      setErrors((e) => ({ ...e, save: undefined }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, save: 'Failed to save prompts.' }));
      throw e;
    }
  }

  // Load prompts for the selected section to hydrate editors
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getSectionPrompts(selectedId, designSplitId || undefined);
        const custom = (res as any)?.prompts?.customPrompt ?? (res as any)?.customPrompt ?? "";
        if (cancelled) return;
        setCustomPrompts((prev) => ({ ...prev, [selectedId]: custom }));
        setFullPrompt((prev) => ({ ...prev, [selectedId]: composePrompt(basePrompt, custom) }));
        const label = plan.find((p) => p.id === selectedId)?.label || null;
        setLastSaved((prev) => ({ ...prev, [selectedId]: { basePrompt, customPrompt: custom, label } }));
      } catch {
        // surface a non-blocking load error for visibility
        setErrors((prev) => ({ ...prev, load: 'Failed to load prompts.' }));
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, designSplitId, basePrompt, plan]);

  // Debounced autosave when base/custom/label changes for selected section
  useEffect(() => {
    if (!selectedId || !designSplitId) return;
    const current = {
      basePrompt,
      customPrompt: deriveCustomFromFull(fullPrompt[selectedId] || '', basePrompt),
      label: plan.find((p) => p.id === selectedId)?.label || null,
    };
    const last = lastSaved[selectedId];
    if (last && last.basePrompt === current.basePrompt && last.customPrompt === current.customPrompt && last.label === current.label) {
      return;
    }
    const t = setTimeout(() => {
      savePromptsFor(selectedId).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [selectedId, designSplitId, basePrompt, fullPrompt, plan]);

  // Build URL from file if needed
  useEffect(() => {
    if (imageUrl) return; // already provided
    if (!imageFile) { setUrl(null); return; }
    const u = URL.createObjectURL(imageFile);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [imageFile, imageUrl]);

  // Helper to map assets -> signed URLs
  const resolveThumbUrls = async (assets: any[]) => {
    const entries = await Promise.all(
      assets.map(async (a) => {
        const key = a?.meta?.key || a?.storageUrl;
        if (!key) return null;
        try {
          // Use longer TTL to avoid frequent 403s during dev hot reloads
          const s = await getSignedUrl(String(key), 30 * 60 * 1000);
          return [String(key), s.data.url] as const;
        } catch {
          return null;
        }
      })
    );
    const map: Record<string, string> = {};
    entries.forEach((e) => { if (e) map[e[0]] = e[1]; });
    return map;
  };

  // Explicit approve action persists selection and marks section approved in UI
  async function approveSection(id: string) {
    const vid = activeVersionId[id];
    if (!vid) return;
    try {
      await selectSectionVersion(id, vid, designSplitId || undefined);
      setApproved(prev => ({ ...prev, [id]: true }));
    } catch {
      setApproved(prev => ({ ...prev, [id]: true }));
    }
  }

  // Trigger crop generation once we have split + sections (idempotent: prefer existing)
  useEffect(() => {
    let isCancelled = false;
    let currentRequest: Promise<any> | null = null;

    async function run() {
      if (!designSplitId || !sections?.length || isCancelled) return;
      
      // Prevent multiple simultaneous requests for the same splitId
      const requestKey = `${designSplitId}-${sections.length}`;
      if (currentRequest) {
        console.log('🚫 Crop generation already in progress, skipping duplicate request');
        return;
      }

      try {
        setLoadingCrops(true);
        setCropError(null);
        
        currentRequest = listSplitAssets(designSplitId, 'image-crop');
        const existing = await currentRequest;
        if (isCancelled) return;
        
        let assets = (existing?.data?.assets || []) as any[];

        // Determine if assets match current sections (by sectionId count/coverage)
        const sectionIds = new Set(sections.map(function(s){ return s.id; }));
        const assetSectionIds = new Set(assets.map(function(a: any){ return a && a.meta ? a.meta.sectionId : undefined; }).filter(Boolean));
        let coverageOk = sectionIds.size === assetSectionIds.size;
        if (coverageOk) {
          coverageOk = true;
          sectionIds.forEach(function(id){ if (!assetSectionIds.has(id)) { coverageOk = false; } });
        }

        if (!assets.length || !coverageOk) {
          // sections bounds are in pixels from HybridSplit UI -> convert to percent for backend
          const inputs = sections.map((s, i) => {
            // Get the original image dimensions to convert pixels to percentages
            const imgWidth = s.bounds.width > 1 ? s.bounds.width : 1920; // Fallback width
            const imgHeight = s.bounds.height > 1 ? s.bounds.height : 1080; // Fallback height
            
            // For sections from HybridSplit, bounds are typically in pixels
            // Convert to percentages relative to image dimensions
            const isPixelBounds = s.bounds.y > 1 || s.bounds.height > 1;
            
            let boundsPercent;
            if (isPixelBounds) {
              // Convert pixels to percentages
              boundsPercent = {
                x: 0, // HybridSplit sections are full width
                y: Math.max(0, Math.min(100, (s.bounds.y / imgHeight) * 100)),
                width: 100, // HybridSplit sections are full width
                height: Math.max(1, Math.min(100, (s.bounds.height / imgHeight) * 100))
              };
            } else {
              // Already normalized (0-1), convert to percent
              boundsPercent = {
                x: (s.bounds.x ?? 0) * 100,
                y: (s.bounds.y ?? 0) * 100,
                width: (s.bounds.width ?? 100) * 100,
                height: (s.bounds.height ?? 100) * 100,
              };
            }
            
            console.log(`🎯 Section ${i + 1} bounds conversion:`, {
              original: s.bounds,
              converted: boundsPercent,
              isPixelBounds,
              imgDimensions: { width: imgWidth, height: imgHeight }
            });
            
            return {
              id: s.id,
              index: i,
              unit: 'percent' as const,
              bounds: boundsPercent,
              name: s.type ? s.type.charAt(0).toUpperCase() + s.type.slice(1) : `Section ${i + 1}`,
              type: s.type || 'content'
            };
          });
          console.log('🎯 Creating crops for sections that need coverage...');
          currentRequest = createCrops(designSplitId, inputs, { force: true });
          const created = await currentRequest;
          if (isCancelled) return;
          
          assets = (created?.data?.assets || []) as any[];
        }

        if (!isCancelled) {
          setCropAssets(assets);
          const map = await resolveThumbUrls(assets);
          setThumbUrls(map);
          // Default select first section
          if (!selectedId || !sectionIds.has(selectedId)) {
            if (sections[0]) setSelectedId(sections[0].id);
          }
        }
      } catch (e) {
        if (!isCancelled) {
          setCropError('Failed to prepare section thumbnails.');
        }
      } finally {
        currentRequest = null;
        if (!isCancelled) {
          setLoadingCrops(false);
        }
      }
    }
    
    run();
    
    // Cleanup function to cancel ongoing requests
    return () => {
      isCancelled = true;
      currentRequest = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designSplitId, sections]);

  // Measure and compute display dimensions to fit container
  useEffect(() => {
    function recalc() {
      if (!imageRef.current || !containerRef.current) return;
      const natW = imageRef.current.naturalWidth || 1;
      const natH = imageRef.current.naturalHeight || 1;
      setImgNatural({ w: natW, h: natH });
      const maxW = containerRef.current.clientWidth - 32; // padding
      const maxH = Math.min(800, Math.floor(window.innerHeight * 0.7));
      let w = maxW;
      let h = (natH / natW) * w;
      if (h > maxH) {
        h = maxH;
        w = (natW / natH) * h;
      }
      const scale = w / natW;
      setDisplay({ w, h, scale });
    }
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  const selectedIndex = useMemo(
    () => plan.findIndex((p) => p.id === selectedId),
    [plan, selectedId]
  );

  // Load versions from backend when selection changes
  useEffect(() => {
    async function load() {
      if (!selectedId) return;
      try {
        const res = await getSectionVersions(selectedId, designSplitId || undefined);
        const list = (res.versions || []).map((a) => ({
          id: a.id,
          html: a.content || "",
          prompt: (a.meta?.prompt as string) || "",
          createdAt: new Date(a.createdAt).getTime(),
          label: (a.meta?.label as string) || undefined,
          ragUsed: !!(a.meta?.ragUsed),
          enhancedPrompt: (a.meta?.enhancedPrompt as string) || undefined,
        }));
        setVersions((prev) => ({ ...prev, [selectedId]: list }));
        const selected = (res.versions || []).find((v: any) => v.meta && (v.meta as any).selected);
        setActiveVersionId((prev) => ({ ...prev, [selectedId]: selected?.id || null }));
      } catch (e) {
        // silent fail; UI remains usable
        // console.warn('Failed to load versions', e);
      }
    }
    load();
  }, [selectedId, designSplitId]);

  // Autosave prompts for selected section
  useEffect(() => {
    if (!selectedId || !designSplitId) return;
    const current = {
      basePrompt,
      customPrompt: customPrompts[selectedId] || '',
      label: plan.find((p) => p.id === selectedId)?.label || null,
    };
    const last = lastSaved[selectedId];
    if (last && last.basePrompt === current.basePrompt && last.customPrompt === current.customPrompt && last.label === current.label) {
      return; // no changes
    }
    const t = setTimeout(() => {
      savePromptsFor(selectedId).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [selectedId, designSplitId, basePrompt, customPrompts, plan]);

  function updateItem(id: string, patch: Partial<GenerationPlanItem>) {
    setPlan((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function moveItem(id: string, dir: -1 | 1) {
    setPlan((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const j = Math.min(Math.max(0, idx + dir), prev.length - 1);
      if (j === idx) return prev;
      const next = [...prev];
      const [it] = next.splice(idx, 1);
      next.splice(j, 0, it);
      return next;
    });
  }

  function toggleAllHtml(v: boolean) {
    setPlan((prev) => prev.map((p) => ({ ...p, generateHtml: v })));
  }
  function toggleAllModule(v: boolean) {
    setPlan((prev) => prev.map((p) => ({ ...p, generateModule: v })));
  }

  const valid = plan.every((p) => p.generateHtml || p.generateModule);

  function getSectionById(id: string | null) {
    if (!id) return null;
    return sections.find((s) => s.id === id) || null;
  }

  

  // Regenerate by calling backend to create a new version
  async function regenerateForSection(id: string) {
    try {
      // Ensure prompts saved before regeneration
      await savePromptsFor(id);
      setRegenerating((p) => ({ ...p, [id]: true }));
      const payload = {
        basePrompt,
        customPrompt: customPrompts[id],
        label: plan.find((p) => p.id === id)?.label || "Section",
        designSplitId: designSplitId || undefined,
        useRag,
      };
      const res = await createSectionVersion(id, payload);
      const a = res.version;
      const v: Version = {
        id: a.id,
        html: a.content || "",
        prompt: (a.meta?.prompt as string) || "",
        createdAt: new Date(a.createdAt).getTime(),
        label: (a.meta?.label as string) || undefined,
        ragUsed: !!(a.meta?.ragUsed),
        enhancedPrompt: (a.meta?.enhancedPrompt as string) || undefined,
      };
      setVersions((prev) => ({ ...prev, [id]: [v, ...(prev[id] || [])] }));
      setActiveVersionId((prev) => ({ ...prev, [id]: v.id }));
      await selectSectionVersion(id, v.id, designSplitId || undefined);
      setErrors((e) => ({ ...e, regenerate: undefined }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, regenerate: 'Failed to regenerate HTML. Try again.' }));
    }
    finally {
      setRegenerating((p) => ({ ...p, [id]: false }));
    }
  }

  async function selectActiveVersion(id: string, versionId: string) {
    setActiveVersionId((prev) => ({ ...prev, [id]: versionId }));
    try {
      await selectSectionVersion(id, versionId, designSplitId || undefined);
    } catch (e) {
      // ignore selection error for now
    }
  }

  const canContinue = useMemo(() => Object.values(approved).some(Boolean), [approved]);

  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">HTML Generation</h2>
          <p className="text-sm text-gray-600">Generate, review, and approve HTML for each split section.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 text-sm border rounded" onClick={onBack} aria-label="Back to splitting">Back</button>
          <button
            className={`px-3 py-1 text-sm rounded ${canContinue ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            disabled={!canContinue}
            onClick={() => canContinue && onConfirm(plan.filter(p => approved[p.id]))}
            title={canContinue ? 'Proceed to HubSpot module generation' : 'Approve at least one section'}
          >Continue</button>
        </div>
      </div>

      {/* Stacked per-section rows */}
      <div className="space-y-4">
        {plan.map((p, i) => {
          // find thumb for this section
          // 1) Prefer matching by sectionId (coerce to string for robustness)
          // 2) Fallback: match by order index if sectionId is missing in meta
          let asset =
            cropAssets.find(a => {
              const sid = a && a.meta ? (a.meta as any).sectionId : undefined;
              return sid != null && String(sid) === String(p.id);
            }) || null;
          if (!asset) {
            const byOrder = cropAssets.find(a => typeof a?.order === 'number' && a.order === i) || null;
            if (byOrder) asset = byOrder;
          }
          const key = asset?.meta?.key || asset?.storageUrl;
          const thumb = key ? thumbUrls[String(key)] : undefined;
          // Debug trace to help diagnose wrong image mapping
          if (process.env.NODE_ENV !== 'production') {
            try {
              // Only log when section is first rendered or mapping changes materially
              // eslint-disable-next-line no-console
              console.debug('[SplitGenerationPlanner] Thumb map', {
                sectionIndex: i,
                sectionId: p.id,
                assetKey: key,
                assetOrder: asset?.order,
                thumbUrl: thumb,
                fullThumbUrl: thumb, // Log full URL to see if it's truncated
              });
              
              // Test thumbnail URL accessibility
              if (thumb && i === 0) { // Only test first thumbnail to avoid spam
                console.log('[SplitGenerationPlanner] Testing thumbnail URL:', thumb);
                fetch(thumb)
                  .then(response => {
                    console.log('[SplitGenerationPlanner] Thumbnail fetch response:', {
                      status: response.status,
                      statusText: response.statusText,
                      url: response.url
                    });
                  })
                  .catch(error => {
                    console.error('[SplitGenerationPlanner] Thumbnail fetch error:', error);
                  });
              }
            } catch {}
          }
          const open = selectedId === p.id;
          const vList = versions[p.id] || [];
          const activeVId = activeVersionId[p.id] || null;
          const activeV = vList.find(v => v.id === activeVId) || null;
          return (
            <div key={p.id} className="border rounded bg-white">
              <div className="p-3 flex items-start gap-3">
                <button
                  className={`shrink-0 w-20 h-16 border rounded overflow-hidden bg-gray-100 ${open ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedId(open ? null : p.id)}
                  aria-label={`Toggle section ${i+1}`}
                  title={p.label}
                >
                  {thumb ? (
                    <img src={thumb} alt={`Section ${i+1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">No preview</div>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="truncate">
                      <div className="text-xs text-gray-500">Section {i + 1}</div>
                      <input
                        className="font-medium text-gray-900 w-full truncate focus:outline-none"
                        value={p.label}
                        onChange={(e) => updateItem(p.id, { label: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {approved[p.id] && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">Approved</span>
                      )}
                    </div>
                  </div>

                  {p.generateModule && (
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-600">Module name</label>
                        <input
                          className="border rounded px-2 py-1 text-sm"
                          value={p.moduleName || ''}
                          placeholder="e.g. hero_banner"
                          onChange={(e) => updateItem(p.id, { moduleName: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-600">Type</label>
                        <select
                          className="border rounded px-2 py-1 text-sm bg-white"
                          value={p.type}
                          onChange={(e) => updateItem(p.id, { type: e.target.value as SectionInput['type'] })}
                        >
                          <option value="header">Header</option>
                          <option value="hero">Hero</option>
                          <option value="content">Content</option>
                          <option value="sidebar">Sidebar</option>
                          <option value="footer">Footer</option>
                          <option value="navigation">Navigation</option>
                          <option value="form">Form</option>
                          <option value="gallery">Gallery</option>
                          <option value="testimonial">Testimonial</option>
                          <option value="cta">CTA</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Simplified controls; generation handled via single Generate button below */}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      className="px-2.5 py-1 text-sm rounded border inline-flex items-center gap-1"
                      onClick={() => { setSelectedId(p.id); regenerateForSection(p.id); }}
                      disabled={!!regenerating[p.id]}
                      title="Generate HTML with AI"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v18"/><path d="M3 12h18"/></svg>
                      {regenerating[p.id] ? 'Generating…' : 'Generate'}
                    </button>
                    <button
                      className="px-3 py-1 text-sm rounded bg-green-600 text-white disabled:opacity-50"
                      onClick={() => { setSelectedId(p.id); approveSection(p.id); }}
                      disabled={!activeVId}
                    >Approve</button>
                    <button
                      className="px-2 py-1 text-xs border rounded"
                      onClick={() => setSelectedId(open ? null : p.id)}
                      aria-expanded={open}
                    >{open ? 'Hide' : 'Open'}</button>
                  </div>

                  {open && (
                    <div className="mt-3">
                      {/* Tabs */}
                      <div className="flex gap-2 border-b">
                        {(['image','prompt','html','preview'] as RowTab[]).map(tab => (
                          <button
                            key={tab}
                            className={`px-3 py-1 text-sm -mb-px border-b-2 ${
                              (rowTab[p.id] || 'image') === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600'
                            }`}
                            onClick={() => setRowTab(prev => ({ ...prev, [p.id]: tab }))}
                          >{tab === 'image' ? 'Image' : tab === 'prompt' ? 'Prompt' : tab === 'html' ? 'HTML' : 'Preview'}</button>
                        ))}
                      </div>

                      {/* Tab content */}
                      <div className="pt-3">
                        {/* Image tab */}
                        {((rowTab[p.id] || 'image') === 'image') && (
                          <div>
                            {thumb ? (
                              <img src={thumb} alt={`Section ${i+1}`} className="w-full max-h-96 object-contain border rounded" />
                            ) : (
                              <div className="text-xs text-gray-500">No image available for this section.</div>
                            )}
                          </div>
                        )}

                        {/* Prompt tab - single full prompt editor + RAG hints */}
                        {((rowTab[p.id] || 'image') === 'prompt') && (
                          <div>
                            <div className="text-sm font-medium text-gray-800 mb-2">Prompt for this section</div>
                            <textarea
                              className="w-full border rounded px-2 py-2 text-sm"
                              rows={12}
                              value={fullPrompt[p.id] ?? composePrompt(basePrompt, customPrompts[p.id])}
                              onChange={(e) => setFullPrompt(prev => ({ ...prev, [p.id]: e.target.value }))}
                              placeholder="Edit the entire prompt shown here."
                            />
                            <div className="mt-2 p-2 border rounded bg-gray-50 text-xs">
                              <div className="font-medium text-gray-700 mb-1">RAG hints for type: {p.type}</div>
                              <div className="text-gray-600 whitespace-pre-line">{ragHintsByType[p.type]}</div>
                              <div className="mt-2">
                                <button
                                  className="px-2 py-1 text-xs rounded border"
                                  onClick={() => setFullPrompt(prev => ({
                                    ...prev,
                                    [p.id]: `${(prev[p.id] ?? composePrompt(basePrompt, customPrompts[p.id]))}\n\nContext:\n${ragHintsByType[p.type]}`,
                                  }))}
                                >Insert RAG hints</button>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                className="px-3 py-1 text-sm rounded border"
                                disabled={!designSplitId}
                                onClick={() => savePromptsFor(p.id)}
                              >Save Prompt</button>
                              <button
                                className="px-3 py-1 text-sm rounded border"
                                onClick={async () => {
                                  try {
                                    setSelectedId(p.id);
                                    setRagPreviewLoading(true);
                                    setRagPreviewError(null);
                                    const res = await ragPreview(p.id, {
                                      basePrompt,
                                      customPrompt: deriveCustomFromFull(fullPrompt[p.id] ?? composePrompt(basePrompt, customPrompts[p.id]), basePrompt),
                                      label: p.label || undefined,
                                    });
                                    // Apply enhanced prompt directly into editor
                                    setFullPrompt(prev => ({ ...prev, [p.id]: res.enhancedPrompt }));
                                  } catch (e) {
                                    setRagPreviewError('Failed to enhance prompt with RAG.');
                                  } finally {
                                    setRagPreviewLoading(false);
                                  }
                                }}
                              >{ragPreviewLoading && selectedId===p.id ? 'Enhancing…' : 'Apply RAG'}</button>
                              <button
                                className="px-3 py-1 text-sm rounded border"
                                onClick={() => setFullPrompt(prev => ({ ...prev, [p.id]: composePrompt(basePrompt, customPrompts[p.id]) }))}
                              >Revert to Default</button>
                            </div>
                            {(errors.save || errors.load || ragPreviewError) && selectedId===p.id && (
                              <div className="text-xs text-red-600 mt-2" role="alert">{errors.save || errors.load || ragPreviewError}</div>
                            )}
                          </div>
                        )}

                        {/* HTML tab */}
                        {((rowTab[p.id] || 'image') === 'html') && (
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm font-medium text-gray-800 mb-2">Editable HTML</div>
                              <textarea
                                className="w-full border rounded p-2 text-xs"
                                rows={18}
                                value={workingHtml[p.id] ?? (activeV?.html || '')}
                                onChange={(e) => setWorkingHtml(prev => ({ ...prev, [p.id]: e.target.value }))}
                                placeholder={activeV ? 'Edit the active version HTML locally. Preview tab uses this content.' : 'No active version selected yet.'}
                              />
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  className="text-xs px-2 py-1 border rounded"
                                  onClick={() => setWorkingHtml(prev => ({ ...prev, [p.id]: activeV?.html || '' }))}
                                  disabled={!activeV}
                                >Reset to Active</button>
                                <button
                                  className="text-xs px-2 py-1 border rounded"
                                  onClick={() => { try { navigator.clipboard?.writeText(workingHtml[p.id] ?? activeV?.html ?? ''); } catch {} }}
                                >Copy</button>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 mr-2">Version:</label>
                              <select
                                className="border rounded px-2 py-1 text-xs bg-white"
                                value={activeVId || ''}
                                onChange={(e) => {
                                  const vid = e.target.value;
                                  if (!vid) return;
                                  setSelectedId(p.id);
                                  selectActiveVersion(p.id, vid);
                                  const v = vList.find(v => v.id === vid);
                                  if (v) setWorkingHtml(prev => ({ ...prev, [p.id]: v.html }));
                                }}
                              >
                                <option value="" disabled>{vList.length ? 'Select a version' : 'No versions yet'}</option>
                                {vList.map(v => (
                                  <option key={v.id} value={v.id}>{v.label || v.id}</option>
                                ))}
                              </select>
                              {vList.some(v => v.ragUsed) && (
                                <span className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">RAG</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Preview tab */}
                        {((rowTab[p.id] || 'image') === 'preview') && (
                          <div>
                            {(() => {
                              const html = (workingHtml[p.id] ?? activeV?.html ?? '').trim();
                              return html.length > 0;
                            })() ? (
                              <iframe
                                title={`Preview ${p.label}`}
                                className="w-full h-96 border rounded"
                                sandbox="allow-same-origin"
                                srcDoc={`<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/><script>window.onerror=function(){return true}</script><style>body{margin:8px;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}</style><link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css\"/></head><body>${(workingHtml[p.id] ?? activeV?.html) || ''}</body></html>`}
                              />
                            ) : (
                              <div className="text-xs text-gray-500">Generate HTML first.</div>
                            )}
                          </div>
                        )}
                      </div>
                      {(errors.save || errors.regenerate || errors.load) && selectedId===p.id && (
                        <div className="text-xs text-red-600 mt-2" role="alert">{errors.save || errors.regenerate || errors.load}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function defaultLabelFor(s: SectionInput, index: number) {
  const base = s.type ? s.type : "section";
  return `${capitalize(base)} ${index}`;
}

function defaultModuleNameFor(s: SectionInput, index: number) {
  const base = s.type ? s.type : "section";
  return slugify(`${base}_${index}`);
}

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function capitalize(v: string) {
  return v.charAt(0).toUpperCase() + v.slice(1);
}
