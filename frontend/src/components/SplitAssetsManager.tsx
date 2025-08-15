"use client";

import React, { useEffect, useMemo, useState } from "react";
import { listSplitAssets, getSignedUrl, deleteSplitAsset } from "@/services/aiEnhancementService";

type AssetItem = {
  key?: string;
  meta?: { key?: string; [k: string]: any };
  kind?: string;
  size?: number;
  createdAt?: string;
};

interface SplitAssetsManagerProps {
  initialSplitId?: string;
  defaultKind?: string; // e.g., 'image-crop'
}

export default function SplitAssetsManager({ initialSplitId, defaultKind = "image-crop" }: SplitAssetsManagerProps) {
  const [splitId, setSplitId] = useState(initialSplitId || "");
  const [kind, setKind] = useState(defaultKind);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const canLoad = useMemo(() => splitId.trim().length > 0, [splitId]);

  const extractKey = (a: AssetItem) => a.meta?.key || a.key || "";

  const loadAssets = async () => {
    if (!canLoad) return;
    setLoading(true);
    setError(null);
    setAssets([]);
    setThumbs({});
    try {
      const res = await listSplitAssets(splitId.trim(), kind);
      const list = res?.data?.assets || [];
      setAssets(list);
      // Preload signed URLs for thumbnails
      const pairs: Array<[string, string]> = [];
      for (const a of list) {
        const key = extractKey(a);
        if (!key) continue;
        try {
          const signed = await getSignedUrl(key, 5 * 60 * 1000);
          if (signed?.data?.url) pairs.push([key, signed.data.url]);
        } catch {}
      }
      if (pairs.length) {
        setThumbs(Object.fromEntries(pairs));
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!splitId) return;
    
    setConfirmDialog({
      show: true,
      title: "Delete Item",
      message: "Delete this item? This cannot be undone.",
      onConfirm: async () => {
        setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => {} });
        try {
          await deleteSplitAsset(splitId, key);
          setAssets((cur) => cur.filter((a) => extractKey(a) !== key));
          setThumbs((cur) => {
            const n = { ...cur };
            delete n[key];
            return n;
          });
        } catch (e: any) {
          setError(e?.message || "Failed to delete");
        }
      }
    });
  };

  const handleDeleteAll = async () => {
    if (!splitId || assets.length === 0) return;
    
    setConfirmDialog({
      show: true,
      title: "Delete All Items",
      message: `Delete ALL ${assets.length} items? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => {} });
        
        setLoading(true);
        let deleted = 0;
        let failed = 0;
        
        for (const asset of assets) {
          const key = extractKey(asset);
          if (!key) continue;
          try {
            await deleteSplitAsset(splitId, key);
            deleted++;
          } catch (e) {
            failed++;
            console.error(`Failed to delete ${key}:`, e);
          }
        }
        
        setLoading(false);
        setError(failed > 0 ? `Deleted ${deleted} items. ${failed} failed.` : `Successfully deleted ${deleted} items.`);
        
        // Reload to refresh the list
        loadAssets();
      }
    });
  };

  const handleOpenModal = async (asset: AssetItem) => {
    const key = extractKey(asset);
    if (!key) return;
    
    // Open modal immediately with loading state
    setSelectedAsset(asset);
    setModalImageUrl(null);
    setModalLoading(true);
    setModalError(null);
    
    try {
      // Get a fresh signed URL for the modal (longer expiry)
      const signed = await getSignedUrl(key, 10 * 60 * 1000); // 10 minutes
      if (signed?.data?.url) {
        setModalImageUrl(signed.data.url);
      } else {
        throw new Error('No signed URL returned');
      }
    } catch (e) {
      console.error('Failed to get signed URL for modal:', e);
      setModalError('Failed to load image for preview');
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedAsset(null);
    setModalImageUrl(null);
    setModalLoading(false);
    setModalError(null);
  };

  useEffect(() => {
    if (initialSplitId) {
      loadAssets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm text-gray-700 mb-1">Split ID</label>
          <input
            value={splitId}
            onChange={(e) => setSplitId(e.target.value)}
            placeholder="Paste splitId (designSplitId)"
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Kind</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="px-3 py-2 border rounded">
            <option value="image-crop">image-crop</option>
            <option value="other">other</option>
          </select>
        </div>
        <button
          onClick={loadAssets}
          disabled={!canLoad || loading}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load"}
        </button>
        {assets.length > 0 && (
          <button
            onClick={handleDeleteAll}
            disabled={loading}
            className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50"
          >
            Delete All ({assets.length})
          </button>
        )}
      </div>

      {error && <div className="p-2 rounded border border-red-200 bg-red-50 text-red-700">{error}</div>}

      <div className="bg-white border rounded">
        {assets.length === 0 ? (
          <div className="p-4 text-gray-600">No items.</div>
        ) : (
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {assets.map((a) => {
              const key = extractKey(a);
              const url = thumbs[key];
              return (
                <div key={key} className="border rounded p-2 bg-white">
                  <div className="text-xs text-gray-600 break-all mb-2">{key || "(no key)"}</div>
                  
                  {/* Timestamp */}
                  {a.createdAt && (
                    <div className="text-xs text-blue-600 mb-1">
                      <strong>Created:</strong> {new Date(a.createdAt).toLocaleString()}
                    </div>
                  )}
                  
                  {/* Boundaries */}
                  {a.meta?.bounds && (
                    <div className="text-xs text-green-600 mb-2">
                      <strong>Bounds:</strong> x:{a.meta.bounds.x?.toFixed(1)}%, y:{a.meta.bounds.y?.toFixed(1)}%, w:{a.meta.bounds.width?.toFixed(1)}%, h:{a.meta.bounds.height?.toFixed(1)}%
                    </div>
                  )}
                  
                  {/* Section ID */}
                  {a.meta?.sectionId && (
                    <div className="text-xs text-purple-600 mb-1">
                      <strong>Section ID:</strong> {a.meta.sectionId}
                    </div>
                  )}
                  
                  {/* Section Name */}
                  {a.meta?.sectionName && (
                    <div className="text-xs text-indigo-600 mb-1">
                      <strong>Section Name:</strong> {a.meta.sectionName}
                    </div>
                  )}
                  
                  {/* Section Type */}
                  {a.meta?.sectionType && (
                    <div className="text-xs text-orange-600 mb-2">
                      <strong>Section Type:</strong> {a.meta.sectionType}
                    </div>
                  )}
                  
                  {url && (
                    <div className="mt-2">
                      <img src={url} alt={key} className="w-full h-40 object-contain bg-gray-50 border rounded" />
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>{a.kind || kind}</span>
                    {a.size != null && <span>{Math.round(a.size / 1024)} KB</span>}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => handleOpenModal(a)} className="px-2 py-1 text-xs rounded border bg-blue-600 text-white hover:bg-blue-700">Open</button>
                    <button onClick={() => key && handleDelete(key)} className="px-2 py-1 text-xs rounded bg-red-600 text-white">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Popup for Large Image View */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={closeModal}>
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Split Part Details</h3>
                <button onClick={closeModal} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
              </div>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Image */}
                <div className="space-y-4">
                  {modalLoading && (
                    <div className="w-full max-w-lg mx-auto h-64 border rounded shadow-lg bg-gray-50 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-gray-600">Loading image...</p>
                      </div>
                    </div>
                  )}
                  
                  {modalError && (
                    <div className="w-full max-w-lg mx-auto h-64 border rounded shadow-lg bg-red-50 flex items-center justify-center">
                      <div className="text-center text-red-600">
                        <p className="font-semibold">Failed to load image</p>
                        <p className="text-sm mt-1">{modalError}</p>
                      </div>
                    </div>
                  )}
                  
                  {modalImageUrl && !modalLoading && !modalError && (
                    <>
                      <img 
                        src={modalImageUrl} 
                        alt={extractKey(selectedAsset)} 
                        className="w-full max-w-lg mx-auto border rounded shadow-lg bg-white"
                        style={{ maxHeight: '60vh', objectFit: 'contain' }}
                      />
                      <div className="text-center">
                        <a 
                          href={modalImageUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Open in New Tab
                        </a>
                      </div>
                    </>
                  )}
                </div>

                {/* Metadata */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Asset Information</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Key:</strong> <span className="font-mono text-xs break-all">{extractKey(selectedAsset)}</span></div>
                      <div><strong>Kind:</strong> {selectedAsset.kind || kind}</div>
                      {selectedAsset.size && <div><strong>Size:</strong> {Math.round(selectedAsset.size / 1024)} KB</div>}
                      {selectedAsset.createdAt && (
                        <div><strong>Created:</strong> {new Date(selectedAsset.createdAt).toLocaleString()}</div>
                      )}
                    </div>
                  </div>

                  {/* Section Information */}
                  {(selectedAsset.meta?.sectionId || selectedAsset.meta?.sectionName || selectedAsset.meta?.sectionType) && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Section Information</h4>
                      <div className="space-y-2 text-sm">
                        {selectedAsset.meta?.sectionId && (
                          <div><strong>Section ID:</strong> <span className="text-purple-600">{selectedAsset.meta.sectionId}</span></div>
                        )}
                        {selectedAsset.meta?.sectionName && (
                          <div><strong>Section Name:</strong> <span className="text-indigo-600">{selectedAsset.meta.sectionName}</span></div>
                        )}
                        {selectedAsset.meta?.sectionType && (
                          <div><strong>Section Type:</strong> <span className="text-orange-600">{selectedAsset.meta.sectionType}</span></div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Boundaries */}
                  {selectedAsset.meta?.bounds && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Crop Boundaries</h4>
                      <div className="space-y-2 text-sm">
                        <div><strong>X Position:</strong> <span className="text-green-600">{selectedAsset.meta.bounds.x?.toFixed(1)}%</span></div>
                        <div><strong>Y Position:</strong> <span className="text-green-600">{selectedAsset.meta.bounds.y?.toFixed(1)}%</span></div>
                        <div><strong>Width:</strong> <span className="text-green-600">{selectedAsset.meta.bounds.width?.toFixed(1)}%</span></div>
                        <div><strong>Height:</strong> <span className="text-green-600">{selectedAsset.meta.bounds.height?.toFixed(1)}%</span></div>
                      </div>
                    </div>
                  )}

                  {/* Original Dimensions */}
                  {selectedAsset.meta?.originalDimensions && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Original Image</h4>
                      <div className="space-y-2 text-sm">
                        <div><strong>Width:</strong> {selectedAsset.meta.originalDimensions.width}px</div>
                        <div><strong>Height:</strong> {selectedAsset.meta.originalDimensions.height}px</div>
                      </div>
                    </div>
                  )}

                  {/* Crop Dimensions */}
                  {(selectedAsset.meta?.width || selectedAsset.meta?.height) && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Crop Dimensions</h4>
                      <div className="space-y-2 text-sm">
                        {selectedAsset.meta?.width && <div><strong>Width:</strong> {selectedAsset.meta.width}px</div>}
                        {selectedAsset.meta?.height && <div><strong>Height:</strong> {selectedAsset.meta.height}px</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{confirmDialog.title}</h3>
            <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => {} })}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
