"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPromptDetail } from "@/services/promptMonitoringService";

export default function PromptDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await getPromptDetail(id);
        setData(res.item);
        setError(null);
      } catch (e: any) {
        setError("Failed to load prompt detail.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <button className="text-sm text-blue-600 hover:underline mb-3" onClick={() => router.back()}>
        ← Back
      </button>

      {loading ? (
        <div>Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600" role="alert">{error}</div>
      ) : !data ? (
        <div>Not found.</div>
      ) : (
        <div className="space-y-4">
          <div>
            <h1 className="text-lg font-semibold mb-1">Prompt Detail</h1>
            <div className="text-sm text-gray-600">ID: {data.id}</div>
            <div className="text-sm text-gray-600">DesignSplit: {data.pipelineId}</div>
            <div className="text-sm text-gray-600">Section: {data.sectionId || '-'}</div>
          </div>
          
          {/* Related artifacts incl. RAG info */}
          {Array.isArray(data.relatedArtifacts) && (
            <div>
              <h2 className="text-sm font-medium mb-2">Related Generated Artifacts</h2>
              <div className="border rounded overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">Created</th>
                      <th className="text-left px-3 py-2">Label</th>
                      <th className="text-left px-3 py-2">Selected</th>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-left px-3 py-2">RAG</th>
                      <th className="text-left px-3 py-2">Enhanced Prompt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.relatedArtifacts.length === 0 ? (
                      <tr><td className="px-3 py-3" colSpan={6}>No related artifacts found.</td></tr>
                    ) : (
                      data.relatedArtifacts.map((a: any) => (
                        <tr key={a.id} className="border-t">
                          <td className="px-3 py-2">{new Date(a.createdAt).toLocaleString()}</td>
                          <td className="px-3 py-2">{a.label || '-'}</td>
                          <td className="px-3 py-2">{a.selected ? 'Yes' : 'No'}</td>
                          <td className="px-3 py-2">{a.type}</td>
                          <td className="px-3 py-2">
                            {a.ragUsed ? (
                              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">RAG</span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2">
                            {a.enhancedPrompt ? (
                              <details>
                                <summary className="cursor-pointer text-gray-700">View</summary>
                                <pre className="mt-1 p-2 bg-gray-50 rounded text-[11px] whitespace-pre-wrap overflow-auto">{a.enhancedPrompt}</pre>
                              </details>
                            ) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div>
            <h2 className="text-sm font-medium">Prompt</h2>
            <pre className="p-2 bg-gray-50 rounded text-xs whitespace-pre-wrap overflow-auto">{data.prompt}</pre>
          </div>
          {data.context && (
            <div>
              <h2 className="text-sm font-medium">Context</h2>
              <pre className="p-2 bg-gray-50 rounded text-xs whitespace-pre-wrap overflow-auto">{JSON.stringify(data.context, null, 2)}</pre>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="border rounded p-2">
              <div className="text-gray-600">Usage</div>
              <div className="text-lg font-semibold">{data.usageCount}</div>
            </div>
            <div className="border rounded p-2">
              <div className="text-gray-600">Avg Quality</div>
              <div className="text-lg font-semibold">{data.avgQuality == null ? '-' : data.avgQuality.toFixed(2)}</div>
            </div>
            <div className="border rounded p-2">
              <div className="text-gray-600">Last Used</div>
              <div className="text-lg font-semibold">{new Date(data.lastUsed).toLocaleString()}</div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium mb-2">Recent Results</h2>
            <div className="border rounded overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2">Created</th>
                    <th className="text-left px-3 py-2">Quality</th>
                    <th className="text-left px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.results || []).length === 0 ? (
                    <tr><td className="px-3 py-3" colSpan={3}>No results yet.</td></tr>
                  ) : (
                    data.results.map((r: any) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2">{r.qualityScore == null ? '-' : r.qualityScore.toFixed(2)}</td>
                        <td className="px-3 py-2 max-w-[640px] truncate" title={r.result}>{r.result}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
