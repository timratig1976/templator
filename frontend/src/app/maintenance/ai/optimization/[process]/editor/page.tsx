"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Humanloop-style Editor tab
// 3 columns: Left (Parameters + Template), Middle (Inputs + Messages + Output), Right (Readme)

type Role = "user" | "assistant" | "system" | "tool";

interface MessageBlock {
  id: string;
  role: Role;
  content: string;
}

type EditorCoreProps = { params: { process: string }; initialPromptId?: string | null; initialRunId?: string | null };
function EditorCore({ params, initialPromptId, initialRunId }: EditorCoreProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const runId = (initialRunId == null ? searchParams.get('runId') : initialRunId) as string | null;
  const promptIdParam = (initialPromptId == null ? searchParams.get('promptId') : initialPromptId) as string | null;
  const stepId = searchParams.get('stepId');
  const [unsaved, setUnsaved] = useState(false);
  const [model, setModel] = useState("gpt-4o");
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState<number | "-1">("-1");
  const [topP, setTopP] = useState(1);
  const [presencePenalty, setPresencePenalty] = useState(0);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  // Inputs extracted from `{{var}}` placeholders in messages
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  // Step context
  const [stepLoading, setStepLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [stepMeta, setStepMeta] = useState<any | null>(null);
  const [stepVersions, setStepVersions] = useState<any[]>([]);
  const [stepVersionsOpen, setStepVersionsOpen] = useState<boolean>(false);
  const [addMenuOpenMiddle, setAddMenuOpenMiddle] = useState(false);
  // Left/Middle resizable columns
  const [leftPaneW, setLeftPaneW] = useState<number>(420);
  const [resizingCols, setResizingCols] = useState(false);
  const colResizeStart = useRef<{ sx: number; startW: number }>({ sx: 0, startW: 420 });
  const [seed, setSeed] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<MessageBlock[]>([
    { id: "m1", role: "user", content: "Beschreibe {{Produkt}} in Stichpunkten." },
  ]);
  const [output, setOutput] = useState<string>("");
  const [showReadme, setShowReadme] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState<string>("");
  const [saveDescription, setSaveDescription] = useState<string>("");
  const [promoteToProd, setPromoteToProd] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string }>(() => ({ show: false, message: '' }));
  const [versions, setVersions] = useState<Array<{ id: string; version: string | number; title?: string; description?: string; isActive?: boolean; content?: string; createdAt?: string }>>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [loadedVersionId, setLoadedVersionId] = useState<string | null>(null);
  const [loadedIsActive, setLoadedIsActive] = useState<boolean>(false);
  const [readme, setReadme] = useState<string>("");
  const [readmeLoading, setReadmeLoading] = useState<boolean>(false);
  const [readmeSaving, setReadmeSaving] = useState<boolean>(false);
  const [readmeError, setReadmeError] = useState<string | null>(null);
  const [loadOpen, setLoadOpen] = useState(false);
  const [loadQuery, setLoadQuery] = useState("");
  // Step menu (quick access to step versions in toolbar)
  const [stepMenuOpen, setStepMenuOpen] = useState(false);
  // Parameters UI state
  const [modelOpen, setModelOpen] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const [tempOpen, setTempOpen] = useState(false);
  const [topPOpen, setTopPOpen] = useState(false);
  const [presOpen, setPresOpen] = useState(false);
  const [freqOpen, setFreqOpen] = useState(false);
  const [maxOpen, setMaxOpen] = useState(false);

  const updateMessage = (id: string, patch: Partial<MessageBlock>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    setUnsaved(true);
  };

  // Activate a step version
  const activateStepVersion = async (version: string) => {
    if (!stepId) return;
    if (!confirm(`Activate step version ${version}?`)) return;
    try {
      const res = await fetch(`/api/admin/ai-steps/${encodeURIComponent(stepId)}/versions/${encodeURIComponent(version)}/activate`, { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      setToast({ show: true, message: 'Step version activated' });
      setTimeout(() => setToast({ show: false, message: '' }), 2000);
      // Refresh versions list
      try {
        const vRes = await fetch(`/api/admin/ai-steps/${encodeURIComponent(stepId)}/versions`);
        if (vRes.ok) {
          const vJson = await vRes.json();
          setStepVersions(Array.isArray(vJson?.data) ? vJson.data : Array.isArray(vJson) ? vJson : []);
        }
      } catch {}
    } catch (e) {
      setToast({ show: true, message: 'Failed to activate step version' });
      setTimeout(() => setToast({ show: false, message: '' }), 2000);
    }
  };

  // (moved auto-float effect below where extractedVars is declared)

  // Readme load/save
  const fetchReadme = async () => {
    setReadmeLoading(true);
    setReadmeError(null);
    try {
      const res = await fetch(`/api/admin/ai-prompts/processes/${encodeURIComponent(params.process)}/readme`);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      setReadme(typeof json?.data?.markdown === 'string' ? json.data.markdown : '');
    } catch (e) {
      setReadmeError('Failed to load Readme');
    } finally {
      setReadmeLoading(false);
    }
  };

  const saveReadme = async () => {
    setReadmeSaving(true);
    setReadmeError(null);
    try {
      const res = await fetch(`/api/admin/ai-prompts/processes/${encodeURIComponent(params.process)}/readme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: readme }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setToast({ show: true, message: 'Readme saved' });
      setTimeout(() => setToast({ show: false, message: '' }), 2000);
    } catch (e) {
      setReadmeError('Failed to save Readme');
    } finally {
      setReadmeSaving(false);
    }
  };

  // Load version content into the message editor (simple single-block mapping)
  const loadVersionIntoEditor = (v: { id?: string; content?: string; isActive?: boolean }) => {
    const text = (v?.content ?? '').trim();
    if (!text) return;
    setMessages([{ id: 'm1', role: 'user', content: text }]);
    setUnsaved(true);
    if (v && typeof v === 'object') {
      setLoadedVersionId((v as any).id || null);
      setLoadedIsActive(!!v.isActive);
    } else {
      setLoadedVersionId(null);
      setLoadedIsActive(false);
    }
  };

  // Activate a prompt version as production
  const activatePrompt = async (promptId: string) => {
    try {
      const res = await fetch(`/api/admin/ai-prompts/prompts/${encodeURIComponent(promptId)}/activate`, { method: 'PUT' });
      if (!res.ok) throw new Error(String(res.status));
      setToast({ show: true, message: 'Activated as production' });
      setTimeout(() => setToast({ show: false, message: '' }), 2000);
      fetchVersions();
    } catch (e) {
      setToast({ show: true, message: 'Failed to activate version' });
      setTimeout(() => setToast({ show: false, message: '' }), 2000);
    }
  };

  const addMessage = (role: Role = "user") => {
    setMessages((prev) => [
      ...prev,
      { id: `m${prev.length + 1}` as const, role, content: "" },
    ]);
    setUnsaved(true);
  };

  const onSave = async () => {
    setShowSaveModal(true);
  };

  const onRun = async () => {
    // Call backend test endpoint with current messages and parameters
    try {
      setOutput("Running…");
      const promptParts = messages.map(m => ({ role: m.role, content: m.content }));
      const promptPartsResolved = resolvedPreview.map(m => ({ role: m.role, content: m.content }));
      const payload: any = {
        promptContent: resolvedPreview.map((m) => m.content).join("\n"),
        promptId: loadedVersionId || undefined,
        inputData: {
          promptParts,
          promptPartsResolved,
          inputMeta: inputValues,
          options: {
            model,
            temperature,
            topP,
            presencePenalty,
            frequencyPenalty,
            maxTokens: maxTokens === "-1" ? undefined : Number(maxTokens),
            seed: typeof seed === 'string' && seed.trim() !== '' ? Number(seed) : undefined,
          },
        },
      };

      const res = await fetch(`/api/admin/ai-prompts/processes/${encodeURIComponent(params.process)}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const result = json?.data?.result ?? json?.data ?? json;
      const pretty = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      setOutput(pretty || '');
    } catch (e) {
      const msg = (e as any)?.message || 'Failed to run prompt';
      setOutput(`Error: ${msg}`);
    }
  };

  const onClear = () => {
    setOutput("");
  };

  // Extract unique placeholder variables like {{var}} from all message contents
  const extractedVars = useMemo(() => {
    const re = /\{\{\s*([a-zA-Z0-9_\-.]+)\s*\}\}/g;
    const set = new Set<string>();
    for (const m of messages) {
      let match: RegExpExecArray | null;
      while ((match = re.exec(m.content))) {
        set.add(match[1]);
      }
    }
    return Array.from(set).sort();
  }, [messages]);

  // Ensure inputValues has keys for all extracted variables
  useEffect(() => {
    setInputValues((prev) => {
      let changed = false;
      const next: Record<string, string> = { ...prev };
      for (const k of extractedVars) {
        if (!(k in next)) {
          next[k] = "";
          changed = true;
        }
      }
      // prune removed keys
      for (const k of Object.keys(next)) {
        if (!extractedVars.includes(k)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [extractedVars]);

  // Build a preview of messages with placeholders resolved from inputValues
  const resolvedPreview = useMemo(() => {
    if (!messages?.length) return [] as { id: string; role: Role; content: string }[];
    const re = /\{\{\s*([a-zA-Z0-9_\-.]+)\s*\}\}/g;
    return messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content.replace(re, (_, key) => (key in inputValues ? String(inputValues[key] ?? "") : "")),
    }));
  }, [messages, inputValues]);


  const removeMessage = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setUnsaved(true);
  };

  // Sync Readme slide-over with query param readme=1
  useEffect(() => {
    const open = searchParams.get('readme') === '1';
    setShowReadme(open);
  }, [searchParams]);

  // (floating panel removed)

  const filteredVersions = useMemo(() => {
    const q = loadQuery.trim().toLowerCase();
    if (!q) return versions;
    return versions.filter((v) => {
      const vLabel = `${String(v.version)} ${v.title || ''}`.toLowerCase();
      return vLabel.includes(q);
    });
  }, [versions, loadQuery]);

  // Model list (simple static demo list)
  const chatModels = useMemo(
    () => [
      "gpt-4.1-2025-04-14",
      "gpt-4.1-mini-2025-04-14",
      "gpt-4.1-nano-2025-04-14",
      "gpt-4o-realtime-preview-2025-xx",
      "gpt-4o-audio-preview-2025-xx",
      "o4-mini-deep-research",
      "o4-mini-deep-research-2025-xx",
      "gpt-3.5-turbo-16k",
    ],
    []
  );
  const filteredModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    if (!q) return chatModels;
    return chatModels.filter((m) => m.toLowerCase().includes(q));
  }, [chatModels, modelQuery]);

  const toggleLoadMenu = async () => {
    const next = !loadOpen;
    setLoadOpen(next);
    if (next) {
      setLoadQuery("");
      await fetchVersions();
    }
  };

  // Detect if current editor matches the active version content and reflect Active badge
  const normalize = (s: string) => (s || '').replace(/\r\n/g, '\n').trim();
  const currentEditorText = useMemo(() => normalize(messages.map(m => m.content).join("\n")), [messages]);
  useEffect(() => {
    if (!versions || versions.length === 0) return;
    const active = versions.find(v => v.isActive);
    if (!active || typeof active.content !== 'string') return;
    const activeText = normalize(active.content);
    const matches = currentEditorText === activeText;
    setLoadedIsActive(matches);
    if (matches) {
      setLoadedVersionId(active.id || null);
    }
  }, [versions, currentEditorText]);

  const closeReadme = () => {
    const paramsCopy = new URLSearchParams(searchParams.toString());
    paramsCopy.delete('readme');
    const qs = paramsCopy.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
    setShowReadme(false);
  };

  // Hydrate from runId if present
  useEffect(() => {
    const load = async () => {
      if (!runId) return;
      try {
        const res = await fetch(`/api/admin/ai-prompts/runs/${encodeURIComponent(runId)}`);
        if (!res.ok) return; // leave defaults
        const json = await res.json();
        const run = json?.data;
        if (!run) return;
        // Inputs
        const meta = run?.input?.inputMeta || {};
        // (inputs summary removed with floating panel)
        // Messages from promptParts when available
        const parts = run?.input?.promptParts;
        if (Array.isArray(parts) && parts.length > 0) {
          const mapped: MessageBlock[] = parts.map((p: any, idx: number) => ({
            id: `m${idx + 1}`,
            role: (p?.role as Role) || 'user',
            content: typeof p?.content === 'string' ? p.content : JSON.stringify(p),
          }));
          setMessages(mapped);
        }
        // Output
        const out = run?.output;
        if (out) {
          const raw = typeof out?._raw === 'string' ? out._raw : JSON.stringify(out, null, 2);
          setOutput(raw || '');
        }
      } catch {
        // ignore; keep defaults
      }
    };
    load();
  }, [runId]);

  // Hydrate from promptId if present
  useEffect(() => {
    const loadPrompt = async () => {
      const promptId = promptIdParam?.trim();
      if (!promptId) return;
      try {
        const res = await fetch(`/api/admin/ai-prompts/prompts/${encodeURIComponent(promptId)}`);
        if (!res.ok) return;
        const json = await res.json();
        const prompt = json?.data || json;
        const content = (prompt?.content || prompt?.promptContent || '').trim();
        if (content) {
          setMessages([{ id: 'm1', role: 'user', content }]);
          setUnsaved(true);
        }
        if (prompt?.id) setLoadedVersionId(String(prompt.id));
        setLoadedIsActive(!!prompt?.isActive);
      } catch {/* ignore */}
    };
    loadPrompt();
  }, [promptIdParam]);

  // Load step context when stepId present
  useEffect(() => {
    const loadStep = async () => {
      if (!stepId) return;
      try {
        setStepLoading(true);
        setStepError(null);
        const [sRes, vRes] = await Promise.all([
          fetch(`/api/admin/ai-steps/${encodeURIComponent(stepId)}`),
          fetch(`/api/admin/ai-steps/${encodeURIComponent(stepId)}/versions`),
        ]);
        if (!sRes.ok) throw new Error(`step ${sRes.status}`);
        const sJson = await sRes.json();
        setStepMeta(sJson?.data || sJson || null);
        if (vRes.ok) {
          const vJson = await vRes.json();
          setStepVersions(Array.isArray(vJson?.data) ? vJson.data : Array.isArray(vJson) ? vJson : []);
        } else {
          setStepVersions([]);
        }
      } catch (e: any) {
        setStepError('Failed to load step context');
      } finally {
        setStepLoading(false);
      }
    };
    loadStep();
  }, [stepId]);

  // Fetch versions for this process
  const fetchVersions = async () => {
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-prompts/processes/${encodeURIComponent(params.process)}/versions`);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      setVersions(list);
      // Keep selection stable if still present
      if (selectedVersionId && !list.find((v: any) => v.id === selectedVersionId)) {
        setSelectedVersionId(null);
      }
    } catch {
      // ignore; panel optional
    } finally {
      setVersionsLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
    fetchReadme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.process]);

  // Keyboard shortcut: Cmd/Ctrl+S => open Save modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setShowSaveModal(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSaveVersion = async () => {
    setSaving(true);
    try {
      const promptContent = messages.map((m) => m.content).join("\n");
      const version = await createPromptVersion({
        process: params.process,
        version: saveName,
        promptContent,
        title: saveName,
        description: saveDescription,
        author: "ui",
        setAsActive: promoteToProd,
      });
      setUnsaved(false);
      setShowSaveModal(false);
      setSaveName("");
      setSaveDescription("");
      setPromoteToProd(false);
      setToast({ show: true, message: promoteToProd ? 'Version saved and promoted to production' : 'Version saved' });
      setTimeout(() => setToast({ show: false, message: '' }), 2500);
      // Refresh versions list
      fetchVersions();
    } catch (error) {
      const msg = (error as any)?.message || 'Failed to save version';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  // Mouse move for column resizing
  const onMoveCols = (e: MouseEvent) => {
    if (!resizingCols) return;
    const dx = e.clientX - colResizeStart.current.sx;
    const next = Math.max(300, Math.min(680, colResizeStart.current.startW + dx));
    setLeftPaneW(next);
  };

  // Initialize/persist left pane width
  useEffect(() => {
    try {
      const saved = localStorage.getItem('editor:leftPaneW');
      if (saved) {
        const n = Number(saved);
        if (!Number.isNaN(n) && n >= 300 && n <= 680) setLeftPaneW(n);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('editor:leftPaneW', String(leftPaneW)); } catch {}
  }, [leftPaneW]);

  useEffect(() => {
    if (!resizingCols) return;
    const up = () => setResizingCols(false);
    window.addEventListener('mousemove', onMoveCols as any);
    window.addEventListener('mouseup', up, { once: true } as any);
    return () => {
      window.removeEventListener('mousemove', onMoveCols as any);
    };
  }, [resizingCols]);

  return (
    <div className={"flex gap-6"} style={{ cursor: resizingCols ? 'col-resize' as const : undefined, userSelect: resizingCols ? 'none' as const : undefined }}>
      {/* Left column: Parameters + Template */}
      <div className="space-y-4" style={{ width: leftPaneW, minWidth: 300 }}>
        <div className="sticky top-[64px] z-10">
          {unsaved ? (
          <div className="border rounded-md p-3 bg-amber-50 border-amber-200 flex items-center justify-between">
            <div className="font-medium text-amber-900">Unsaved changes</div>
            <div className="flex items-center gap-2">
              {loadedIsActive && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700 h-6">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Active
                </span>
              )}
              <button onClick={onSave} className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-gray-200 bg-white text-gray-800 text-sm hover:bg-gray-50 shadow-sm">Save</button>
              <div className="relative">
                <button onClick={toggleLoadMenu} className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-gray-200 bg-white text-gray-800 text-sm hover:bg-gray-50 shadow-sm">
                  <span>Load</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
                  </svg>
                </button>
                {loadOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setLoadOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 z-50 bg-white border border-gray-200 rounded-md shadow-lg">
                      <div className="p-2 border-b border-gray-200">
                        <input
                          value={loadQuery}
                          onChange={(e) => setLoadQuery(e.target.value)}
                          placeholder="Search Prompt Versions"
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-gray-300"
                        />
                      </div>
                      <div className="max-h-72 overflow-auto divide-y divide-gray-100">
                        {filteredVersions.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                        ) : (
                          filteredVersions.map((v) => (
                            <button
                              key={v.id}
                              className="w-full px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 text-sm flex items-center justify-between gap-3"
                              onClick={() => { loadVersionIntoEditor(v); setLoadOpen(false); }}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                {v.isActive && <span className="inline-block flex-none w-2.5 h-2.5 rounded-full bg-green-500" title="Active" />}
                                <span className="flex-none font-semibold">{String(v.version)}</span>
                                <span className="text-gray-600 truncate">{v.title || ''}</span>
                              </span>
                              {v.createdAt ? (
                                <span className="ml-2 flex-none text-[11px] text-gray-400">
                                  {(() => { try { const d = new Date(v.createdAt as any); return isNaN(d.getTime()) ? '' : d.toLocaleDateString(); } catch { return ''; } })()}
                                </span>
                              ) : null}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {stepId && (
                <div className="relative">
                  <button onClick={() => setStepMenuOpen((v)=>!v)} className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-gray-200 bg-white text-gray-800 text-sm hover:bg-gray-50 shadow-sm">
                    <span>Step</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {stepMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setStepMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-96 z-50 bg-white border border-gray-200 rounded-md shadow-lg">
                        <div className="px-3 py-2 text-xs text-gray-500 border-b">Step versions are linked to Prompt versions; content loads from Prompt versions only.</div>
                        <div className="max-h-80 overflow-auto divide-y divide-gray-100">
                          {Array.isArray(stepVersions) && stepVersions.length > 0 ? (
                            stepVersions.map((sv: any) => (
                              <div key={sv.id || sv.version} className="px-3 py-2 text-sm flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 min-w-0">
                                  {sv.isActive && <span className="inline-block flex-none w-2.5 h-2.5 rounded-full bg-green-500" title="Active" />}
                                  <span className="font-semibold">v{String(sv.version)}</span>
                                </span>
                                <span className="flex items-center gap-2">
                                  {!sv.isActive && (
                                    <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-blue-700" onClick={() => { activateStepVersion(String(sv.version)); setStepMenuOpen(false); }}>Activate</button>
                                  )}
                                  <a
                                    className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-indigo-700"
                                    href={`/maintenance/ai/optimization/step/editor/${encodeURIComponent(stepId)}` + `?stepVersion=${encodeURIComponent(String(sv.version))}`}
                                  >Open</a>
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500">No step versions</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
              <button className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 shadow-sm">⋯</button>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-md p-2 bg-white flex items-center justify-between">
            <div className="text-xs text-gray-500">Prompt Editor</div>
            <div className="flex items-center gap-2">
              {loadedIsActive && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700 h-6">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Active
                </span>
              )}
              <button onClick={onSave} className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-gray-200 bg-white text-gray-800 text-sm hover:bg-gray-50 shadow-sm">Save</button>
              <div className="relative">
                <button onClick={toggleLoadMenu} className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-gray-200 bg-white text-gray-800 text-sm hover:bg-gray-50 shadow-sm">
                  <span>Load</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
                  </svg>
                </button>
                {loadOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setLoadOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 z-50 bg-white border border-gray-200 rounded-md shadow-lg">
                      <div className="p-2 border-b border-gray-200">
                        <input
                          value={loadQuery}
                          onChange={(e) => setLoadQuery(e.target.value)}
                          placeholder="Search Prompt Versions"
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-gray-300"
                        />
                      </div>
                      <div className="max-h-72 overflow-auto divide-y divide-gray-100">
                        {filteredVersions.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
                        ) : (
                          filteredVersions.map((v) => (
                            <button
                              key={v.id}
                              className="w-full px-3 py-2 hover:bg-gray-50 focus:bg-gray-50 text-sm flex items-center justify-between gap-3"
                              onClick={() => { loadVersionIntoEditor(v); setLoadOpen(false); }}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                {v.isActive && <span className="inline-block flex-none w-2.5 h-2.5 rounded-full bg-green-500" title="Active" />}
                                <span className="flex-none font-semibold">{String(v.version)}</span>
                                <span className="text-gray-600 truncate">{v.title || ''}</span>
                              </span>
                              {v.createdAt ? (
                                <span className="ml-2 flex-none text-[11px] text-gray-400">
                                  {(() => { try { const d = new Date(v.createdAt as any); return isNaN(d.getTime()) ? '' : d.toLocaleDateString(); } catch { return ''; } })()}
                                </span>
                              ) : null}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {stepId && (
                <div className="relative">
                  <button onClick={() => setStepMenuOpen((v)=>!v)} className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-gray-200 bg-white text-gray-800 text-sm hover:bg-gray-50 shadow-sm">
                    <span>Step</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {stepMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setStepMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-96 z-50 bg-white border border-gray-200 rounded-md shadow-lg">
                        <div className="px-3 py-2 text-xs text-gray-500 border-b">Step versions are linked to Prompt versions; content loads from Prompt versions only.</div>
                        <div className="max-h-80 overflow-auto divide-y divide-gray-100">
                          {Array.isArray(stepVersions) && stepVersions.length > 0 ? (
                            stepVersions.map((sv: any) => (
                              <div key={sv.id || sv.version} className="px-3 py-2 text-sm flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 min-w-0">
                                  {sv.isActive && <span className="inline-block flex-none w-2.5 h-2.5 rounded-full bg-green-500" title="Active" />}
                                  <span className="font-semibold">v{String(sv.version)}</span>
                                </span>
                                <span className="flex items-center gap-2">
                                  {!sv.isActive && (
                                    <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-blue-700" onClick={() => { activateStepVersion(String(sv.version)); setStepMenuOpen(false); }}>Activate</button>
                                  )}
                                  <a
                                    className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-indigo-700"
                                    href={`/maintenance/ai/optimization/step/editor/${encodeURIComponent(stepId)}` + `?stepVersion=${encodeURIComponent(String(sv.version))}`}
                                  >Open</a>
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500">No step versions</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        </div>

        {/* Step context: expandable versions list when stepId is present */}
        {stepId && (
          <section className="border rounded-md p-3 bg-white">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">Step versions{stepMeta?.name ? ` · ${stepMeta.name}` : ''}</div>
                {stepMeta?.description ? (
                  <div className="text-xs text-gray-500 truncate">{stepMeta.description}</div>
                ) : null}
              </div>
              <button
                className="inline-flex items-center gap-1 px-2 py-1 border rounded bg-white hover:bg-gray-50 text-gray-700 text-xs"
                onClick={() => setStepVersionsOpen((v) => !v)}
                aria-expanded={stepVersionsOpen}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: stepVersionsOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
                  <path d="M8 5l8 7-8 7" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Versions ({stepVersions?.length || 0})</span>
              </button>
            </div>
            {stepError && <div className="mt-2 text-xs text-red-600">{stepError}</div>}
            {stepVersionsOpen && (
              <div className="mt-3 space-y-2">
                <div className="text-xs text-gray-500">Note: Step versions do not carry prompt content. They link to Prompt versions; use the Load menu to load a Prompt version.</div>
                {Array.isArray(stepVersions) && stepVersions.length > 0 ? (
                  stepVersions.map((v: any) => (
                    <div key={v.id || v.version} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-2 py-0.5 rounded border text-xs ${v.isActive ? 'border-green-600 text-green-700' : 'border-gray-300 text-gray-700'}`}>v{String(v.version)}</span>
                        {v.isActive && <span className="text-xs text-green-700">active</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {!v.isActive && (
                          <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-blue-700" onClick={() => activateStepVersion(String(v.version))}>Activate</button>
                        )}
                        <a
                          className="px-2 py-1 border rounded bg-white hover:bg-gray-50 text-indigo-700"
                          href={`/maintenance/ai/optimization/step/editor/${encodeURIComponent(stepId)}?stepVersion=${encodeURIComponent(String(v.version))}`}
                          title="Open this version in Step Editor"
                        >Open</a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500">No versions yet</div>
                )}
              </div>
            )}
          </section>
        )}

        <section className="border rounded-md p-4">
          <div className="text-sm font-medium mb-3">Parameters</div>
          <div className="flex flex-wrap gap-2 relative">
            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => setModelOpen((v) => !v)}
                className="px-2.5 py-1 rounded-md border text-xs bg-white hover:bg-gray-50 inline-flex items-center gap-1.5"
              >
                <span className="text-gray-500">Model</span>
                <span className="font-medium">{model}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
                </svg>
              </button>
              {modelOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
                  <div className="absolute z-50">
                    <PopoverContainer>
                      <div className="space-y-2">
                        <input
                          value={modelQuery}
                          onChange={(e) => setModelQuery(e.target.value)}
                          placeholder="Search models"
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-gray-300"
                        />
                        <div className="max-h-60 overflow-auto divide-y divide-gray-100">
                          {filteredModels.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-gray-500">No matches</div>
                          ) : (
                            filteredModels.map((m) => (
                              <button
                                key={m}
                                className="w-full text-left px-2 py-1.5 hover:bg-gray-50 text-sm"
                                onClick={() => {
                                  setModel(m);
                                  setUnsaved(true);
                                  setModelOpen(false);
                                }}
                              >
                                {m}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </PopoverContainer>
                  </div>
                </>
              )}
            </div>

            {/* Max tokens */}
            <div className="relative">
              <button
                onClick={() => setMaxOpen((v) => !v)}
                className="px-2.5 py-1 rounded-md border text-xs bg-white hover:bg-gray-50 inline-flex items-center gap-1.5"
              >
                <span className="text-gray-500">Max tokens</span>
                <span className="font-medium">{maxTokens === "-1" ? "Unlimited" : String(maxTokens)}</span>
              </button>
              {maxOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMaxOpen(false)} />
                  <div className="absolute z-50">
                    <PopoverContainer>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-600">Set max tokens</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={4096}
                            step={1}
                            value={maxTokens === "-1" ? 0 : (Number(maxTokens) || 0)}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(4096, Number(e.target.value)));
                              setMaxTokens(v);
                              setUnsaved(true);
                            }}
                            className="w-full"
                          />
                          <input
                            type="number"
                            className="w-24 border rounded px-2 py-1 text-sm"
                            value={maxTokens === "-1" ? "-1" : String(maxTokens)}
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              if (raw === "-1") {
                                setMaxTokens("-1");
                              } else {
                                const n = Number(raw);
                                if (!Number.isNaN(n)) setMaxTokens(Math.max(0, Math.min(4096, n)));
                              }
                              setUnsaved(true);
                            }}
                          />
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={maxTokens === "-1"}
                            onChange={(e) => {
                              setMaxTokens(e.target.checked ? "-1" : 256);
                              setUnsaved(true);
                            }}
                          />
                          Unlimited
                        </label>
                      </div>
                    </PopoverContainer>
                  </div>
                </>
              )}
            </div>

            {/* Temperature */}
            <div className="relative">
              <button
                onClick={() => setTempOpen((v) => !v)}
                className="px-2.5 py-1 rounded-md border text-xs bg-white hover:bg-gray-50 inline-flex items-center gap-1.5"
              >
                <span className="text-gray-500">Temperature</span>
                <span className="font-medium">{temperature.toFixed(2)}</span>
              </button>
              {tempOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setTempOpen(false)} />
                  <div className="absolute z-50">
                    <PopoverContainer>
                      <div className="space-y-2">
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.01}
                          value={temperature}
                          onChange={(e) => { setTemperature(Number(e.target.value)); setUnsaved(true); }}
                          className="w-full"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={2}
                            step={0.01}
                            className="w-24 border rounded px-2 py-1 text-sm"
                            value={temperature}
                            onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) { setTemperature(Math.max(0, Math.min(2, n))); setUnsaved(true); } }}
                          />
                          <span className="text-xs text-gray-500">0 = deterministic, 2 = very creative</span>
                        </div>
                      </div>
                    </PopoverContainer>
                  </div>
                </>
              )}
            </div>

            {/* Top P */}
            <div className="relative">
              <button
                onClick={() => setTopPOpen((v) => !v)}
                className="px-2.5 py-1 rounded-md border text-xs bg-white hover:bg-gray-50 inline-flex items-center gap-1.5"
              >
                <span className="text-gray-500">Top P</span>
                <span className="font-medium">{topP.toFixed(2)}</span>
              </button>
              {topPOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setTopPOpen(false)} />
                  <div className="absolute z-50">
                    <PopoverContainer>
                      <div className="space-y-2">
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={topP}
                          onChange={(e) => { setTopP(Number(e.target.value)); setUnsaved(true); }}
                          className="w-full"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            className="w-24 border rounded px-2 py-1 text-sm"
                            value={topP}
                            onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) { setTopP(Math.max(0, Math.min(1, n))); setUnsaved(true); } }}
                          />
                          <span className="text-xs text-gray-500">Nucleus sampling</span>
                        </div>
                      </div>
                    </PopoverContainer>
                  </div>
                </>
              )}
            </div>

            {/* Presence penalty */}
            <div className="relative">
              <button
                onClick={() => setPresOpen((v) => !v)}
                className="px-2.5 py-1 rounded-md border text-xs bg-white hover:bg-gray-50 inline-flex items-center gap-1.5"
              >
                <span className="text-gray-500">Presence</span>
                <span className="font-medium">{presencePenalty.toFixed(2)}</span>
              </button>
              {presOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPresOpen(false)} />
                  <div className="absolute z-50">
                    <PopoverContainer>
                      <div className="space-y-2">
                        <input
                          type="range"
                          min={-2}
                          max={2}
                          step={0.01}
                          value={presencePenalty}
                          onChange={(e) => { setPresencePenalty(Number(e.target.value)); setUnsaved(true); }}
                          className="w-full"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={-2}
                            max={2}
                            step={0.01}
                            className="w-24 border rounded px-2 py-1 text-sm"
                            value={presencePenalty}
                            onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) { setPresencePenalty(Math.max(-2, Math.min(2, n))); setUnsaved(true); } }}
                          />
                          <span className="text-xs text-gray-500">Discourage repeats</span>
                        </div>
                      </div>
                    </PopoverContainer>
                  </div>
                </>
              )}
            </div>

            {/* Frequency penalty */}
            <div className="relative">
              <button
                onClick={() => setFreqOpen((v) => !v)}
                className="px-2.5 py-1 rounded-md border text-xs bg-white hover:bg-gray-50 inline-flex items-center gap-1.5"
              >
                <span className="text-gray-500">Frequency</span>
                <span className="font-medium">{frequencyPenalty.toFixed(2)}</span>
              </button>
              {freqOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setFreqOpen(false)} />
                  <div className="absolute z-50">
                    <PopoverContainer>
                      <div className="space-y-2">
                        <input
                          type="range"
                          min={-2}
                          max={2}
                          step={0.01}
                          value={frequencyPenalty}
                          onChange={(e) => { setFrequencyPenalty(Number(e.target.value)); setUnsaved(true); }}
                          className="w-full"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={-2}
                            max={2}
                            step={0.01}
                            className="w-24 border rounded px-2 py-1 text-sm"
                            value={frequencyPenalty}
                            onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) { setFrequencyPenalty(Math.max(-2, Math.min(2, n))); setUnsaved(true); } }}
                          />
                          <span className="text-xs text-gray-500">Penalize frequent tokens</span>
                        </div>
                      </div>
                    </PopoverContainer>
                  </div>
                </>
              )}
            </div>

            {/* Seed (simple inline input) */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs bg-white">
              <span className="text-gray-500">Seed</span>
              <input
                type="text"
                value={seed ?? ""}
                onChange={(e) => { setSeed(e.target.value || undefined); setUnsaved(true); }}
                placeholder="optional"
                className="w-24 outline-none text-xs bg-transparent"
              />
            </div>
          </div>
        </section>

        <section className="border rounded-md p-4">
          <div className="flex items-center mb-3">
            <div className="text-sm font-medium">Template</div>
          </div>

          <div className="space-y-3">
            {messages.map((m) => (
              <MessageEditor key={m.id} m={m} onChange={(patch) => updateMessage(m.id, patch)} onDelete={() => removeMessage(m.id)} />
            ))}
            <div className="relative inline-block">
              <button onClick={() => setAddMenuOpen((v) => !v)} className="text-sm px-3 py-1.5 border rounded-md">+ Message</button>
              {addMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
                  <div className="absolute z-50">
                    <PopoverContainer>
                      <div className="flex flex-col gap-1">
                        <button className="text-left px-2 py-1 rounded hover:bg-gray-50 text-sm" onClick={() => { addMessage('user'); setAddMenuOpen(false); }}>User</button>
                        <button className="text-left px-2 py-1 rounded hover:bg-gray-50 text-sm" onClick={() => { addMessage('assistant'); setAddMenuOpen(false); }}>Assistant</button>
                        <button className="text-left px-2 py-1 rounded hover:bg-gray-50 text-sm" onClick={() => { addMessage('system'); setAddMenuOpen(false); }}>System</button>
                        <button className="text-left px-2 py-1 rounded hover:bg-gray-50 text-sm" onClick={() => { addMessage('tool'); setAddMenuOpen(false); }}>Tool</button>
                      </div>
                    </PopoverContainer>
                  </div>
                </>
              )}
            </div>
          </div>
          </section>
          {/* End Template section */}
        </div>

      {/* Vertical divider between left and middle */}
      <div
        className="relative"
        style={{ width: 6 }}
        onMouseDown={(e) => {
          e.preventDefault();
          setResizingCols(true);
          colResizeStart.current = { sx: e.clientX, startW: leftPaneW };
        }}
        onDoubleClick={() => {
          // Toggle between default and a wider preset
          setLeftPaneW((w) => (w < 520 ? 560 : 420));
        }}
        title="Drag to resize. Double-click to toggle width"
      >
        <div className="absolute inset-y-0 left-0 right-0 cursor-col-resize group">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-gray-200 group-hover:bg-gray-400" />
        </div>
      </div>

      {/* Middle column: Inputs + Messages + Output (fixed, no docking) */}
      <div className="space-y-4 flex-1 min-w-[360px]">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500" />
        </div>
        <section className="border rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Inputs</div>
            <button className="text-xs text-gray-500 border rounded px-2 py-1">Edit</button>
          </div>
          <div className="flex flex-col gap-2">
            {extractedVars.length === 0 ? (
              <span className="text-sm text-gray-400">none</span>
            ) : (
              extractedVars.map((key) => (
                <label key={key} className="flex items-center gap-2 text-xs">
                  <span className="w-32 shrink-0 text-gray-600">{key}</span>
                  <input
                    className="flex-1 border rounded px-2 py-1 text-sm"
                    type="text"
                    value={inputValues[key] ?? ''}
                    onChange={(e) => setInputValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </label>
              ))
            )}
          </div>
        </section>

        <section className="border rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Messages</div>
            <div className="flex items-center gap-2">
              <div className="relative inline-block">
                <button onClick={() => setAddMenuOpenMiddle((v) => !v)} className="text-xs border rounded px-2 py-1">+ Message</button>
                {addMenuOpenMiddle && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpenMiddle(false)} />
                    <div className="absolute z-50">
                      <PopoverContainer>
                        <div className="flex flex-col gap-1">
                          <button className="text-left px-2 py-1 rounded hover:bg-gray-50 text-xs" onClick={() => { addMessage('user'); setAddMenuOpenMiddle(false); }}>User</button>
                          <button className="text-left px-2 py-1 rounded hover:bg-gray-50 text-xs" onClick={() => { addMessage('assistant'); setAddMenuOpenMiddle(false); }}>Assistant</button>
                          <button className="text-left px-2 py-1 rounded hover:bg-gray-50 text-xs" onClick={() => { addMessage('system'); setAddMenuOpenMiddle(false); }}>System</button>
                          <button className="text-left px-2 py-1 rounded hover:bg-gray-50 text-xs" onClick={() => { addMessage('tool'); setAddMenuOpenMiddle(false); }}>Tool</button>
                        </div>
                      </PopoverContainer>
                    </div>
                  </>
                )}
              </div>
              <button onClick={onClear} className="text-xs text-gray-500 border rounded px-2 py-1">Clear</button>
            </div>
          </div>
          <div className="space-y-3">
            {resolvedPreview.map((m) => (
              <div key={m.id} className="border rounded p-3">
                <div className="text-xs uppercase text-gray-500 mb-1">{m.role}</div>
                <pre className="whitespace-pre-wrap text-sm">{m.content}</pre>
              </div>
            ))}
          </div>
        </section>

        <section className="border rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Output</div>
            <button onClick={onRun} className="text-sm px-3 py-1.5 border rounded-md">Run</button>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-gray-800 min-h-[80px]">{output || ""}</pre>
        </section>
      </div>

      {/* Readme slide-over overlay (does not affect main 1/3–2/3 layout) */}
      {showReadme && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/20" onClick={closeReadme} />
          <aside className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-2xl border-l p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Readme</div>
              <button className="text-xs text-gray-500 border rounded px-2 py-1" onClick={closeReadme}>Close</button>
            </div>
            {readmeError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{readmeError}</div>}
            <div className="grid grid-cols-2 gap-3 overflow-hidden">
              <div className="flex flex-col overflow-hidden">
                <div className="text-xs text-gray-500 mb-1">Markdown</div>
                <textarea
                  className="w-full h-full min-h-[300px] border rounded p-2 text-sm outline-none"
                  value={readme}
                  onChange={(e) => setReadme(e.target.value)}
                />
              </div>
              <div className="flex flex-col overflow-hidden">
                <div className="text-xs text-gray-500 mb-1">Preview</div>
                <div className="w-full h-full min-h-[300px] border rounded p-3 overflow-auto text-sm prose prose-sm max-w-none">
                  {renderBasicMarkdown(readmeLoading ? '# Loading…' : readme || '*No content*')}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <button className="text-xs border rounded px-3 py-1.5" onClick={fetchReadme} disabled={readmeLoading}>Reload</button>
              <button className="text-xs border rounded px-3 py-1.5 bg-black text-white" onClick={saveReadme} disabled={readmeSaving}>{readmeSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </aside>
        </div>
      )}

      {/* Compare Modal */}
      {compareOpen && selectedVersionId && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setCompareOpen(false)} />
          <div className="absolute inset-0 flex items-start justify-center pt-16 px-4">
            <div className="w-full max-w-5xl rounded-lg bg-white shadow-xl border">
              <div className="flex items-center justify-between px-5 py-3 border-b">
                <div className="text-base font-semibold">Compare Version</div>
                <button className="border rounded px-2 py-1 text-sm" onClick={() => setCompareOpen(false)}>×</button>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 gap-4 max-h-[70vh] overflow-hidden">
                <div className="flex flex-col overflow-hidden">
                  <div className="text-xs text-gray-500 mb-1">Selected Version</div>
                  <pre className="border rounded p-2 text-xs whitespace-pre-wrap overflow-auto h-full">{(versions.find(v => v.id === selectedVersionId)?.content || '')}</pre>
                </div>
                <div className="flex flex-col overflow-hidden">
                  <div className="text-xs text-gray-500 mb-1">Current Editor</div>
                  <pre className="border rounded p-2 text-xs whitespace-pre-wrap overflow-auto h-full">{messages.map(m => m.content).join('\n')}</pre>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 mb-1">Diff (line by line)</div>
                  <DiffView
                    left={(versions.find(v => v.id === selectedVersionId)?.content || '')}
                    right={messages.map(m => m.content).join('\n')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Version Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => !saving && setShowSaveModal(false)} />
          <div className="absolute inset-0 flex items-start justify-center pt-20 px-4">
            <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div className="text-base font-semibold">Save Version</div>
                <button
                  className="border rounded px-2 py-1 text-sm"
                  onClick={() => !saving && setShowSaveModal(false)}
                  disabled={saving}
                >
                  ×
                </button>
              </div>
              <div className="px-5 py-4 space-y-4">
                {saveError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{saveError}</div>
                )}
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Name (optional)</label>
                  <input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    type="text"
                    placeholder="v21"
                    className="w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Description (optional)</label>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    placeholder="Describe the changes you made"
                    className="w-full min-h-[84px] border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <label className="flex items-start gap-2 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promoteToProd}
                    onChange={(e) => setPromoteToProd(e.target.checked)}
                  />
                  <div>
                    <div className="text-sm font-medium">Promote to production</div>
                    <div className="text-xs text-gray-500">The production version of this file will be updated.</div>
                  </div>
                </label>
              </div>
              <div className="px-5 py-4 border-t flex items-center justify-between">
                <button
                  className="px-3 py-1.5 border rounded-md text-sm"
                  onClick={() => !saving && setShowSaveModal(false)}
                  disabled={saving}
                >
                  Continue Editing
                </button>
                <button
                  className={`px-3 py-1.5 rounded-md text-sm text-white ${saving ? 'bg-gray-400' : 'bg-black hover:bg-gray-800'}`}
                  onClick={handleSaveVersion}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditorPage({ params }: { params: { process: string } }) {
  return <EditorCore params={params} />;
}

