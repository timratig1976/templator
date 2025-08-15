"use client";

import React, { useMemo, useState } from 'react';
import { useBuildTestRealtime } from '../hooks/useBuildTestRealtime';
import type { BuildTestProgressEvent } from '../hooks/useBuildTestRealtime';

const ProgressBar: React.FC<{ value: number }> = ({ value }) => (
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div
      className="bg-blue-600 h-2 rounded-full transition-all"
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

export const BuildTestRealtimePanel: React.FC = () => {
  const { events, latest, connected, subscribe, clear } = useBuildTestRealtime();
  const [running, setRunning] = useState(false);

  const byPhase = useMemo(() => {
    const map = new Map<string, BuildTestProgressEvent>();
    events.forEach((e) => map.set(e.phase, e));
    return map;
  }, [events]);

  const config = byPhase.get('config')?.details as any | undefined;
  const scan = byPhase.get('scan:done')?.details as any | undefined;
  const changes = byPhase.get('changes:done')?.details as any | undefined;
  const compile = byPhase.get('compile:done')?.details as any | undefined;
  const analyze = byPhase.get('analyze:done')?.details as any | undefined;
  const health = byPhase.get('health:done')?.details as any | undefined;
  const report = byPhase.get('report:done')?.details as any | undefined;
  const complete = byPhase.get('complete')?.details as any | undefined;

  const onRun = async () => {
    try {
      setRunning(true);
      clear();
      subscribe();
      await fetch('/api/build-test/run', { method: 'POST' });
    } catch (e) {
      console.error('Failed to trigger build test', e);
    } finally {
      // Release the button after a short delay to avoid flicker; completion will show via progress
      setTimeout(() => setRunning(false), 800);
    }
  };

  const progressValue = latest?.progress ?? 0;

  return (
    <div className="bg-white rounded-lg shadow p-0 overflow-hidden">
      {/* Start Panel - full width, compact */}
      <div className="w-full bg-gray-50 border-b px-4 py-3 flex flex-wrap items-center gap-3">
        <h3 className="text-base font-semibold text-gray-900 mr-auto">⚡ Realtime Build Test</h3>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
          title={connected ? 'Socket connected' : 'Socket disconnected'}
        >
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        <button
          onClick={subscribe}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
          title="Subscribe to build-test progress"
        >
          Subscribe
        </button>
        <button
          onClick={clear}
          className="text-xs text-gray-600 hover:text-gray-800 underline"
          title="Clear events"
        >
          Clear
        </button>
        <button
          onClick={onRun}
          disabled={running}
          className={`text-xs px-3 py-1 rounded border ${running ? 'bg-gray-200 text-gray-500 border-gray-300' : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'}`}
          title="Run build test"
        >
          {running ? 'Running…' : 'Run Build Test'}
        </button>
      </div>

      {/* Current status */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Current Phase</span>
          <span className="text-sm font-medium text-gray-900">{latest?.phase || '—'}</span>
        </div>
        <ProgressBar value={progressValue} />
        {latest?.message && (
          <div className="mt-2 text-sm text-gray-700">{latest.message}</div>
        )}
      </div>

      {/* Details grid */}
      <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Suites/Config */}
        <div className="border rounded p-4">
          <div className="text-sm font-semibold text-gray-800 mb-2">Suites / Directories</div>
          {!config && <div className="text-sm text-gray-500">No configuration yet.</div>}
          {config && (
            <div className="text-xs text-gray-700 space-y-2">
              <div><span className="font-medium">Watch:</span> {config.watchDirectories?.length || 0} directories</div>
              <ul className="list-disc pl-5 max-h-28 overflow-auto">
                {config.watchDirectories?.map((d: string) => (
                  <li key={d} className="truncate" title={d}>{d}</li>
                ))}
              </ul>
              <div className="pt-2"><span className="font-medium">Exclude patterns:</span></div>
              <ul className="list-disc pl-5">
                {config.excludePatterns?.map((p: string) => (
                  <li key={p} className="truncate" title={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Scan summary */}
        <div className="border rounded p-4">
          <div className="text-sm font-semibold text-gray-800 mb-2">Files Scanned</div>
          {!scan && <div className="text-sm text-gray-500">Waiting for scan…</div>}
          {scan && (
            <div className="text-xs text-gray-700">
              <div className="mb-2">Total: <span className="font-medium">{scan.totalFiles}</span></div>
              <div className="border rounded max-h-40 overflow-auto">
                <ul className="divide-y">
                  {(scan.sample || []).map((f: string) => (
                    <li key={f} className="px-2 py-1 font-mono truncate" title={f}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Changes */}
        <div className="border rounded p-4">
          <div className="text-sm font-semibold text-gray-800 mb-2">Changes</div>
          {!changes && <div className="text-sm text-gray-500">Waiting for change detection…</div>}
          {changes && (
            <div className="text-xs text-gray-700 grid grid-cols-2 gap-4">
              <div>
                <div className="font-medium mb-1">New Files ({changes.newCount})</div>
                <ul className="list-disc pl-5 max-h-32 overflow-auto">
                  {changes.newFiles?.map((f: string) => (
                    <li key={f} className="font-mono truncate" title={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium mb-1">Modified Files ({changes.modifiedCount})</div>
                <ul className="list-disc pl-5 max-h-32 overflow-auto">
                  {changes.modifiedFiles?.map((f: string) => (
                    <li key={f} className="font-mono truncate" title={f}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Compile/Errors */}
        <div className="border rounded p-4">
          <div className="text-sm font-semibold text-gray-800 mb-2">Compilation</div>
          {!compile && <div className="text-sm text-gray-500">Waiting for compile…</div>}
          {compile && (
            <div className="text-xs text-gray-700 space-y-2">
              <div><span className="font-medium">Success:</span> {String(compile.success)}</div>
              <div><span className="font-medium">Errors:</span> {compile.errorCount} | <span className="font-medium">Warnings:</span> {compile.warningCount}</div>
              {analyze?.topErrors?.length ? (
                <div>
                  <div className="font-medium mb-1">Top Errors</div>
                  <div className="border rounded max-h-40 overflow-auto">
                    <ul className="divide-y">
                      {analyze.topErrors.map((er: any, i: number) => (
                        <li key={i} className="px-2 py-1">
                          <div className="font-mono text-[11px] text-gray-800 truncate" title={`${er.file}:${er.line}:${er.column}`}>{er.file}:{er.line}:{er.column}</div>
                          <div className="text-[11px] text-red-700">[{er.code}] {er.message}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Health */}
        <div className="border rounded p-4">
          <div className="text-sm font-semibold text-gray-800 mb-2">Service Health</div>
          {!health && <div className="text-sm text-gray-500">Waiting for health…</div>}
          {health && (
            <div className="text-xs text-gray-700">
              <ul className="grid grid-cols-2 gap-2">
                {Object.entries(health.summary || {}).map(([phase, data]: any) => (
                  <li key={phase} className="border rounded px-2 py-1 flex items-center justify-between">
                    <span className="font-medium">{phase}</span>
                    <span className="text-[11px] text-gray-600">{data.status} • files {data.fileCount} • errors {data.errorCount}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Summary & Report */}
        <div className="border rounded p-4">
          <div className="text-sm font-semibold text-gray-800 mb-2">Summary</div>
          {!complete && <div className="text-sm text-gray-500">Waiting for completion…</div>}
          {complete && (
            <div className="text-xs text-gray-700 space-y-2">
              <div>Success: <span className="font-medium">{String(complete.success)}</span></div>
              <div>Files: <span className="font-medium">{complete.files}</span> • Errors: {complete.errors} • Warnings: {complete.warnings}</div>
              {report?.reportFile && (
                <div>
                  Report: <a className="text-blue-600 hover:text-blue-800 underline" href={`/_internal/file?path=${encodeURIComponent(report.reportFile)}`} target="_blank" rel="noreferrer">Open JSON</a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Event stream */}
        <div className="lg:col-span-2">
          <div className="text-sm font-medium text-gray-700 mb-2">Event Stream</div>
          <div className="max-h-64 overflow-y-auto border rounded">
            <ul className="divide-y">
              {events.length === 0 && (
                <li className="p-3 text-sm text-gray-500">No events yet. Trigger a build test to see updates.</li>
              )}
              {events.slice().reverse().map((e, idx) => (
                <li key={idx} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-900">{e.phase}</div>
                    <div className="text-xs text-gray-500">{new Date(e.timestamp || Date.now()).toLocaleTimeString()}</div>
                  </div>
                  <div className="text-sm text-gray-700">{e.message}</div>
                  <div className="mt-1">
                    <ProgressBar value={e.progress} />
                  </div>
                  {e.details && (
                    <pre className="mt-2 bg-gray-50 p-2 rounded text-xs text-gray-600 overflow-x-auto">{JSON.stringify(e.details, null, 2)}</pre>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildTestRealtimePanel;
