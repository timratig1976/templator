"use client";

import React, { useEffect, useMemo, useState } from "react";
import { aiLogger, AILogEntry } from "@/services/aiLogger";
import Link from "next/link";

type ServerAILog = {
  id: string;
  timestamp: string;
  process?: string | null;
  step?: string | null;
  ir?: any;
  prompt?: string | null;
  input?: any;
  output?: any;
  flag?: string | null;
  rag?: { used?: boolean; sources?: Array<{ id: string; title?: string; score?: number }>; [k: string]: any } | null;
  initiator?: string | null; // user/system/service
  quality?: { score?: number | null; metrics?: Record<string, any> } | null;
  meta?: Record<string, any> | null;
};

async function tryFetchServerLogs(signal?: AbortSignal): Promise<ServerAILog[] | null> {
  try {
    const res = await fetch("/api/monitoring/ai-logs?limit=200", { signal });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.success && Array.isArray(json.items)) return json.items as ServerAILog[];
    return null;
  } catch {
    return null;
  }
}

function fromClientLog(entry: AILogEntry): ServerAILog {
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    step: entry.message,
    ir: entry.details?.ir ?? undefined,
    prompt: entry.details?.prompt ?? entry.metadata?.prompt ?? undefined,
    input: entry.details?.input ?? entry.metadata?.input,
    output: entry.details?.output ?? entry.metadata?.output,
    flag: entry.metadata?.flag ?? undefined,
    rag: entry.metadata?.rag ?? undefined,
    initiator: entry.metadata?.initiator ?? undefined,
    quality: entry.metadata?.quality ? { score: entry.metadata?.quality, metrics: entry.metadata?.metrics } : { metrics: entry.metadata?.metrics },
    meta: { level: entry.level, category: entry.category, requestId: entry.requestId, duration: entry.duration, ...entry.metadata },
  };
}

