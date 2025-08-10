"use client";

import React, { useEffect, useState } from "react";
import { listRecentSplits, getSplitSummary } from "@/services/aiEnhancementService";

export type LoadedSplitSummary = {
  designSplitId: string;
  imageUrl?: string | null;
  sections: any[]; // matches SectionInput[] shape expected by SplitGenerationPlanner
};

export default function LoadPreviousSplit({
  onCancel,
  onLoaded,
}: {
  onCancel: () => void;
  onLoaded: (data: LoadedSplitSummary) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [manualId, setManualId] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await listRecentSplits(20);
        if (mounted) setItems(res?.data?.items || []);
      } catch (e: any) {
        if (mounted) setError("Failed to load recent splits.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function handlePick(id: string) {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getSplitSummary(id);
      const data = res?.data;
      if (!data) throw new Error("No data");
      onLoaded({ designSplitId: data.designSplitId, imageUrl: data.imageUrl, sections: data.sections });
    } catch (e: any) {
      setError("Failed to load split summary. Check ID and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Load previous layout</h2>
        <button className="text-sm text-gray-600 hover:text-gray-900" onClick={onCancel}>Close</button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="space-y-2">
        <label className="text-sm font-medium">Paste designSplitId</label>
        <div className="flex gap-2">
          <input
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="designSplitId"
            className="border rounded px-2 py-1 w-full"
          />
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
            onClick={() => handlePick(manualId.trim())}
            disabled={loading || !manualId.trim()}
          >
            Load
          </button>
        </div>
      </div>

      <div className="pt-2">
        <div className="text-sm font-medium mb-2">Recent splits</div>
        <div className="border rounded divide-y">
          {loading && items.length === 0 && (
            <div className="p-3 text-sm text-gray-500">Loading…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="p-3 text-sm text-gray-500">No recent splits</div>
          )}
          {items.map((it) => (
            <button
              key={it.designSplitId}
              className="w-full text-left p-3 hover:bg-gray-50 flex items-center justify-between"
              onClick={() => handlePick(String(it.designSplitId))}
            >
              <div>
                <div className="text-sm font-medium">{it.name || it.designSplitId}</div>
                <div className="text-xs text-gray-500">{it.sectionCount ?? 0} sections · {new Date(it.createdAt).toLocaleString()}</div>
              </div>
              <div className="text-xs text-blue-600">Open</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
