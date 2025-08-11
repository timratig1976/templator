'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { deleteDesignUpload, listDesignUploads, DesignUpload } from '@/services/designUploadsService';
import { getSignedUrl, listSplitAssets, listRecentSplits, createCrops, getSplitSummary } from '@/services/aiEnhancementService';
import { API_BASE_URL } from '@/config/api';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function DesignUploadsManager() {
  const [items, setItems] = useState<DesignUpload[]>([]);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userIdFilter, setUserIdFilter] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'createdAt' | 'size' | 'filename'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showFullChecksum, setShowFullChecksum] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({}); // id -> absolute signed URL
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTitle, setGalleryTitle] = useState<string>('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [bulkIds, setBulkIds] = useState<string[] | null>(null);
  const previewModalRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const confirmModalRef = useRef<HTMLDivElement | null>(null);
  const confirmPrimaryBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const galleryModalRef = useRef<HTMLDivElement | null>(null);

  // Focus the close button when the preview opens
  useEffect(() => {
    if (previewUrl) {
      // Defer to next tick to ensure elements are mounted
      const id = window.setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [previewUrl]);

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewName(null);
    // Restore focus to the element that launched the modal
    if (lastFocusedRef.current) {
      try { lastFocusedRef.current.focus(); } catch {}
    }
  };

  async function openGalleryForUpload(upload: any) {
    // Heuristic: use the most recent split for this upload by hitting the recent endpoint and filtering by uploadId is not available here,
    // so we rely on server enrichment counts and a backend summary per split already implemented on selection flow.
    // Instead, fetch assets via the split-assets endpoint requires a splitId; since we don't have it per row,
    // we will call the recent splits endpoint and pick the newest where designUploadId matches if available later.
    // For now, fallback: show any image from this upload (its original) if available.
    try {
      setGalleryTitle(upload.filename || 'Gallery');
      console.log('[Gallery] opening for upload', { id: upload?.id, filename: upload?.filename });
      setGalleryImages([]);
      // Attempt: try to infer splitId from several possible fields
      const splitId = (upload as any).designSplitId
        || (upload as any).lastSplitId
        || (upload.meta && (upload.meta.designSplitId || upload.meta.lastSplitId));
      if (splitId) {
        const assetsRes = await listSplitAssets(String(splitId), 'image-crop');
        let assets = assetsRes?.data?.assets || [];
        console.log('[Gallery] assets for split', splitId, assets);
        // Always fetch summary to know the intended section set
        let sections: any[] = [];
        try {
          const summary = await getSplitSummary(String(splitId));
          sections = summary?.data?.sections || [];
        } catch (e) {
          console.log('[Gallery] could not load split summary', e);
        }
        // If no crops exist yet for this split, try to create them from split summary
        if (!assets.length && sections.length) {
          try {
            const inputs = sections.map((s: any, i: number) => {
              const bx = Number(s.bounds?.x ?? 0);
              const by = Number(s.bounds?.y ?? 0);
              const bw = Number(s.bounds?.width ?? 0);
              const bh = Number(s.bounds?.height ?? 0);
              // Detect if bounds are in 0..1 (fractions) or already 0..100 (percent)
              const maxVal = Math.max(bx, by, bw, bh);
              const factor = maxVal <= 1 ? 100 : 1;
              return {
                id: s.id,
                index: i,
                unit: 'percent' as const,
                bounds: {
                  x: bx * factor,
                  y: by * factor,
                  width: bw * factor,
                  height: bh * factor,
                },
              };
            });
            const created = await createCrops(String(splitId), inputs, { force: true });
            assets = (created?.data?.assets || []) as any[];
            console.log('[Gallery] created crops', assets);
          } catch (e) {
            console.log('[Gallery] failed to create crops from summary', e);
          }
        }
        // Align assets to section set if available
        if (sections.length) {
          const sectionIds = new Set(sections.map((s: any) => s.id).filter(Boolean));
          let filtered = assets.filter((a: any) => {
            const sid = a?.meta?.sectionId;
            return sid ? sectionIds.has(sid) : true;
          });
          // Sort by stored order/meta
          filtered.sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));
          // If the ID-based filter produced zero (mismatched IDs), fallback purely by order
          if (filtered.length === 0 && assets.length) {
            filtered = [...assets].sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));
          }
          // Trim to the number of sections
          assets = filtered.slice(0, sections.length);
          console.log('[Gallery] filtered assets by sections (with order fallback)', { before: (assetsRes?.data?.assets || []).length, after: assets.length, sections: sections.length });

          // If the crops look like lines (very thin), auto-regenerate once using corrected bounds scaling
          const thinThreshold = 6; // px
          const thinCount = assets.filter((a: any) => (a?.meta?.height ?? 0) < thinThreshold || (a?.meta?.width ?? 0) < thinThreshold).length;
          if (thinCount >= Math.ceil(sections.length / 2)) {
            console.log('[Gallery] detected thin crops; attempting one-time regeneration with corrected percent bounds', { thinCount, total: sections.length });
            try {
              const inputs = sections.map((s: any, i: number) => {
                const bx = Number(s.bounds?.x ?? 0);
                const by = Number(s.bounds?.y ?? 0);
                const bw = Number(s.bounds?.width ?? 0);
                const bh = Number(s.bounds?.height ?? 0);
                const maxVal = Math.max(bx, by, bw, bh);
                const factor = maxVal <= 1 ? 100 : 1;
                return {
                  id: s.id,
                  index: i,
                  unit: 'percent' as const,
                  bounds: { x: bx * factor, y: by * factor, width: bw * factor, height: bh * factor },
                };
              });
              const regen = await createCrops(String(splitId), inputs, { force: true });
              assets = (regen?.data?.assets || []).slice(0, sections.length);
              console.log('[Gallery] regenerated crops', assets);
            } catch (e) {
              console.log('[Gallery] regeneration failed', e);
            }
          }
        }
        const urlsSet = new Set<string>();
        let idx = 0;
        for (const a of assets) {
          const key: string = (a?.meta?.key) || (a?.storageUrl ?? '');
          console.log('[Gallery] asset item', { key, storageUrl: a?.storageUrl, metaKey: a?.meta?.key });
          if (!key) { idx++; continue; }
          try {
            const sig = await getSignedUrl(String(key), 5 * 60 * 1000);
            let urlPath = sig?.data?.url || '';
            if (urlPath) urlPath += (urlPath.includes('?') ? '&' : '?') + `i=${idx}`;
            const abs = urlPath.startsWith('http') ? urlPath : `${API_BASE_URL}${urlPath}`;
            if (abs) urlsSet.add(abs);
          } catch (e) {
            console.log('[Gallery] signing failed for key', key, e);
          }
          idx++;
        }
        const urls = Array.from(urlsSet);
        console.log('[Gallery] resolved URLs', urls);
        if (urls.length > 0) {
          setGalleryImages(urls);
          setGalleryOpen(true);
          return;
        }
      }

      // Fallback: only if we do NOT have a splitId on this row, try recent splits for the SAME upload
      try {
        const recent = await listRecentSplits(15);
        const items = (recent?.data?.items || []).filter((it: any) => it?.designUploadId === upload?.id);
        for (const it of items) {
          if (!it?.designSplitId) continue;
          try {
            const assetsRes = await listSplitAssets(String(it.designSplitId), 'image-crop');
            let assets = assetsRes?.data?.assets || [];
            console.log('[Gallery][fallback] assets for split', it.designSplitId, assets);

            // Fetch sections to align counts
            let sections: any[] = [];
            try {
              const summary = await getSplitSummary(String(it.designSplitId));
              sections = summary?.data?.sections || [];
            } catch (e) {
              console.log('[Gallery][fallback] could not load split summary', e);
            }
            if (sections.length) {
              const sectionIds = new Set(sections.map((s: any) => s.id).filter(Boolean));
              let filtered = assets.filter((a: any) => {
                const sid = a?.meta?.sectionId;
                return sid ? sectionIds.has(sid) : true;
              });
              filtered.sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));
              if (filtered.length === 0 && assets.length) {
                filtered = [...assets].sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));
              }
              assets = filtered.slice(0, sections.length);
              console.log('[Gallery][fallback] filtered assets by sections (with order fallback)', { before: (assetsRes?.data?.assets || []).length, after: assets.length, sections: sections.length });

              const thinThreshold = 6; // px
              const thinCount = assets.filter((a: any) => (a?.meta?.height ?? 0) < thinThreshold || (a?.meta?.width ?? 0) < thinThreshold).length;
              if (thinCount >= Math.ceil(sections.length / 2)) {
                console.log('[Gallery][fallback] detected thin crops; attempting regeneration with corrected percent bounds', { thinCount, total: sections.length });
                try {
                  const inputs = sections.map((s: any, i: number) => {
                    const bx = Number(s.bounds?.x ?? 0);
                    const by = Number(s.bounds?.y ?? 0);
                    const bw = Number(s.bounds?.width ?? 0);
                    const bh = Number(s.bounds?.height ?? 0);
                    const maxVal = Math.max(bx, by, bw, bh);
                    const factor = maxVal <= 1 ? 100 : 1;
                    return {
                      id: s.id,
                      index: i,
                      unit: 'percent' as const,
                      bounds: { x: bx * factor, y: by * factor, width: bw * factor, height: bh * factor },
                    };
                  });
                  const regen = await createCrops(String(it.designSplitId), inputs, { force: true });
                  assets = (regen?.data?.assets || []).slice(0, sections.length);
                  console.log('[Gallery][fallback] regenerated crops', assets);
                } catch (e) {
                  console.log('[Gallery][fallback] regeneration failed', e);
                }
              }
            }

            const urlsSet = new Set<string>();
            let idx = 0;
            for (const a of assets) {
              const key: string = (a?.meta?.key) || (a?.storageUrl ?? '');
              console.log('[Gallery][fallback] asset item', { key, storageUrl: a?.storageUrl, metaKey: a?.meta?.key });
              if (!key) { idx++; continue; }
              try {
                const sig = await getSignedUrl(String(key), 5 * 60 * 1000);
                let urlPath = sig?.data?.url || '';
                if (urlPath) urlPath += (urlPath.includes('?') ? '&' : '?') + `i=${idx}`;
                const abs = urlPath.startsWith('http') ? urlPath : `${API_BASE_URL}${urlPath}`;
                if (abs) urlsSet.add(abs);
              } catch (e) {
                console.log('[Gallery][fallback] signing failed for key', key, e);
              }
              idx++;
            }
            const urls = Array.from(urlsSet);
            console.log('[Gallery][fallback] resolved URLs', urls);
            if (urls.length > 0) {
              setGalleryImages(urls);
              setGalleryOpen(true);
              return;
            }
          } catch {}
        }
      } catch {}
      // Fallback: if no split assets, show original image if available
      if (signedUrls[upload.id]) {
        setGalleryImages([signedUrls[upload.id]]);
        setGalleryOpen(true);
      }
    } catch (e) {
      setError('Failed to open gallery');
    }
  }

  const canPrev = offset > 0;
  const canNext = hasMore;

  async function fetchData() {
    setLoading(true);
    try {
      const res = await listDesignUploads({ userId: userIdFilter || undefined, limit, offset });
      setItems(res.data);
      setCount(res.pagination?.count ?? res.data.length);
      setTotal(res.pagination?.total ?? res.data.length + offset);
      setHasMore(!!res.pagination?.hasMore);
      setError(null);
      // Reset selection on new data load
      setSelected({});
      // Resolve signed URLs for image items
      const imageItems = res.data.filter((it) => isImageUpload(it) && !!it.storageUrl);
      const entries = await Promise.all(
        imageItems.map(async (it) => {
          try {
            const storageUrl = String(it.storageUrl);
            // Pass through the full storageUrl as the signing key so the backend can parse prefixes correctly
            const keyForSigning = storageUrl;
            if (!keyForSigning) return [it.id, ''] as const;
            const sig = await getSignedUrl(keyForSigning, 5 * 60 * 1000);
            const urlPath = sig?.data?.url || '';
            const abs = urlPath.startsWith('http') ? urlPath : `${API_BASE_URL}${urlPath}`;
            return [it.id, abs] as const;
          } catch (err) {
            // Fallback: if original storageUrl is already absolute, try to use it directly
            try {
              const storageUrl = String(it.storageUrl || '');
              if (storageUrl.startsWith('http')) {
                console.warn('Using storageUrl without signing for', it.id);
                return [it.id, storageUrl] as const;
              }
            } catch {}
            console.warn('Failed to resolve signed URL for', it.id, err);
            return [it.id, ''] as const;
          }
        })
      );
      const map: Record<string, string> = {};
      for (const [id, url] of entries) { if (url) map[id] = url; }
      setSignedUrls(map);
    } catch (e: any) {
      setError(e?.message || 'Failed to load uploads');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, offset]);

  const handleDelete = (id: string, name?: string | null) => {
    lastFocusedRef.current = (document.activeElement as HTMLElement) || null;
    setConfirmId(id);
    setConfirmName(name || null);
    // Focus confirm primary when modal opens
    setTimeout(() => {
      confirmPrimaryBtnRef.current?.focus();
    }, 0);
  };

  const confirmDelete = async () => {
    // Bulk delete flow
    if (bulkIds && bulkIds.length > 0) {
      setDeleting(true);
      try {
        const ids = [...bulkIds];
        let failures = 0;
        for (const id of ids) {
          try { await deleteDesignUpload(id); }
          catch { failures++; }
        }
        if (failures === 0) setToast('Selected uploads deleted');
        else setError(`${failures} deletion${failures > 1 ? 's' : ''} failed`);
        setBulkIds(null);
        setConfirmId(null);
        setConfirmName(null);
        fetchData();
      } finally {
        setDeleting(false);
        lastFocusedRef.current?.focus?.();
      }
      return;
    }
    if (!confirmId) return;
    setDeleting(true);
    try {
      await deleteDesignUpload(confirmId);
      setToast('Upload deleted');
      setConfirmId(null);
      setConfirmName(null);
      // refetch current page
      fetchData();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = async (text?: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setToast('Copied to clipboard');
    } catch {
      setToast('Failed to copy');
    }
  };

  // Persist view state
  useEffect(() => {
    try {
      const saved = localStorage.getItem('uploadsView');
      if (saved) {
        const s = JSON.parse(saved);
        if (typeof s.limit === 'number') setLimit(s.limit);
        if (typeof s.userIdFilter === 'string') setUserIdFilter(s.userIdFilter);
        if (s.sortKey) setSortKey(s.sortKey);
        if (s.sortDir) setSortDir(s.sortDir);
      }
    } catch {}
    // initial fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('uploadsView', JSON.stringify({ limit, userIdFilter, sortKey, sortDir }));
    } catch {}
  }, [limit, userIdFilter, sortKey, sortDir]);

  const sortedItems = useMemo(() => {
    const data = [...items];
    data.sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === 'createdAt') { av = a.createdAt || ''; bv = b.createdAt || ''; }
      else if (sortKey === 'size') { av = a.size; bv = b.size; }
      else { av = (a.filename || '').toLowerCase(); bv = (b.filename || '').toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [items, sortKey, sortDir]);

  const imagesOnPage = useMemo(() => {
    return sortedItems.filter(it => isImageUpload(it) && !!signedUrls[it.id]);
  }, [sortedItems, signedUrls]);

  function toggleSort(key: 'createdAt' | 'size' | 'filename') {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'filename' ? 'asc' : 'desc');
    }
  }

  function navigatePreview(delta: number) {
    if (previewIndex == null) return;
    const next = Math.min(Math.max(0, previewIndex + delta), imagesOnPage.length - 1);
    setPreviewIndex(next);
    const it = imagesOnPage[next];
    if (it) {
      setPreviewUrl(signedUrls[it.id] || null);
      setPreviewName(it.filename || null);
    }
  }

  function handlePreviewKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); navigatePreview(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); navigatePreview(1); return; }
    handleModalKeyDown(e, previewModalRef, closePreview);
  }

  function handleBulkCopyUrls() {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([id]) => id);
    if (ids.length === 0) return;
    const urls = sortedItems
      .filter(it => ids.includes(it.id) && signedUrls[it.id])
      .map(it => signedUrls[it.id] as string);
    if (urls.length > 0) {
      navigator.clipboard.writeText(urls.join('\n'));
      setToast('Copied selected URLs');
    }
  }

  function openBulkDelete() {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([id]) => id);
    if (ids.length === 0) return;
    lastFocusedRef.current = (document.activeElement as HTMLElement) || null;
    setBulkIds(ids);
    setConfirmId('bulk');
    setConfirmName(`${ids.length} items`);
    setTimeout(() => { confirmPrimaryBtnRef.current?.focus(); }, 0);
  }

  const rows = useMemo(() => sortedItems.map((it) => (
    <tr key={it.id} className="border-b border-gray-200 hover:bg-gray-50">
      <td className="px-3 py-2 text-sm">
        <input
          type="checkbox"
          aria-label={`Select ${it.filename}`}
          checked={!!selected[it.id]}
          onChange={(e) => setSelected(prev => ({ ...prev, [it.id]: e.target.checked }))}
        />
      </td>
      <td className="px-3 py-2 text-sm font-medium text-gray-800">{it.filename}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{it.mime}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{formatBytes(it.size)}</td>
      <td className="px-3 py-2 text-xs font-mono text-gray-500 truncate max-w-[280px]" title={it.checksum || ''}>
        {showFullChecksum ? (it.checksum || '-') : (<>{it.checksum?.slice(0, 12)}{it.checksum && it.checksum.length > 12 ? '…' : ''}</>)}
        {it.checksum && (
          <span className="ml-2 inline-flex gap-2">
            <button className="text-blue-600 hover:underline" onClick={() => { navigator.clipboard.writeText(it.checksum!); setToast('Checksum copied'); }}>Copy</button>
            <button className="text-gray-700 hover:underline" onClick={() => setShowFullChecksum(v => !v)}>{showFullChecksum ? 'Truncate' : 'Expand'}</button>
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500" suppressHydrationWarning>{it.createdAt ? new Date(it.createdAt).toUTCString() : '-'}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{(it as any).splitCount ?? 0}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{(it as any).partCount ?? 0}</td>
      <td className="px-3 py-2 text-sm flex gap-2">
        <button className="text-gray-700 hover:underline" onClick={() => openGalleryForUpload(it)} aria-label={`Open gallery for ${it.filename}`}>Gallery</button>
        {isImageUpload(it) && signedUrls[it.id] ? (
          <>
            <button
              className="text-gray-700 hover:underline"
              onClick={() => {
                lastFocusedRef.current = (document.activeElement as HTMLElement) || null;
                setPreviewUrl(signedUrls[it.id] || null);
                setPreviewName(it.filename || null);
                const idx = imagesOnPage.findIndex(x => x.id === it.id);
                setPreviewIndex(idx >= 0 ? idx : null);
              }}
              aria-label={`Preview ${it.filename}`}
            >Preview</button>
            <a className="text-blue-600 hover:underline" href={signedUrls[it.id]} target="_blank" rel="noreferrer" aria-label={`Open ${it.filename}`}>Open</a>
            <button className="text-gray-700 hover:underline" onClick={() => handleCopy(signedUrls[it.id])} aria-label={`Copy URL for ${it.filename}`}>Copy URL</button>
          </>
        ) : (
          <span className="text-gray-400" aria-live="polite">No file</span>
        )}
        <button className="text-red-600 hover:underline" onClick={() => handleDelete(it.id, it.filename)} aria-label={`Delete ${it.filename}`}>Delete</button>
      </td>
    </tr>
  )), [sortedItems, selected, showFullChecksum]);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Design Uploads</h2>
        <div className="flex items-center gap-2">
          <input
            placeholder="Filter by userId"
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <button
            className="bg-gray-800 text-white rounded px-3 py-1 text-sm"
            onClick={() => { setOffset(0); fetchData(); }}
          >Apply</button>
        </div>
      </div>

      {error && (
        <div className="mb-3 border border-red-300 bg-red-50 text-red-800 px-3 py-2 rounded flex items-start justify-between" role="alert">
          <span className="text-sm">{error}</span>
          <button className="text-sm underline" onClick={() => setError(null)} aria-label="Dismiss error">Dismiss</button>
        </div>
      )}

      {galleryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gallery-title"
          onClick={(e) => { if (e.target === e.currentTarget) { setGalleryOpen(false); } }}
          onKeyDown={(e) => handleModalKeyDown(e, galleryModalRef, () => setGalleryOpen(false))}
          tabIndex={-1}
        >
          <div ref={galleryModalRef} className="max-w-[92vw] max-h-[90vh] bg-white rounded shadow p-4 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 id="gallery-title" className="text-base font-semibold">{galleryTitle} · Parts</h3>
              <button className="text-sm" onClick={() => setGalleryOpen(false)}>Close</button>
            </div>
            {galleryImages.length === 0 ? (
              <div className="text-sm text-gray-600">No parts available for this upload.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {galleryImages.map((src, idx) => (
                  <div key={idx} className="border rounded overflow-hidden bg-gray-50">
                    <img
                      src={src}
                      alt={`Part ${idx + 1}`}
                      title={`Part ${idx + 1}`}
                      className="w-full h-40 object-contain"
                      onLoad={(e) => {
                        const img = e.target as HTMLImageElement;
                        const w = img.naturalWidth;
                        const h = img.naturalHeight;
                        console.log('[Gallery] image loaded', { idx, src, naturalWidth: w, naturalHeight: h });
                        if (h > 0 && h < 6) {
                          try { img.style.outline = '2px dashed #94a3b8'; } catch {}
                        }
                      }}
                      onError={(e) => {
                        console.log('[Gallery] image failed to load', { idx, src });
                        try {
                          (e.target as HTMLImageElement).style.opacity = '0.3';
                          (e.target as HTMLImageElement).style.filter = 'grayscale(100%)';
                        } catch {}
                      }}
                    />
                    <div className="px-2 py-1 text-[11px] text-gray-600 flex justify-between">
                      <span>#{idx + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Select</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                <button className="hover:underline" onClick={() => toggleSort('filename')}>Filename{sortKey === 'filename' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">MIME</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                <button className="hover:underline" onClick={() => toggleSort('size')}>Size{sortKey === 'size' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Checksum</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                <button className="hover:underline" onClick={() => toggleSort('createdAt')}>Created{sortKey === 'createdAt' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Splits</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Parts</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="px-3 py-3"><div className="h-4 w-48 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-40 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-12 bg-gray-200 rounded animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></td>
                  </tr>
                ))}
              </>
            ) : rows.length ? rows : (
              <tr><td className="px-3 py-6 text-sm text-gray-600 text-center" colSpan={9}>
                No uploads found. Start by uploading a design on the Home page, then return to manage it here.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            disabled={!canPrev}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >Previous</button>
          <button
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            disabled={!canNext}
            onClick={() => setOffset(offset + limit)}
          >Next</button>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Showing <span className="font-medium">{total ? offset + 1 : 0}</span>–<span className="font-medium">{Math.min(total, offset + items.length)}</span> of <span className="font-medium">{total}</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Page size</span>
            <select className="border rounded px-2 py-1 text-sm" value={limit} onChange={(e) => { setOffset(0); setLimit(parseInt(e.target.value, 10)); }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {Object.values(selected).some(Boolean) && (
        <div className="mt-3 flex items-center justify-between border rounded p-3 bg-gray-50">
          <span className="text-sm text-gray-700">{Object.values(selected).filter(Boolean).length} selected</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm border rounded" onClick={handleBulkCopyUrls}>Copy selected URLs</button>
            <button className="px-3 py-1 text-sm rounded bg-red-600 text-white" onClick={openBulkDelete}>Delete selected</button>
          </div>
        </div>
      )}

      {(confirmId || bulkIds) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title"
          onKeyDown={(e) => handleModalKeyDown(e, confirmModalRef, () => { if (!deleting) { setConfirmId(null); setConfirmName(null); lastFocusedRef.current?.focus?.(); } })}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) { setConfirmId(null); setConfirmName(null); lastFocusedRef.current?.focus?.(); } }}
        >
          <div ref={confirmModalRef} className="bg-white rounded-lg shadow-lg w-full max-w-md p-5">
            <h3 id="delete-dialog-title" className="text-lg font-semibold mb-2">{bulkIds && bulkIds.length > 0 ? 'Delete selected uploads?' : 'Delete upload?'}</h3>
            <p className="text-sm text-gray-700 mb-4">This will attempt to remove the stored file(s) and delete the record(s).</p>
            {bulkIds && bulkIds.length > 0 ? (
              <p className="text-sm text-gray-600 mb-4">Items selected: <span className="font-medium">{bulkIds.length}</span></p>
            ) : (
              confirmName && <p className="text-sm text-gray-600 mb-4">Item: <span className="font-mono">{confirmName}</span></p>
            )}
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 text-sm border rounded"
                ref={confirmCloseBtnRef}
                onClick={() => { if (!deleting) { setBulkIds(null); setConfirmId(null); setConfirmName(null); lastFocusedRef.current?.focus?.(); } }}
                disabled={deleting}
              >Cancel</button>
              <button
                className="px-3 py-1 text-sm rounded bg-red-600 text-white disabled:opacity-50"
                ref={confirmPrimaryBtnRef}
                onClick={confirmDelete}
                disabled={deleting}
              >{deleting ? 'Deleting…' : (bulkIds && bulkIds.length > 0 ? 'Delete selected' : 'Delete')}</button>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-preview-title"
          onClick={(e) => { if (e.target === e.currentTarget) { closePreview(); } }}
          onKeyDown={(e) => handlePreviewKeyDown(e)}
          tabIndex={-1}
        >
          <div ref={previewModalRef} className="max-w-[90vw] max-h-[90vh] flex flex-col items-stretch">
            <div className="flex items-center justify-between mb-2">
              <h3 id="image-preview-title" className="text-white text-sm font-medium truncate max-w-[70vw]">{previewName}</h3>
              <button ref={closeBtnRef} className="text-white/90 hover:text-white text-sm" onClick={closePreview} aria-label="Close preview">Close</button>
            </div>
            <div className="bg-white rounded shadow overflow-auto p-2">
              <img src={previewUrl} alt={previewName || 'Image preview'} className="max-w-[86vw] max-h-[80vh] object-contain" />
            </div>
            {imagesOnPage.length > 1 && (
              <div className="mt-2 flex items-center justify-between text-white text-sm">
                <button className="underline disabled:opacity-50" onClick={() => navigatePreview(-1)} disabled={previewIndex == null || previewIndex <= 0}>Prev</button>
                <span>{(previewIndex ?? 0) + 1} / {imagesOnPage.length}</span>
                <button className="underline disabled:opacity-50" onClick={() => navigatePreview(1)} disabled={previewIndex == null || previewIndex >= imagesOnPage.length - 1}>Next</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function isImageUpload(it: DesignUpload): boolean {
  const mime = (it.mime || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const name = (it.filename || '').toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].some(ext => name.endsWith(ext));
}

function handleModalKeyDown(
  e: React.KeyboardEvent,
  containerRef: React.RefObject<HTMLElement>,
  onClose?: () => void
) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    e.preventDefault();
    onClose?.();
    return;
  }
  if (e.key !== 'Tab') return;

  const container = containerRef.current;
  if (!container) return;

  const focusableSelectors = [
    'a[href]','button:not([disabled])','textarea','input','select','[tabindex]:not([tabindex="-1"])'
  ].join(',');
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
    .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1);
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const current = document.activeElement as HTMLElement | null;

  if (e.shiftKey) {
    if (!current || current === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (!current || current === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