// Very small markdown renderer without external deps
function renderBasicMarkdown(md: string): JSX.Element {
  const lines = (md || '').split(/\r?\n/);
  const out: JSX.Element[] = [];
  let listOpen = false;
  let codeOpen = false;
  let codeBuffer: string[] = [];
  lines.forEach((raw, idx) => {
    const line = raw as string;
    if (line.trim().startsWith('```')) {
      if (!codeOpen) {
        codeOpen = true;
        codeBuffer = [];
      } else {
        // close code
        out.push(
          <pre key={`code-${idx}`} className="bg-gray-50 border rounded p-2 overflow-auto text-xs whitespace-pre-wrap">
            {codeBuffer.join('\n')}
          </pre>
        );
        codeOpen = false;
        codeBuffer = [];
      }
      return;
    }
    if (codeOpen) {
      codeBuffer.push(line);
      return;
    }
    if (line.startsWith('# ')) {
      if (listOpen) { out.push(<ul key={`ul-close-${idx}`} />); listOpen = false; }
      out.push(<h3 key={`h1-${idx}`} className="text-lg font-semibold">{line.slice(2)}</h3>);
      return;
    }
    if (line.startsWith('## ')) {
      if (listOpen) { out.push(<ul key={`ul-close-${idx}`} />); listOpen = false; }
      out.push(<h4 key={`h2-${idx}`} className="text-base font-semibold">{line.slice(3)}</h4>);
      return;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!listOpen) { out.push(<ul key={`ul-open-${idx}`} className="list-disc ml-5" />); listOpen = true; }
      out.push(<li key={`li-${idx}`}>{line.slice(2)}</li>);
      return;
    }
    if (!line.trim()) {
      if (listOpen) { out.push(<ul key={`ul-close2-${idx}`} />); listOpen = false; }
      out.push(<div key={`br-${idx}`} className="h-2" />);
      return;
    }
    if (listOpen) { out.push(<ul key={`ul-close3-${idx}`} />); listOpen = false; }
    out.push(<p key={`p-${idx}`}>{line}</p>);
  });
  if (codeOpen) {
    out.push(
      <pre key={`code-end`} className="bg-gray-50 border rounded p-2 overflow-auto text-xs whitespace-pre-wrap">{codeBuffer.join('\n')}</pre>
    );
  }
  return <>{out}</>;
}

