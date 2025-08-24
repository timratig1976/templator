"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { socketClient } from "@/services/socketClient";
import { useRouter } from "next/navigation";

// Logs page (Maintenance)
// Table and filters adapted to route to /maintenance/ai/[process]/editor for details

type RunRow = {
  id: string;
  version: string;
  inputs: Array<{ key: string; value?: string }>;
  messageRole: "User" | "Assistant" | "System" | "Tool";
  message: string;
  outputRole: "Assistant" | "Tool" | "System" | "User";
  output: string;
  rating?: string;
  correction?: string;
  env?: string;
  raw?: any;
};

const mockData: RunRow[] = [
  {
    id: "m7Lcq",
    version: "# v20",
    inputs: [{ key: "Produkt", value: "Sonnenbrillen" }],
    messageRole: "User",
    message: "Bitte machen für So...",
    outputRole: "Assistant",
    output: "Produkt-Summary: Die Sonnenbrillen sind hochwertige,...",
    rating: "None",
    correction: "None",
    env: "None",
  },
  {
    id: "e2BV0",
    version: "# v18",
    inputs: [
      { key: "Produkt", value: "Managed SD-..." },
      { key: "Persona", value: "Demografische Daten: - Name d..." },
    ],
    messageRole: "User",
    message: "Bitte...",
    outputRole: "Assistant",
    output: "Kundenprofil (Customer Profile): Hauptjobs: 1...",
    rating: "None",
    correction: "None",
    env: "None",
  },
];

