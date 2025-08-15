"use client";

import React, { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import projectsService, { SavedProject } from "@/services/projectsService";
import DesignUploadsManager from "@/components/DesignUploadsManager";
import { useWorkflow } from "@/contexts/WorkflowContext";

export default function ProjectsDashboardPageClient() {
  const router = useRouter();
  const { setUploadedImageFile, setOriginalFileName, setError } = useWorkflow();
  const [projects, setProjects] = useState<SavedProject[]>([]);
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

  useEffect(() => {
    setSelectedIds((prev) => {
      const allowed = new Set(projects.map((p) => p.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id);
      });
      return next;
    });
  }, [projects]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const proj = await projectsService.getAllProjects();
        if (!mounted) return;
        setProjects(proj || []);
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(projects.map((p) => p.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.size} selected project(s)? This cannot be undone.`
    );
    if (!confirmed) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const results = await Promise.allSettled(
        ids.map((id) => projectsService.deleteProject(id))
      );
      const failed = results.filter((r) => r.status === "rejected");
      const succeededIds = ids.filter((_, i) => results[i].status === "fulfilled");
      if (succeededIds.length > 0) {
        setProjects((cur) => cur.filter((p) => !succeededIds.includes(p.id)));
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
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowed.includes(file.type)) {
      setUploadErr("Please upload PNG, JPG, GIF, or WebP image");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadErr("File size must be less than 10MB");
      return;
    }
    setUploadErr(null);
    setSelectedFile(file);
  };

  const startTemplator = async () => {
    if (!selectedFile) {
      setUploadErr("Choose a file first");
      return;
    }
    try {
      setUploadedImageFile(selectedFile);
      setOriginalFileName(selectedFile.name);
      const payload = await new Promise<{
        name: string;
        type: string;
        size: number;
        dataUrl: string;
      }>((resolve) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
            dataUrl: reader.result as string,
          });
        reader.readAsDataURL(selectedFile);
      });
      try {
        sessionStorage.setItem(
          "templator.pendingUpload",
          JSON.stringify({ ...payload, ts: Date.now() })
        );
      } catch {}
      setError(null);
    } catch {}
    const id =
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? crypto.randomUUID()
        : `p_${Date.now()}`;
    setNewOpen(false);
    router.push(`/projects/${id}/split`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <button onClick={createNew} className="px-4 py-2 rounded bg-blue-600 text-white">
            New Templator
          </button>
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
            >
              {selectionMode ? "Cancel Selection" : "Select"}
            </button>
            {selectionMode && (
              <>
                <button onClick={selectAll} className="px-3 py-2 rounded border bg-white hover:bg-gray-50">
                  Select All
                </button>
                <button onClick={clearSelection} className="px-3 py-2 rounded border bg-white hover:bg-gray-50">
                  Clear
                </button>
                <button
                  disabled={selectedIds.size === 0 || bulkBusy}
                  onClick={deleteSelected}
                  className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-50"
                >
                  Delete Selected ({selectedIds.size || 0})
                </button>
              </>
            )}
            <button onClick={createNew} className="px-4 py-2 rounded bg-blue-600 text-white">
              New Templator
            </button>
          </div>
        </div>

        {pageError && (
          <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700">{pageError}</div>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Templators</h2>
            <button onClick={() => router.refresh()} className="text-sm text-gray-600 hover:underline">
              Refresh
            </button>
          </div>
          <div className="bg-white border rounded">
            <DesignUploadsManager />
          </div>
        </section>
      </div>
      {newOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-templator-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNewOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setNewOpen(false);
            }
          }}
        >
          <div ref={modalRef} className="bg-white rounded-lg shadow-lg w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 id="new-templator-title" className="text-lg font-semibold">
                Create New Templator
              </h2>
              <button ref={closeBtnRef} className="text-sm text-gray-600 hover:underline" onClick={() => setNewOpen(false)}>
                Close
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Upload a design image to start. You will be redirected to the Split step.
              </p>
              <input type="file" accept="image/*" onChange={handleFilePick} />
              {selectedFile && (
                <div className="text-xs text-gray-700">
                  Selected: <span className="font-medium">{selectedFile.name}</span>
                </div>
              )}
              {uploadErr && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{uploadErr}</div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1.5 text-sm border rounded" onClick={() => setNewOpen(false)}>
                Cancel
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:opacity-50"
                disabled={!selectedFile}
                onClick={startTemplator}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