function classNames(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export default function ComprehensiveAILogs({ process }: { process?: string }) {
  const [rows, setRows] = useState<ServerAILog[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [category, setCategory] = useState("all");
  const [hasRag, setHasRag] = useState("all"); // all|yes|no
  const [hasError, setHasError] = useState("all"); // all|yes
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selected, setSelected] = useState<ServerAILog | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [serverMode, setServerMode] = useState(false);
  // Column customization state
  type ColumnKey = 'time'|'process'|'id'|'step'|'ir'|'prompt'|'input'|'output'|'flag'|'rag'|'initiator'|'quality'|'level'|'category'|'requestId'|'duration'|'model'|'tokens'|'cost';
  type ColumnDef = { key: ColumnKey; label: string };
  const allColumns: ColumnDef[] = [
    { key: 'time', label: 'Time' },
    { key: 'process', label: 'Process' },
    { key: 'id', label: 'ID' },
    { key: 'step', label: 'Step' },
    { key: 'ir', label: 'IR' },
    { key: 'prompt', label: 'Prompt' },
    { key: 'input', label: 'Input' },
    { key: 'output', label: 'Output' },
    { key: 'flag', label: 'Flag' },
    { key: 'rag', label: 'RAG' },
    { key: 'initiator', label: 'Initiator' },
    { key: 'quality', label: 'Quality' },
    { key: 'level', label: 'Level' },
    { key: 'category', label: 'Category' },
    { key: 'requestId', label: 'Request ID' },
    { key: 'duration', label: 'Duration' },
    { key: 'model', label: 'Model' },
    { key: 'tokens', label: 'Tokens' },
    { key: 'cost', label: 'Cost' },
  ];
  type ViewState = { name: string; order: ColumnKey[]; hidden: ColumnKey[] };
  const defaultOrder: ColumnKey[] = allColumns.map(c => c.key);
  const storageKey = 'comprehensive_ai_logs_view';
  const storageViewsKey = 'comprehensive_ai_logs_views';
  const [order, setOrder] = useState<ColumnKey[]>(defaultOrder);
  const [hidden, setHidden] = useState<Set<ColumnKey>>(new Set());
  const [views, setViews] = useState<ViewState[]>([]);
  const [activeView, setActiveView] = useState<string>('Default');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const visibleColumns = useMemo(() => order.filter(k => !hidden.has(k)), [order, hidden]);

  // Try to extract a prompt identifier from a server/client log entry
  function getPromptIdFromLog(r: any): string | undefined {
    return (
      r?.meta?.promptId ||
      r?.meta?.aIPromptId ||
      r?.promptId ||
      r?.meta?.prompt?.id ||
      undefined
    );
  }
  // Normalize process aliases to canonical route names
  function normalizeProcessName(p?: string | null): string | undefined {
    if (!p) return undefined;
    const raw = String(p).trim();
    const map: Record<string, string> = {
      'detect-sections': 'split-detection',
      'section-detection': 'split-detection',
      'sections-detection': 'split-detection',
      'split-detection': 'split-detection',
      'html': 'html-generation',
      'html-generation': 'html-generation',
      'content-enhancement': 'content-enhancement',
      'enhancement': 'content-enhancement',
      'quality-analysis': 'quality-analysis',
      'qa': 'quality-analysis',
      'image-analysis': 'image-analysis',
    };
    return map[raw] || raw;
  }
  // Determine process to route to the modeling editor
  function getProcessForRoute(r?: any): string {
    return (
      normalizeProcessName(process) ||
      normalizeProcessName(r?.process) ||
      normalizeProcessName(r?.meta?.process) ||
      'content-enhancement'
    );
  }
  // Build deep-link href to modeling editor with query params when available
  function buildEditorHref(r?: any): string {
    const proc = getProcessForRoute(r);
    const qs = new URLSearchParams();
    const promptId = r ? getPromptIdFromLog(r) : undefined;
    const runId = r?.meta?.requestId || r?.meta?.runId || undefined;
    const stepId = r?.meta?.stepId || r?.meta?.step?.id || undefined;
    if (stepId) qs.set('stepId', String(stepId));
    if (runId) qs.set('runId', String(runId));
    const query = qs.toString();
    if (promptId) {
      return `/maintenance/ai/optimization/${proc}/editor/${encodeURIComponent(String(promptId))}${query ? `?${query}` : ''}`;
    }
    return `/maintenance/ai/optimization/${proc}/editor${query ? `?${query}` : ''}`;
  }
  // Load saved default on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ViewState;
        if (Array.isArray(parsed.order)) setOrder(parsed.order as ColumnKey[]);
        if (Array.isArray(parsed.hidden)) setHidden(new Set(parsed.hidden as ColumnKey[]));
        if (parsed.name) setActiveView(parsed.name);
      }
      const savedViews = localStorage.getItem(storageViewsKey);
      if (savedViews) {
        const list = JSON.parse(savedViews) as ViewState[];
        setViews(list);
      }
    } catch {}
  }, []);
  function persistCurrent(name = activeView) {
    const payload: ViewState = { name, order, hidden: Array.from(hidden) };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }
  function saveViewPrompt() {
    const name = prompt('Save view as:', activeView === 'Default' ? '' : activeView) || '';
    const trimmed = name.trim();
    if (!trimmed) return;
    const payload: ViewState = { name: trimmed, order, hidden: Array.from(hidden) };
    const next = views.filter(v => v.name !== trimmed).concat(payload);
    setViews(next);
    setActiveView(trimmed);
    localStorage.setItem(storageViewsKey, JSON.stringify(next));
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }
  function loadView(name: string) {
    if (name === 'Default') {
      setOrder(defaultOrder);
      setHidden(new Set());
      setActiveView('Default');
      persistCurrent('Default');
      return;
    }
    const found = views.find(v => v.name === name);
    if (!found) return;
    setOrder(found.order);
    setHidden(new Set(found.hidden));
    setActiveView(found.name);
    persistCurrent(found.name);
  }
  function deleteView(name: string) {
    const next = views.filter(v => v.name !== name);
    setViews(next);
    localStorage.setItem(storageViewsKey, JSON.stringify(next));
    if (activeView === name) {
      setActiveView('Default');
      setOrder(defaultOrder);
      setHidden(new Set());
      persistCurrent('Default');
    }
  }

  useEffect(() => {
    let abort = new AbortController();
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      // Build server query with filters/pagination
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
      if (process) params.set("process", process);
      if (level !== "all") params.set("level", level);
      if (category !== "all") params.set("category", category);
      if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
      if (dateTo) params.set("to", new Date(dateTo).toISOString());
      if (hasRag !== "all") params.set("rag", hasRag);
      if (hasError !== "all") params.set("error", hasError);
      if (query.trim()) params.set("q", query.trim());

      let server: ServerAILog[] | null = null;
      try {
        const res = await fetch(`/api/monitoring/ai-logs?${params.toString()}`, { signal: abort.signal });
        if (res.ok) {
          const json = await res.json();
          if (json?.success && Array.isArray(json.items)) {
            server = json.items as ServerAILog[];
            setServerTotal(typeof json.total === 'number' ? json.total : null);
            setServerMode(true);
          }
        }
      } catch {
        // ignore and fallback
      }
      if (!mounted) return;
      if (server) {
        setRows(server);
      } else {
        // fallback to client logs
        const client = aiLogger.getLogs().map(fromClientLog);
        setRows(client);
        setServerTotal(null);
        setServerMode(false);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
      abort.abort();
    };
  }, [process, page, pageSize, level, category, hasRag, hasError, dateFrom, dateTo, query]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const term = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesLevel = level === "all" || (r.meta?.level === level);
      const matchesCategory = category === "all" || (r.meta?.category === category || (r as any).category === category);
      const matchesProcess = !process || r.process === process;
      const matchesRag = hasRag === "all" || (hasRag === "yes" ? !!r.rag?.used : !r.rag?.used);
      const matchesError = hasError === "all" || (hasError === "yes" && (r.meta?.level === 'error'));

      // Date range (assumes ISO timestamps)
      const ts = new Date(r.timestamp).getTime();
      const fromOk = !dateFrom || ts >= new Date(dateFrom).getTime();
      const toOk = !dateTo || ts <= new Date(dateTo).getTime();

      if (!(matchesLevel && matchesCategory && matchesProcess && matchesRag && matchesError && fromOk && toOk)) return false;
      if (!term) return true;
      const blob = `${r.id}\n${r.step ?? ""}\n${r.prompt ?? ""}\n${JSON.stringify(r.input ?? {})}\n${JSON.stringify(r.output ?? {})}\n${r.flag ?? ""}\n${JSON.stringify(r.rag ?? {})}\n${r.initiator ?? ""}\n${JSON.stringify(r.quality ?? {})}`.toLowerCase();
      return blob.includes(term);
    });
  }, [rows, query, level, category, hasRag, hasError, dateFrom, dateTo, process]);

  const total = serverMode && serverTotal != null ? serverTotal : filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageData = useMemo(() => {
    if (serverMode) return rows ?? [];
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, serverMode, rows]);

  function exportJSON() {
    const data = filtered;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-logs${process ? `-${process}` : ''}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const columns = [
      'timestamp','process','id','step','prompt','flag','initiator','quality_score','level','category','requestId','duration','model','tokens','cost','rag_used','rag_sources_count'
    ];
    const lines = [columns.join(',')];
    filtered.forEach((r) => {
      const row = [
        new Date(r.timestamp).toISOString(),
        r.process || '',
        r.id,
        r.step || '',
        (r.prompt || '').replace(/\n/g, ' ').replace(/"/g, '""'),
        r.flag || '',
        r.initiator || '',
        r.quality?.score == null ? '' : String(r.quality.score),
        r.meta?.level || '',
        (r.meta as any)?.category || '',
        r.meta?.requestId || '',
        String((r.meta as any)?.duration || (r.meta as any)?.durationMs || ''),
        (r.meta as any)?.model || '',
        String((r.meta as any)?.tokens || (r.meta as any)?.usage?.total_tokens || ''),
        String((r.meta as any)?.cost || ''),
        r.rag?.used ? 'yes' : 'no',
        String(r.rag?.sources?.length ?? 0)
      ];
      lines.push(row.map(v => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-logs${process ? `-${process}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Top-right: View management */}
      <div className="flex items-center justify-end gap-2 text-sm">
        <label className="text-gray-500">View</label>
        <select value={activeView} onChange={(e)=>loadView(e.target.value)} className="px-2 py-1 border rounded">
          <option value="Default">Default</option>
          {views.map(v => (
            <option key={v.name} value={v.name}>{v.name}</option>
          ))}
        </select>
        <button className="px-2 py-1 border rounded" onClick={saveViewPrompt}>Save view</button>
        {activeView !== 'Default' && (
          <button className="px-2 py-1 border rounded" onClick={()=>deleteView(activeView)}>Delete view</button>
        )}
        <button className="px-2 py-1 border rounded" onClick={()=>setCustomizeOpen(true)}>Customize columns</button>
      </div>

      {/* Full-width filter area */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search id, step, prompt, input/output, initiator, request id"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          className="px-2 py-1.5 border rounded text-sm w-full sm:w-[200px] md:w-[240px]"
        />
        <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} className="px-2 py-1.5 border rounded text-sm">
          <option value="all">All levels</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="px-2 py-1.5 border rounded text-sm">
          <option value="all">All categories</option>
          <option value="openai">OpenAI</option>
          <option value="upload">Upload</option>
          <option value="processing">Processing</option>
          <option value="network">Network</option>
          <option value="system">System</option>
        </select>
        <select value={hasRag} onChange={(e) => { setHasRag(e.target.value); setPage(1); }} className="px-2 py-1.5 border rounded text-sm">
          <option value="all">RAG: All</option>
          <option value="yes">RAG: Yes</option>
          <option value="no">RAG: No</option>
        </select>
        <select value={hasError} onChange={(e) => { setHasError(e.target.value); setPage(1); }} className="px-2 py-1.5 border rounded text-sm">
          <option value="all">Errors: All</option>
          <option value="yes">Errors: Only</option>
        </select>
        <div className="flex items-center gap-1 border rounded px-1 py-1 text-xs text-gray-600">
          <span className="select-none">🗓</span>
          <span className="select-none">F:</span>
          <input
            type="datetime-local"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="px-1 py-0.5 border rounded text-xs w-[150px] md:w-[170px]"
            aria-label="From date"
          />
          <span className="select-none">T:</span>
          <input
            type="datetime-local"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="px-1 py-0.5 border rounded text-xs w-[150px] md:w-[170px]"
            aria-label="To date"
          />
        </div>
      </div>

      {/* Right-aligned: entries + export */}
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-gray-600">
        <div className="whitespace-nowrap">{total}{!serverMode && rows ? ` / ${rows.length}` : ""} entries</div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 border rounded" onClick={exportCSV}>Export CSV</button>
          <button className="px-2 py-1 border rounded" onClick={exportJSON}>Export JSON</button>
        </div>
      </div>

      <div className="border rounded overflow-auto">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {visibleColumns.map((k) => {
                const col = allColumns.find(c => c.key === k)!;
                return <th key={k} className="text-left px-3 py-2">{col.label}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={visibleColumns.length}>Loading…</td></tr>
            ) : error ? (
              <tr><td className="px-3 py-6 text-red-600" colSpan={visibleColumns.length}>{error}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={visibleColumns.length}>No logs</td></tr>
            ) : (
              pageData.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(r)}>
                  {visibleColumns.map((k) => {
                    switch(k){
                      case 'time': return <td key={k} className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{new Date(r.timestamp).toLocaleString()}</td>;
                      case 'process': return <td key={k} className="px-3 py-2 text-xs text-gray-600">{r.process || '-'}</td>;
                      case 'id': return <td key={k} className="px-3 py-2 text-xs text-gray-600">{r.id}</td>;
                      case 'step': return <td key={k} className="px-3 py-2">{r.step || '-'}</td>;
                      case 'ir': return <td key={k} className="px-3 py-2 text-xs text-gray-600 truncate max-w-[220px]" title={r.ir ? JSON.stringify(r.ir) : undefined}>{r.ir ? 'Yes' : '-'}</td>;
                      case 'prompt': return <td key={k} className="px-3 py-2 text-xs text-gray-700 truncate max-w-[280px]" title={r.prompt || undefined}>{r.prompt || '-'}</td>;
                      case 'input': return <td key={k} className="px-3 py-2 text-xs text-gray-600 truncate max-w-[220px]" title={r.input ? JSON.stringify(r.input) : undefined}>{r.input ? 'JSON' : '-'}</td>;
                      case 'output': return <td key={k} className="px-3 py-2 text-xs text-gray-600 truncate max-w-[220px]" title={r.output ? JSON.stringify(r.output) : undefined}>{typeof r.output === 'string' ? r.output.slice(0,120) : r.output ? 'JSON' : '-'}</td>;
                      case 'flag': return <td key={k} className="px-3 py-2 text-xs">{r.flag || '-'}</td>;
                      case 'rag': return <td key={k} className="px-3 py-2 text-xs text-gray-600">{r.rag?.used ? `Yes (${r.rag?.sources?.length ?? 0})` : 'No'}</td>;
                      case 'initiator': return <td key={k} className="px-3 py-2 text-xs">{r.initiator || '-'}</td>;
                      case 'quality': return <td key={k} className="px-3 py-2 text-xs">{r.quality?.score == null ? '-' : Number(r.quality.score).toFixed(2)}</td>;
                      case 'level': return <td key={k} className="px-3 py-2 text-xs">{r.meta?.level || '-'}</td>;
                      case 'category': return <td key={k} className="px-3 py-2 text-xs">{(r.meta as any)?.category || '-'}</td>;
                      case 'requestId': return <td key={k} className="px-3 py-2 text-xs font-mono truncate max-w-[160px]" title={r.meta?.requestId || undefined}>{r.meta?.requestId || '-'}</td>;
                      case 'duration': return <td key={k} className="px-3 py-2 text-xs">{r.meta?.duration || r.meta?.durationMs || '-'}</td>;
                      case 'model': return <td key={k} className="px-3 py-2 text-xs">{(r.meta as any)?.model || '-'}</td>;
                      case 'tokens': return <td key={k} className="px-3 py-2 text-xs">{(r.meta as any)?.tokens || (r.meta as any)?.usage?.total_tokens || '-'}</td>;
                      case 'cost': return <td key={k} className="px-3 py-2 text-xs">{(r.meta as any)?.cost || '-'}</td>;
                    }
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom pagination */}
      <div className="flex items-center justify-end gap-2 text-sm text-gray-600">
        <button
          className="px-2 py-1 border rounded"
          disabled={page<=1}
          onClick={() => setPage(p => Math.max(1, p-1))}
        >
          Prev
        </button>
        <span>Page {page} / {totalPages}</span>
        <button
          className="px-2 py-1 border rounded"
          disabled={page>=totalPages}
          onClick={() => setPage(p => Math.min(totalPages, p+1))}
        >
          Next
        </button>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="px-2 py-1 border rounded"
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative z-10 bg-white rounded shadow-xl max-w-6xl w-full mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm text-gray-600 truncate">Log Detail — <span className="font-mono">{selected.id}</span></div>
              <div className="flex items-center gap-2">
                <Link
                  href={buildEditorHref(selected)}
                  className="px-2 py-1 border rounded text-sm text-blue-700 hover:underline"
                  title="Open Modeling Editor"
                >
                  Open Modeling Editor
                </Link>
                <button className="px-2 py-1 border rounded text-sm" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Timestamp</div>
                  <div>{new Date(selected.timestamp).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Process</div>
                  <div>{selected.process || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Initiator</div>
                  <div>{selected.initiator || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Step</div>
                  <div>{selected.step || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Flag</div>
                  <div>{selected.flag || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Quality</div>
                  <div>{selected.quality?.score == null ? '-' : Number(selected.quality.score).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Level</div>
                  <div>{selected.meta?.level || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Category</div>
                  <div>{(selected.meta as any)?.category || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Request ID</div>
                  <div className="font-mono text-xs break-all">{selected.meta?.requestId || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Duration</div>
                  <div>{(selected.meta as any)?.duration || (selected.meta as any)?.durationMs || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Model</div>
                  <div>{(selected.meta as any)?.model || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Tokens</div>
                  <div>{(selected.meta as any)?.tokens || (selected.meta as any)?.usage?.total_tokens || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Cost</div>
                  <div>{(selected.meta as any)?.cost || '-'}</div>
                </div>
              </div>

              {selected.ir && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Intermediate Representation (IR)</div>
                  <pre className="p-2 bg-gray-50 rounded border text-xs whitespace-pre-wrap overflow-auto max-h-64">{JSON.stringify(selected.ir, null, 2)}</pre>
                </div>
              )}
              {selected.prompt && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Prompt</div>
                  <pre className="p-2 bg-gray-50 rounded border text-xs whitespace-pre-wrap overflow-auto max-h-48">{selected.prompt}</pre>
                </div>
              )}
              {selected.input && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Input</div>
                  <pre className="p-2 bg-gray-50 rounded border text-xs whitespace-pre-wrap overflow-auto max-h-48">{JSON.stringify(selected.input, null, 2)}</pre>
                </div>
              )}
              {selected.output && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Output</div>
                  <pre className="p-2 bg-gray-50 rounded border text-xs whitespace-pre-wrap overflow-auto max-h-64">{typeof selected.output === 'string' ? selected.output : JSON.stringify(selected.output, null, 2)}</pre>
                </div>
              )}

              {selected.rag && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">RAG</div>
                  {Array.isArray(selected.rag.sources) && selected.rag.sources.length > 0 ? (
                    <div className="border rounded">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-2 py-1">Source</th>
                            <th className="text-left px-2 py-1">Title</th>
                            <th className="text-left px-2 py-1">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.rag.sources.map((s: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="px-2 py-1 font-mono">{s.id || '-'}</td>
                              <td className="px-2 py-1">{s.title || '-'}</td>
                              <td className="px-2 py-1">{s.score == null ? '-' : s.score}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <pre className="p-2 bg-gray-50 rounded border text-xs whitespace-pre-wrap overflow-auto max-h-48">{JSON.stringify(selected.rag, null, 2)}</pre>
                  )}
                </div>
              )}

              {selected.meta && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Metadata</div>
                  <pre className="p-2 bg-gray-50 rounded border text-xs whitespace-pre-wrap overflow-auto max-h-64">{JSON.stringify(selected.meta, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {customizeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={()=>setCustomizeOpen(false)} />
          <div className="relative z-10 bg-white rounded shadow-xl w-full max-w-xl mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="text-sm text-gray-600">Customize Columns</div>
              <button className="px-2 py-1 border rounded text-sm" onClick={()=>{ setCustomizeOpen(false); persistCurrent(); }}>Close</button>
            </div>
            <div className="p-4 text-sm">
              <ul className="space-y-2">
                {order.map((k, idx) => (
                  <li key={k} className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={!hidden.has(k)} onChange={(e)=>{
                        const next = new Set(hidden);
                        if (e.target.checked) next.delete(k); else next.add(k);
                        setHidden(next);
                      }} />
                      <span>{allColumns.find(c => c.key === k)?.label || k}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 border rounded" disabled={idx===0} onClick={()=>{
                        const next = order.slice();
                        const [m] = next.splice(idx,1);
                        next.splice(idx-1,0,m);
                        setOrder(next);
                      }}>↑</button>
                      <button className="px-2 py-1 border rounded" disabled={idx===order.length-1} onClick={()=>{
                        const next = order.slice();
                        const [m] = next.splice(idx,1);
                        next.splice(idx+1,0,m);
                        setOrder(next);
                      }}>↓</button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-xs text-gray-500">Changes auto-save when closing.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
