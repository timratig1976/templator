"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import projectsService, { SavedProject } from "@/services/projectsService";
import { listRecentSplits } from "@/services/aiEnhancementService";
import DesignUploadsManager from "@/components/DesignUploadsManager";
import { useWorkflow } from "@/contexts/WorkflowContext";

export default function ProjectsDashboardPage() {
  const router = useRouter();
  const { setUploadedImageFile, setOriginalFileName, setError } = useWorkflow();
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const masterRef = useRef<HTMLInputElement>(null);
  
  // Keep master checkbox in sync with selection
  useEffect(() => {
    const el = masterRef.current;
    if (!el) return;
    if (!selectionMode) {
      el.indeterminate = false;
      el.checked = false;
      return;
    }
    const total = projects.length;
    const selected = selectedIds.size;
    el.indeterminate = selected > 0 && selected < total;
    el.checked = total > 0 && selected === total;
  }, [selectionMode, selectedIds, projects]);

  // Prune selection if projects list changes
  useEffect(() => {
    setSelectedIds((prev) => {
      const allowed = new Set(projects.map(p => p.id));
      const next = new Set<string>();
      prev.forEach(id => { if (allowed.has(id)) next.add(id); });
      return next;
    });
  }, [projects]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [proj, recent] = await Promise.all([
          projectsService.getAllProjects().catch(() => []),
          listRecentSplits(12).catch(() => ({ success: true, data: { items: [] } })),
        ]);
        if (!mounted) return;
        setProjects(proj || []);
        setSplits(recent?.data?.items || []);
      } catch (e: any) {
        setPageError(e?.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  
  const toggleSelectionMode = () => {
    setSelectionMode((v) => {
      const next = !v;
      if (!next) setSelectedIds(new Set());
      return next;
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(projects.map(p => p.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`Delete ${selectedIds.size} selected project(s)? This cannot be undone.`);
    if (!confirmed) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(ids.map(id => projectsService.deleteProject(id)));
      const failed = results.filter(r => r.status === 'rejected');
      const succeededIds = ids.filter((_, i) => results[i].status === 'fulfilled');
      if (succeededIds.length > 0) {
        setProjects((cur) => cur.filter(p => !succeededIds.includes(p.id)));
      }
      if (failed.length > 0) {
        alert(`${failed.length} deletions failed. Some items might remain.`);
      }
      setSelectedIds(new Set());
      setSelectionMode(false);
    } finally {
      setBulkBusy(false);
    }
  };

  const createNew = () => {
    setSelectedFile(null);
    setUploadErr(null);
    setNewOpen(true);
    setTimeout(() => closeBtnRef.current?.focus(), 0);
  };

  const handleFilePick: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    // Basic validation aligned with DesignUpload
    const allowed = ['image/jpeg','image/jpg','image/png','image/gif','image/webp'];
    if (!allowed.includes(file.type)) {
      setUploadErr('Please upload PNG, JPG, GIF, or WebP image');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadErr('File size must be less than 10MB');
      return;
    }
    setUploadErr(null);
    setSelectedFile(file);
  };

  const startTemplator = async () => {
    if (!selectedFile) {
      setUploadErr('Choose a file first');
      return;
    }
    try {
      setUploadedImageFile(selectedFile);
      setOriginalFileName(selectedFile.name);
      // Persist file in sessionStorage to survive reloads and route boundaries
      const payload = await new Promise<{ name: string; type: string; size: number; dataUrl: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          dataUrl: reader.result as string,
        });
        reader.readAsDataURL(selectedFile);
      });
      try { sessionStorage.setItem('templator.pendingUpload', JSON.stringify({ ...payload, ts: Date.now() })); } catch {}
      setError(null);
    } catch {}
    const id = (typeof crypto !== "undefined" && (crypto as any).randomUUID) ? crypto.randomUUID() : `p_${Date.now()}`;
    setNewOpen(false);
    router.push(`/projects/${id}/split`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <button onClick={createNew} className="px-4 py-2 rounded bg-blue-600 text-white">Create New</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 bg-white rounded border animate-pulse" />
          <div className="h-40 bg-white rounded border animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectionMode}
              className="px-3 py-2 rounded border bg-white hover:bg-gray-50"
            >{selectionMode ? 'Cancel Selection' : 'Select'}</button>
            {selectionMode && (
              <>
                <button
                  onClick={selectAll}
                  className="px-3 py-2 rounded border bg-white hover:bg-gray-50"
                >Select All</button>
                <button
                  onClick={clearSelection}
                  className="px-3 py-2 rounded border bg-white hover:bg-gray-50"
                >Clear</button>
                <button
                  disabled={selectedIds.size === 0 || bulkBusy}
                  onClick={deleteSelected}
                  className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-50"
                >Delete Selected ({selectedIds.size || 0})</button>
              </>
            )}
            <button onClick={createNew} className="px-4 py-2 rounded bg-blue-600 text-white">Create New</button>
          </div>
        </div>

        {pageError && (
          <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700">{pageError}</div>
        )}

        {/* Primary Projects View: Uploads Table */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Uploads</h2>
            <div className="text-sm text-gray-600">Manage your design uploads here. Select an upload to proceed to Split.</div>
          </div>
          <div className="bg-white border rounded">
            <DesignUploadsManager />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <input
                aria-label="Select all templators"
                ref={masterRef}
                type="checkbox"
                className="h-4 w-4"
                disabled={projects.length === 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectionMode(true);
                    setSelectedIds(new Set(projects.map(p => p.id)));
                  } else {
                    setSelectedIds(new Set());
                    setSelectionMode(false);
                  }
                }}
              />
              <h2 className="text-lg font-medium">Templators</h2>
            </div>
            <button onClick={() => router.refresh()} className="text-sm text-gray-600 hover:underline">Refresh</button>
          </div>
          {projects.length === 0 ? (
            <div className="p-4 rounded border bg-white text-gray-600">No templators yet. Click "New Templator" to start.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <div key={p.id} className="relative">
                  {selectionMode && (
                    <div className="absolute top-2 left-2 z-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelectOne(p.id)}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => { if (!selectionMode) router.push(`/projects/${p.id}/upload`); else toggleSelectOne(p.id); }}
                    className={`text-left w-full bg-white border rounded p-4 ${selectionMode ? '' : 'hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400'}`}
                  >
                    <div className="font-semibold truncate flex items-center gap-2">
                      {selectionMode && (
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: selectedIds.has(p.id) ? '#2563eb' : '#d1d5db' }} />
                      )}
                      <span className="truncate">{p.name}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{new Date(p.updatedAt).toLocaleString()}</div>
                    <div className="mt-2 text-sm text-gray-600">
                      {p.metadata?.sectionsCount ?? 0} sections • {p.metadata?.fieldsCount ?? 0} fields
                    </div>
                  </button>
                  {/* Quick shortcuts */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      aria-label={`Open Split for ${p.name}`}
                      onClick={() => router.push(`/projects/${p.id}/split`)}
                      className="px-2.5 py-1 text-xs rounded border bg-white hover:bg-gray-50"
                    >
                      Split
                    </button>
                    <button
                      aria-label={`Open Plan (HTML) for ${p.name}`}
                      onClick={() => router.push(`/projects/${p.id}/plan`)}
                      className="px-2.5 py-1 text-xs rounded border bg-white hover:bg-gray-50"
                    >
                      HTML
                    </button>
                    <button
                      aria-label={`Open Generate (Modules) for ${p.name}`}
                      onClick={() => router.push(`/projects/${p.id}/generate`)}
                      className="px-2.5 py-1 text-xs rounded border bg-white hover:bg-gray-50"
                    >
                      Modules
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-medium mb-3">Recent Templators</h2>
          {splits.length === 0 ? (
            <div className="p-4 rounded border bg-white text-gray-600">No recent templators.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {splits.map((s: any) => (
                <div key={s.designSplitId} className="bg-white border rounded p-4">
                  <div className="font-semibold truncate">{s.name || s.designSplitId}</div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(s.createdAt).toLocaleString()}</div>
                  <div className="mt-2 text-sm text-gray-600">{s.sectionCount ?? 0} sections</div>
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        const id = (typeof crypto !== "undefined" && (crypto as any).randomUUID) ? crypto.randomUUID() : `p_${Date.now()}`;
                        const qp = new URLSearchParams({ splitId: s.designSplitId });
                        router.push(`/projects/${id}/split?${qp.toString()}`);
                      }}
                      className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
                    >
                      Open Templator
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
    </div>
    {newOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        role="dialog" aria-modal="true" aria-labelledby="new-templator-title"
        onClick={(e) => { if (e.target === e.currentTarget) setNewOpen(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); setNewOpen(false); }
        }}
      >
        <div ref={modalRef} className="bg-white rounded-lg shadow-lg w-full max-w-md p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 id="new-templator-title" className="text-lg font-semibold">Create New Templator</h2>
            <button ref={closeBtnRef} className="text-sm text-gray-600 hover:underline" onClick={() => setNewOpen(false)}>Close</button>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Upload a design image to start. You will be redirected to the Split step.</p>
            <input type="file" accept="image/*" onChange={handleFilePick} />
            {selectedFile && (
              <div className="text-xs text-gray-700">Selected: <span className="font-medium">{selectedFile.name}</span></div>
            )}
            {uploadErr && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{uploadErr}</div>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className="px-3 py-1.5 text-sm border rounded" onClick={() => setNewOpen(false)}>Cancel</button>
            <button className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:opacity-50" disabled={!selectedFile} onClick={startTemplator}>Continue</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