export default function LogsPage({ params }: { params: { process: string } }) {
  const router = useRouter();
  const [rows, setRows] = useState<RunRow[]>(mockData);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [inputsFilter, setInputsFilter] = useState<string>("Inputs");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState<number>(mockData.length);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [inputKeyFilter, setInputKeyFilter] = useState('');
  const [newItems, setNewItems] = useState(0);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const limit = pageSize;
      const res = await fetch(`/api/admin/ai-prompts/processes/${encodeURIComponent(params.process)}/runs?limit=${encodeURIComponent(String(limit))}`, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      if (Array.isArray(json?.data)) {
        const mapped: (RunRow & { __status?: string })[] = json.data.map((it: any) => {
          const versionLabel = (it?.prompt?.version != null) ? `# v${it.prompt.version}` : (it?.prompt?.title || '-');
          const inputsArr: Array<{ key: string; value?: string }> = (() => {
            const meta = it?.input?.inputMeta || {};
            try {
              return Object.entries(meta).map(([k, v]) => ({ key: String(k), value: String(v) }));
            } catch {
              return [];
            }
          })();
          const messageSnippet = (() => {
            if (it?.input?.promptPartsPresent) return 'Prompt parts present';
            if (it?.input?.promptMode) return `mode:${it.input.promptMode}`;
            return '';
          })();
          const outputSnippet = (() => {
            const out = it?.output;
            if (!out) return '';
            const raw = typeof out?._raw === 'string' ? out._raw : JSON.stringify(out);
            return raw?.slice(0, 140) || '';
          })();
          return {
            id: it.id,
            version: versionLabel,
            inputs: inputsArr,
            messageRole: 'User',
            message: messageSnippet,
            outputRole: 'Assistant',
            output: outputSnippet,
            rating: 'None',
            correction: 'None',
            env: 'None',
            raw: it,
            __status: it?.status || 'success',
          } as RunRow & { __status?: string };
        });
        const filteredBySearch = (() => {
          if (!search) return mapped;
          const q = search.toLowerCase();
          return mapped.filter((r) =>
            [r.id, r.version, r.message, r.output]
              .concat(r.inputs.map((i) => `${i.key}:${i.value ?? ''}`))
              .some((t) => t.toLowerCase().includes(q))
          );
        })();
        const filteredByStatus = filteredBySearch.filter(r => statusFilter === 'all' ? true : (r as any).__status === statusFilter);
        const filteredByInputKey = inputKeyFilter
          ? filteredByStatus.filter(r => r.inputs.some(i => i.key.toLowerCase().includes(inputKeyFilter.toLowerCase())))
          : filteredByStatus;
        const start = (page - 1) * pageSize;
        const windowed = filteredByInputKey.slice(start, start + pageSize);
        setRows(windowed);
        setTotal(filteredByInputKey.length);
      } else {
        setRows(mockData);
        setTotal(mockData.length);
      }
    } catch (e: any) {
      setError('Using mock data (backend runs endpoint not available yet)');
      setRows(mockData);
      setTotal(mockData.length);
    } finally {
      setLoading(false);
    }
  }, [params.process, page, pageSize, search]);

  useEffect(() => { fetchRuns(); }, [fetchRuns, page, pageSize, search, inputsFilter, params.process, statusFilter, inputKeyFilter]);

  useEffect(() => {
    const onAnyLog = () => { setNewItems((c) => (c < 999 ? c + 1 : c)); };
    socketClient.on('log', onAnyLog);
    socketClient.on('openai_log', onAnyLog);
    return () => {
      socketClient.off('log', onAnyLog);
      socketClient.off('openai_log', onAnyLog);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      [r.id, r.version, r.message, r.output]
        .concat(r.inputs.map((i) => `${i.key}:${i.value ?? ""}`))
        .some((t) => t.toLowerCase().includes(q))
    );
  }, [rows, search]);

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    filtered.forEach((r) => (next[r.id] = checked));
    setSelected(next);
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: checked }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {/* Duplicate headline removed; layout-level headline is used */}
        <div className="flex items-center gap-2">
          <button className="px-2.5 py-1.5 border rounded-md text-sm">Actions</button>
          <button className="px-2.5 py-1.5 border rounded-md text-sm">View Sessions</button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="px-2.5 py-1.5 border rounded-md text-sm">+ Filter</button>
        <select
          value={statusFilter}
          onChange={(e) => { setPage(1); setStatusFilter(e.target.value as any); }}
          className="px-2.5 py-1.5 border rounded-md text-sm"
          aria-label="Status"
        >
          <option value="all">All</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
        <input
          value={inputKeyFilter}
          onChange={(e) => { setPage(1); setInputKeyFilter(e.target.value); }}
          placeholder="Filter by input key..."
          className="px-2.5 py-1.5 border rounded-md text-sm w-56"
        />
        <div className="ml-auto flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="px-2.5 py-1.5 border rounded-md text-sm w-64"
          />
          <select
            value={inputsFilter}
            onChange={(e) => setInputsFilter(e.target.value)}
            className="px-2.5 py-1.5 border rounded-md text-sm"
          >
            <option>Inputs</option>
            <option>Messages</option>
            <option>Output</option>
          </select>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="p-3 text-left w-8">
                <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} aria-label="Select all" />
              </th>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Version</th>
              <th className="p-3 text-left">Inputs</th>
              <th className="p-3 text-left">Messages</th>
              <th className="p-3 text-left">Output</th>
              <th className="p-3 text-left">Rating</th>
              <th className="p-3 text-left">Correction</th>
              <th className="p-3 text-left">Env</th>
              <th className="p-3 text-right w-8"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3 text-gray-500 text-sm" colSpan={10}>Loading…</td>
              </tr>
            )}
            {!loading && filtered.map((r) => (
              <tr
                key={r.id}
                className="border-t hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/maintenance/ai/${params.process}/editor?runId=${encodeURIComponent(r.id)}`)}
              >
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={!!selected[r.id]}
                    onChange={(e) => toggleOne(r.id, e.target.checked)}
                    aria-label={`Select ${r.id}`}
                  />
                </td>
                <td className="p-3">
                  <span className="text-blue-600 hover:underline">{r.id}</span>
                </td>
                <td className="p-3">
                  <span className="inline-block px-2 py-0.5 rounded border text-xs text-gray-700 bg-white">{r.version}</span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {r.inputs.slice(0, 2).map((i) => (
                      <span key={i.key} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
                        {i.key}
                      </span>
                    ))}
                    {r.inputs.length > 2 && (
                      <span className="text-xs text-gray-500">+{r.inputs.length - 2} input</span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-gray-500">{r.messageRole}</span>
                    <span className="truncate max-w-[260px] inline-block align-middle text-gray-800">{r.message}</span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-gray-500">{r.outputRole}</span>
                    <span className="truncate max-w-[260px] inline-block align-middle text-gray-800">{r.output}</span>
                  </div>
                </td>
                <td className="p-3 text-gray-500">{r.rating ?? "None"}</td>
                <td className="p-3 text-gray-500">{r.correction ?? "None"}</td>
                <td className="p-3 text-gray-500">{r.env ?? "None"}</td>
                <td className="p-3 text-right">
                  <button
                    className="px-2 py-1 border rounded-md text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/maintenance/ai/${params.process}/editor?runId=${encodeURIComponent(r.id)}`);
                    }}
                  >
                    ⋯
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => { setNewItems(0); fetchRuns(); }}>
          <span>⟳</span>
          <span>Refresh</span>
          <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1 text-white bg-gray-500 rounded-full">
            {newItems}
          </span>
        </div>
        <div>
          <span>{(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}</span>
          <span className="mx-2">|</span>
          <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
          <button className="ml-2 px-2 py-1 border rounded" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
          <button className="ml-2 px-2 py-1 border rounded" onClick={() => setPage((p) => (p * pageSize < total ? p + 1 : p))} disabled={page * pageSize >= total}>Next</button>
          <select className="ml-2 px-2 py-1 border rounded" value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Details drawer removed — detail view is the Editor page */}
    </div>
  );
}