function DiffView({ left, right }: { left: string; right: string }) {
  const a = (left || '').split(/\r?\n/);
  const b = (right || '').split(/\r?\n/);
  const max = Math.max(a.length, b.length);
  const rows = [] as JSX.Element[];
  for (let i = 0; i < max; i++) {
    const L = a[i] ?? '';
    const R = b[i] ?? '';
    const equal = L === R;
    rows.push(
      <div key={i} className="grid grid-cols-2 gap-2 text-xs">
        <pre className={`border rounded p-1 whitespace-pre-wrap overflow-auto ${equal ? 'bg-white' : 'bg-red-50'}`}>{L}</pre>
        <pre className={`border rounded p-1 whitespace-pre-wrap overflow-auto ${equal ? 'bg-white' : 'bg-green-50'}`}>{R}</pre>
      </div>
    );
  }
  return <div className="space-y-1">{rows}</div>;
}

async function createPromptVersion(opts: {
  process: string;
  version: string;
  promptContent: string;
  title?: string;
  description?: string;
  author?: string;
  setAsActive?: boolean;
}) {
  const res = await fetch(`/api/admin/ai-prompts/processes/${encodeURIComponent(opts.process)}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: opts.version,
      promptContent: opts.promptContent,
      title: opts.title ?? undefined,
      description: opts.description ?? undefined,
      author: opts.author ?? 'ui',
      tags: [],
      metadata: {},
      setAsActive: !!opts.setAsActive,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to save version (${res.status})`);
  }
  const json = await res.json();
  if (!json?.success) throw new Error(json?.error || 'Failed to save version');
  return json.data;
}


