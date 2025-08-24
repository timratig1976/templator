"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getPromptsSummary, PromptSummaryItem } from "@/services/promptMonitoringService";

export default function MaintenanceAIOptimizationPrompts() {
  const [items, setItems] = useState<PromptSummaryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);
  const [ragOnly, setRagOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await getPromptsSummary({ search, offset, limit, ragOnly });
      setItems(res.items || []);
      setTotal(res.total || 0);
      setError(null);
    } catch (e: any) {
      setError("Failed to load prompts summary.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, limit, ragOnly]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      {/* Duplicate headline removed; layout-level headline is used */}

      <div className="flex items-center gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prompts, sectionId, designSplitId"
          className="border rounded px-2 py-1 text-sm w-80"
        />
        <button
          onClick={() => { setOffset(0); load(); }}
          className="px-3 py-1 text-sm border rounded"
        >Search</button>
        <label className="flex items-center gap-2 text-sm ml-2">
          <input type="checkbox" checked={ragOnly} onChange={(e) => { setOffset(0); setRagOnly(e.target.checked); }} />
          <span>RAG only</span>
        </label>
      </div>

      {error && <div className="text-sm text-red-600 mb-2" role="alert">{error}</div>}

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Prompts summary</caption>
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2">Prompt</th>
              <th className="text-left px-3 py-2">DesignSplit</th>
              <th className="text-left px-3 py-2">Section</th>
              <th className="text-left px-3 py-2">Usage</th>
              <th className="text-left px-3 py-2">Avg Quality</th>
              <th className="text-left px-3 py-2">RAG Usage</th>
              <th className="text-left px-3 py-2">Last RAG</th>
              <th className="text-left px-3 py-2">Last Used</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3" colSpan={7}>Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="px-3 py-3" colSpan={7}>No prompts found.</td></tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2 max-w-[420px] truncate" title={it.prompt}>{it.prompt}</td>
                  <td className="px-3 py-2">{it.pipelineId}</td>
                  <td className="px-3 py-2">{it.sectionId || "-"}</td>
                  <td className="px-3 py-2">{it.usageCount}</td>
                  <td className="px-3 py-2">{it.avgQuality == null ? "-" : it.avgQuality.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {(it.ragUsageCount ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">RAG</span>
                        <span className="text-xs text-gray-700">x{it.ragUsageCount}</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2">{it.lastRagUsedAt ? new Date(it.lastRagUsedAt).toLocaleString() : '-'}</td>
                  <td className="px-3 py-2">{new Date(it.lastUsed).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <Link href={`/maintenance/ai/optimization/prompts/${encodeURIComponent(it.id)}`} className="text-blue-600 hover:underline">View</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-sm">
        <div>Total: {total}</div>
        <div className="flex items-center gap-2">
          <button disabled={offset<=0} className="px-3 py-1 border rounded disabled:opacity-50" onClick={() => setOffset(Math.max(0, offset - limit))}>Prev</button>
          <button disabled={offset + limit >= total} className="px-3 py-1 border rounded disabled:opacity-50" onClick={() => setOffset(offset + limit)}>Next</button>
          <select value={limit} onChange={(e) => { setOffset(0); setLimit(parseInt(e.target.value, 10)); }} className="border rounded px-2 py-1">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </main>
  );
}
