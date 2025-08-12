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
    const ok = window.confirm("Delete this item? This cannot be undone.");
    if (!ok) return;
    try {
      await deleteSplitAsset(splitId, key);
      setAssets((cur) => cur.filter((a) => extractKey(a) !== key));
      setThumbs((cur) => {
        const n = { ...cur };
        delete n[key];
        return n;
      });
    } catch (e: any) {
      alert(e?.message || "Failed to delete");
    }
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
                  <div className="text-xs text-gray-600 break-all">{key || "(no key)"}</div>
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
                    <a href={url} target="_blank" rel="noreferrer" className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50">Open</a>
                    <button onClick={() => key && handleDelete(key)} className="px-2 py-1 text-xs rounded bg-red-600 text-white">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
