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
  const [ragPreviewText, setRagPreviewText] = useState<string | null>(null);
  const [ragPreviewLoading, setRagPreviewLoading] = useState<boolean>(false);
  const [ragPreviewError, setRagPreviewError] = useState<string | null>(null);
  // Approval and tabs
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'html' | 'preview' | 'prompts'>('prompts');

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
          const s = await getSignedUrl(String(key));
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
    async function run() {
      if (!designSplitId || !sections?.length) return;
      try {
        setLoadingCrops(true);
        setCropError(null);
        // First try to load existing image-crop assets
        const existing = await listSplitAssets(designSplitId, 'image-crop');
        let assets = (existing?.data?.assets || []) as any[];

        if (!assets.length) {
          // sections bounds here are 0..1 normalized -> convert to percent for backend
          const inputs = sections.map((s, i) => ({
            id: s.id,
            index: i,
            unit: 'percent' as const,
            bounds: {
              x: (s.bounds.x ?? 0) * 100,
              y: (s.bounds.y ?? 0) * 100,
              width: (s.bounds.width ?? 0) * 100,
              height: (s.bounds.height ?? 0) * 100,
            }
          }));
          const created = await createCrops(designSplitId, inputs);
          assets = (created?.data?.assets || []) as any[];
        }

        setCropAssets(assets);
        const map = await resolveThumbUrls(assets);
        setThumbUrls(map);
        // Default select first section
        if (!selectedId && sections[0]) setSelectedId(sections[0].id);
      } catch (e) {
        setCropError('Failed to prepare section thumbnails.');
      } finally {
        setLoadingCrops(false);
      }
    }
    run();
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

  // Error banners state
  const [errors, setErrors] = useState<{ loadPrompts?: string; savePrompts?: string; regenerate?: string; loadVersions?: string }>({});
  const [savingPrompts, setSavingPrompts] = useState<Record<string, boolean>>({});
  const [lastSaved, setLastSaved] = useState<Record<string, { basePrompt: string; customPrompt: string; label: string | null }>>({});

  async function savePromptsFor(sectionId: string) {
    if (!designSplitId) return;
    const label = plan.find((p) => p.id === sectionId)?.label || null;
    const payload = {
      designSplitId,
      basePrompt,
      customPrompt: customPrompts[sectionId] || '',
      label,
    };
    try {
      setSavingPrompts((m) => ({ ...m, [sectionId]: true }));
      await saveSectionPrompts(sectionId, payload);
      setLastSaved((m) => ({ ...m, [sectionId]: { basePrompt: payload.basePrompt, customPrompt: payload.customPrompt, label } }));
      setErrors((e) => ({ ...e, savePrompts: undefined }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, savePrompts: 'Failed to save prompts.' }));
    } finally {
      setSavingPrompts((m) => ({ ...m, [sectionId]: false }));
    }
  }

  // Load prompts for selected section
  useEffect(() => {
    async function loadPrompts() {
      if (!selectedId) return;
      try {
        const res = await getSectionPrompts(selectedId, designSplitId || undefined);
        const prompts = res?.prompts;
        if (prompts) {
          setBasePrompt((prev) => (prompts.basePrompt ?? prev));
          setCustomPrompts((prev) => ({ ...prev, [selectedId]: prompts.customPrompt ?? prev[selectedId] }));
          if (prompts.label) {
            setPlan((prev) => prev.map((p) => (p.id === selectedId ? { ...p, label: p.label || prompts.label! } : p)));
          }
          setLastSaved((m) => ({ ...m, [selectedId]: { basePrompt: prompts.basePrompt, customPrompt: prompts.customPrompt, label: prompts.label } }));
        }
        setErrors((e) => ({ ...e, loadPrompts: undefined }));
      } catch (e: any) {
        setErrors((prev) => ({ ...prev, loadPrompts: 'Failed to load prompts for this section.' }));
      }
    }
    loadPrompts();
  }, [selectedId, designSplitId]);

  // Debounced autosave when prompts change
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

  // Regeneration loading state per-section
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});

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
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Plan Generation</h2>
          <p className="text-sm text-gray-600">Approve sections with a generated HTML version to proceed.</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Visual preview: cropped thumbnails grid */}
        <div className="xl:col-span-2 border rounded bg-white">
          <div ref={containerRef} className="p-4">
            {loadingCrops && (
              <div className="text-sm text-gray-600">Preparing thumbnails…</div>
            )}
            {cropError && (
              <div className="text-sm text-red-600" role="alert">{cropError}</div>
            )}
            {!loadingCrops && !cropError && cropAssets.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {cropAssets.map((a, idx) => {
                  const key = a?.meta?.key || a?.storageUrl;
                  const url = key ? thumbUrls[String(key)] : undefined;
                  const sectionId = a?.meta?.sectionId || sections[idx]?.id;
                  const active = selectedId === sectionId;
                  return (
                    <button
                      key={key || idx}
                      type="button"
                      onClick={() => setSelectedId(sectionId)}
                      className={`border rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400 ${active ? 'ring-2 ring-blue-500' : ''}`}
                      title={plan.find(p => p.id === sectionId)?.label || `Section ${idx+1}`}
                    >
                      {url ? (
                        <img src={url} alt={`Section ${idx+1}`} className="block w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-xs text-gray-500">No preview</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {!loadingCrops && !cropError && cropAssets.length === 0 && (
              <div className="p-8 text-center text-gray-500">No thumbnails available</div>
            )}
          </div>
        </div>

        {/* Planner panel */}
        <div className="xl:col-span-1 border rounded bg-gray-50">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Sections ({plan.length})</h3>
            <div className="flex items-center gap-2">
              <button className="text-xs px-2 py-1 border rounded" onClick={() => toggleAllHtml(true)}>All HTML</button>
              <button className="text-xs px-2 py-1 border rounded" onClick={() => toggleAllModule(true)}>All Modules</button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto divide-y">
            {plan.map((p, i) => (
              <div key={p.id} className={`p-3 ${selectedId === p.id ? "bg-white" : "bg-gray-50"}`}>
                <div className="flex items-center justify-between">
                  <button className="text-left font-medium text-gray-800 truncate" onClick={() => setSelectedId(p.id)}>
                    {i + 1}. {p.label}
                  </button>
                  <div className="flex items-center gap-2">
                    {approved[p.id] && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">Approved</span>
                    )}
                    <button className="text-xs px-2 py-1 border rounded" onClick={() => moveItem(p.id, -1)} aria-label="Move up">↑</button>
                    <button className="text-xs px-2 py-1 border rounded" onClick={() => moveItem(p.id, 1)} aria-label="Move down">↓</button>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={p.generateHtml}
                      onChange={(e) => updateItem(p.id, { generateHtml: e.target.checked })}
                    />
                    <span>Generate HTML</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={p.generateModule}
                      onChange={(e) => updateItem(p.id, { generateModule: e.target.checked })}
                    />
                    <span>Generate HubSpot Module</span>
                  </label>

                  {p.generateModule && (
                    <div className="grid grid-cols-1 gap-1">
                      <label className="text-xs text-gray-600">Module name</label>
                      <input
                        className="border rounded px-2 py-1 text-sm"
                        value={p.moduleName || ""}
                        placeholder="e.g. hero_banner"
                        onChange={(e) => updateItem(p.id, { moduleName: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-1">
                    <label className="text-xs text-gray-600">Label</label>
                    <input
                      className="border rounded px-2 py-1 text-sm"
                      value={p.label}
                      onChange={(e) => updateItem(p.id, { label: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-1">
                    <label className="text-xs text-gray-600">Notes</label>
                    <textarea
                      className="border rounded px-2 py-1 text-sm"
                      value={p.notes || ""}
                      onChange={(e) => updateItem(p.id, { notes: e.target.value })}
                      rows={2}
                    />
                  </div>

                  {!p.generateHtml && !p.generateModule && (
                    <div className="text-xs text-red-600">Select at least one: HTML or Module</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel with tabs: HTML | Preview | Prompts */}
        <div className="xl:col-span-1 border rounded bg-white">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">Details</h3>
            <p className="text-sm text-gray-600">Visual reference, tabs, regeneration, and versions</p>
          </div>
          <div className="p-4 space-y-4">
            {!selectedId && (
              <div className="text-sm text-gray-500">Select a section to view details.</div>
            )}

            {selectedId && (
              <>
                {/* Cropped preview */}
                <div>
                  <label className="text-xs text-gray-600">Visual reference</label>
                  <div className="mt-2 border rounded overflow-hidden bg-gray-100">
                    {(() => {
                      const s = getSectionById(selectedId);
                      if (!s || !url) return <div className="p-8 text-center text-gray-400">No preview</div>;
                      const natW = imgNatural.w || 1;
                      const natH = imgNatural.h || 1;
                      const x = s.bounds.x * natW;
                      const y = s.bounds.y * natH;
                      const w = s.bounds.width * natW;
                      const h = s.bounds.height * natH;
                      return (
                        <div
                          className="relative"
                          style={{ width: Math.max(120, Math.min(400, w)), height: Math.max(90, Math.min(300, h)) }}
                        >
                          <div
                            className="absolute inset-0 bg-no-repeat"
                            style={{
                              backgroundImage: `url(${url})`,
                              backgroundPosition: `-${x}px -${y}px`,
                              backgroundSize: `${natW}px ${natH}px`,
                            }}
                            aria-label="Cropped section preview"
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b mb-2 flex items-center gap-2">
                  {(['html','preview','prompts'] as const).map(t => (
                    <button
                      key={t}
                      className={`px-3 py-1 text-sm border-b-2 ${activeTab===t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600'}`}
                      onClick={() => setActiveTab(t)}
                      aria-pressed={activeTab===t}
                    >{t.toUpperCase()}</button>
                  ))}
                </div>

                {/* Prompts */}
                {activeTab === 'prompts' && (
                  <div className="space-y-2">
                  <label className="text-xs text-gray-600">Base prompt (applies if no custom prompt)</label>
                  <textarea
                    className="w-full border rounded px-2 py-1 text-sm"
                    rows={3}
                    value={basePrompt}
                    onChange={(e) => setBasePrompt(e.target.value)}
                  />

                  <label className="text-xs text-gray-600">Custom prompt for this section</label>
                  <textarea
                    className="w-full border rounded px-2 py-1 text-sm"
                    rows={3}
                    value={customPrompts[selectedId] || ''}
                    onChange={(e) => setCustomPrompts((prev) => ({ ...prev, [selectedId]: e.target.value }))}
                    placeholder="Add extra guidance for this section only"
                  />

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={useRag}
                      onChange={(e) => setUseRag(e.target.checked)}
                    />
                    <span>Use RAG (retrieve similar prompts and context)</span>
                  </label>

                  {useRag && (
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1 text-sm rounded border"
                        onClick={async () => {
                          if (!selectedId) return;
                          try {
                            setRagPreviewLoading(true);
                            setRagPreviewError(null);
                            setRagPreviewText(null);
                            const res = await ragPreview(selectedId, {
                              basePrompt,
                              customPrompt: customPrompts[selectedId] || '',
                              label: plan.find((p) => p.id === selectedId)?.label || undefined,
                            });
                            setRagPreviewText(res.enhancedPrompt);
                          } catch (e) {
                            setRagPreviewError('Failed to load RAG preview.');
                          } finally {
                            setRagPreviewLoading(false);
                          }
                        }}
                      >{ragPreviewLoading ? 'Loading…' : 'Preview RAG Context'}</button>
                      {ragPreviewError && (
                        <span className="text-xs text-red-600" role="alert">{ragPreviewError}</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 text-sm rounded border"
                      disabled={!designSplitId}
                      onClick={async () => {
                        try {
                          await saveSectionPrompts(selectedId!, {
                            designSplitId: designSplitId!,
                            basePrompt,
                            customPrompt: customPrompts[selectedId!] || '',
                            label: plan.find((p) => p.id === selectedId!)?.label || null,
                          });
                          setErrors((e) => ({ ...e, savePrompts: undefined }));
                        } catch (e) {
                          setErrors((prev) => ({ ...prev, savePrompts: 'Failed to save prompts.' }));
                        }
                      }}
                    >Save Prompts</button>
                    <button
                      className="px-3 py-1 text-sm rounded bg-emerald-600 text-white disabled:opacity-50"
                      disabled={!!regenerating[selectedId!]}
                      onClick={() => regenerateForSection(selectedId!)}
                    >Regenerate HTML</button>
                    <button
                      className="px-3 py-1 text-sm rounded bg-green-600 text-white disabled:opacity-50"
                      disabled={!activeVersionId[selectedId!]}
                      onClick={() => approveSection(selectedId!)}
                    >Approve</button>
                  </div>
                  {ragPreviewText && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-600 cursor-pointer">RAG Enhanced Prompt Preview</summary>
                      <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto whitespace-pre-wrap">{ragPreviewText}</pre>
                    </details>
                  )}
                  {(errors.savePrompts || errors.regenerate) && (
                    <div className="text-xs text-red-600" role="alert">
                      {errors.savePrompts || errors.regenerate}
                    </div>
                  )}
                  </div>
                )}

                {/* Versions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600">Versions</label>
                    <span className="text-xs text-gray-500">{(versions[selectedId] || []).length} saved</span>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {(versions[selectedId] || []).map((v) => (
                      <div key={v.id} className="border rounded p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium">{v.label || v.id}</div>
                            {v.ragUsed && (
                              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">RAG</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className={`text-xs px-2 py-0.5 border rounded ${activeVersionId[selectedId] === v.id ? 'bg-blue-600 text-white' : ''}`}
                              onClick={() => selectActiveVersion(selectedId!, v.id)}
                            >Use</button>
                          </div>
                        </div>
                        {activeTab === 'html' && (
                          <details className="mt-2" open>
                            <summary className="text-xs text-gray-600 cursor-pointer">HTML</summary>
                            <textarea readOnly className="mt-1 w-full border rounded p-2 text-xs" rows={8} value={v.html} />
                          </details>
                        )}
                        {activeTab === 'prompts' && (
                          <details className="mt-1">
                            <summary className="text-xs text-gray-600 cursor-pointer">Prompt</summary>
                            <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto whitespace-pre-wrap">{v.prompt}</pre>
                          </details>
                        )}
                        {v.enhancedPrompt && (
                          <details className="mt-1" hidden={activeTab!=='prompts'}>
                            <summary className="text-xs text-gray-600 cursor-pointer">Enhanced Prompt (RAG)</summary>
                            <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto whitespace-pre-wrap">{v.enhancedPrompt}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                  {errors.loadPrompts && (
                    <div className="text-xs text-red-600" role="alert">{errors.loadPrompts}</div>
                  )}
                </div>

                {/* Live Rendered Preview */}
                {activeTab === 'preview' && (
                  <div className="space-y-2">
                    <label className="text-xs text-gray-600">Rendered Preview</label>
                    {(() => {
                      const actId = activeVersionId[selectedId!];
                      const v = (versions[selectedId!] || []).find((x) => x.id === actId);
                      if (!v) return <div className="text-xs text-gray-500">No active version selected.</div>;
                      return (
                        <iframe
                          title="Rendered HTML Preview"
                          className="w-full h-56 border rounded"
                          sandbox="allow-same-origin"
                          srcDoc={`<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/><script>window.onerror=function(){return true}</script><style>body{margin:8px;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial}</style><link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css\"/></head><body>${v.html}</body></html>`}
                        />
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
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