function Chip({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="px-2.5 py-1 rounded-md border text-xs bg-white hover:bg-gray-50">
      {label}
    </button>
  );
}

// --- Parameters UI helpers ---
const CHAT_MODELS = [
  "gpt-4.1-2025-04-14",
  "gpt-4.1-mini-2025-04-14",
  "gpt-4.1-nano-2025-04-14",
  "gpt-4o-realtime-preview-2025-xx",
  "gpt-4o-audio-preview-2025-xx",
  "o4-mini-deep-research",
  "o4-mini-deep-research-2025-xx",
  "gpt-3.5-turbo-16k",
];

function PopoverContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute z-50 mt-2 w-[280px] rounded-md border border-gray-200 bg-white shadow-lg p-3">
      {children}
    </div>
  );
}

function MessageEditor({ m, onChange, onDelete }: { m: MessageBlock; onChange: (p: Partial<MessageBlock>) => void; onDelete?: () => void }) {
  const placeholder = m.role === 'user'
    ? 'Insert a user message'
    : m.role === 'assistant'
    ? 'Insert an assistant message'
    : m.role === 'system'
    ? 'Insert a system instruction'
    : 'Insert a tool message';
  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5 bg-gray-50">
        <select
          className="text-xs border rounded px-2 py-1 bg-white"
          value={m.role}
          onChange={(e) => onChange({ role: e.target.value as any })}
        >
          <option value="user">User</option>
          <option value="assistant">Assistant</option>
          <option value="system">System</option>
          <option value="tool">Tool</option>
        </select>
        {onDelete && (
          <button
            type="button"
            title="Remove message"
            aria-label="Remove message"
            className="inline-flex items-center justify-center text-xs border rounded px-2 py-1 hover:bg-gray-100"
            onClick={onDelete}
          >
            {/* minus-circle icon style using text to avoid extra deps */}
            <span className="text-base leading-none" aria-hidden>−</span>
          </button>
        )}
      </div>
      <textarea
        className="w-full p-3 text-sm min-h-[120px] outline-none"
        placeholder={placeholder}
        value={m.content}
        onChange={(e) => onChange({ content: e.target.value })}
      />
    </div>
  );
}
