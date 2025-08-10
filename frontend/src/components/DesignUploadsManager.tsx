'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { deleteDesignUpload, listDesignUploads, DesignUpload } from '@/services/designUploadsService';
import { getSignedUrl } from '@/services/aiEnhancementService';
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
  const [bulkIds, setBulkIds] = useState<string[] | null>(null);
  const previewModalRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const confirmModalRef = useRef<HTMLDivElement | null>(null);
  const confirmPrimaryBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmCloseBtnRef = useRef<HTMLButtonElement | null>(null);

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
            const storageUrl = it.storageUrl as string;
            const key = storageUrl.split('/').pop() as string; // basename
            if (!key) return [it.id, ''] as const;
            const sig = await getSignedUrl(key, 5 * 60 * 1000);
            const urlPath = sig?.data?.url || '';
            const abs = urlPath.startsWith('http') ? urlPath : `${API_BASE_URL}${urlPath}`;
            return [it.id, abs] as const;
          } catch {
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
      <td className="px-3 py-2 text-xs text-gray-500">{it.createdAt ? new Date(it.createdAt).toLocaleString() : '-'}</td>
      <td className="px-3 py-2 text-sm flex gap-2">
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

      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full" aria-describedby="uploads-caption">
          <caption id="uploads-caption" className="sr-only">List of design uploads with actions</caption>
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                <input
                  type="checkbox"
                  aria-label="Select all on page"
                  checked={sortedItems.length > 0 && sortedItems.every(it => selected[it.id])}
                  onChange={(e) => {
                    const next: Record<string, boolean> = { ...selected };
                    sortedItems.forEach(it => { next[it.id] = e.target.checked; });
                    setSelected(next);
                  }}
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                <button className="flex items-center gap-1 hover:underline" onClick={() => toggleSort('filename')} aria-label="Sort by filename">
                  Filename {sortKey === 'filename' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">MIME</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                <button className="flex items-center gap-1 hover:underline" onClick={() => toggleSort('size')} aria-label="Sort by size">
                  Size {sortKey === 'size' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Checksum</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                <button className="flex items-center gap-1 hover:underline" onClick={() => toggleSort('createdAt')} aria-label="Sort by created">
                  Created {sortKey === 'createdAt' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
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
                  </tr>
                ))}
              </>
            ) : rows.length ? rows : (
              <tr><td className="px-3 py-6 text-sm text-gray-600 text-center" colSpan={6}>
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
