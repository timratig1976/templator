"use client";
import React, { useEffect, useState } from "react";

export default function AIOverviewPage() {
  const [processes, setProcesses] = useState<Array<{ name: string; title?: string }>>([]);
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await fetch('/api/admin/ai-prompts/processes');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted && json?.success && Array.isArray(json.data)) {
          setProcesses(json.data);
        }
      } catch {}
    };
    run();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-6">

      {/* KPI Widgets (placeholders; wire to real data later) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded border bg-white p-4">
          <div className="text-xs uppercase text-gray-500">Requests Today</div>
          <div className="mt-2 text-2xl font-semibold">--</div>
          <div className="mt-1 text-xs text-gray-400">All AI processes</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-xs uppercase text-gray-500">Success Rate</div>
          <div className="mt-2 text-2xl font-semibold">--%</div>
          <div className="mt-1 text-xs text-gray-400">Last 24h</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-xs uppercase text-gray-500">Avg Latency</div>
          <div className="mt-2 text-2xl font-semibold">-- ms</div>
          <div className="mt-1 text-xs text-gray-400">End-to-end</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-xs uppercase text-gray-500">Tokens Used</div>
          <div className="mt-2 text-2xl font-semibold">--</div>
          <div className="mt-1 text-xs text-gray-400">Input + Output</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-xs uppercase text-gray-500">Active Processes</div>
          <div className="mt-2 text-2xl font-semibold">--</div>
          <div className="mt-1 text-xs text-gray-400">Configured</div>
        </div>
      </div>

      {/* Two half sections: Settings and Optimization */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* AI Settings */}
        <section className="rounded border bg-white p-4">
          <h3 className="text-base font-semibold mb-2">AI Settings</h3>
          <p className="text-sm text-gray-600 mb-3">Configure pipelines, steps, and IR schemas.</p>
          <ul className="space-y-2 text-sm">
            <li>
              <a className="text-blue-700 hover:underline inline-flex items-center gap-2" href="/maintenance/ai/settings/pipelines">
                <span>🛠️</span>
                <span>Pipelines</span>
              </a>
            </li>
            <li>
              <a className="text-blue-700 hover:underline inline-flex items-center gap-2" href="/maintenance/ai/settings/steps">
                <span>🧩</span>
                <span>Steps</span>
              </a>
            </li>
            <li>
              <a className="text-blue-700 hover:underline inline-flex items-center gap-2" href="/maintenance/ai/settings/ir-schemas">
                <span>📐</span>
                <span>IR Schemas</span>
              </a>
            </li>
            <li>
              <a className="text-blue-700 hover:underline inline-flex items-center gap-2" href="/maintenance/ai/settings/pipelines/manage-steps">
                <span>⚙️</span>
                <span>Manage Steps</span>
              </a>
            </li>
            <li>
              <a className="text-blue-700 hover:underline inline-flex items-center gap-2" href="/maintenance/ai/settings/pipelines/runs">
                <span>🕒</span>
                <span>Pipeline Runs</span>
              </a>
            </li>
          </ul>
        </section>

        {/* AI Optimization */}
        <section className="rounded border bg-white p-4">
          <h3 className="text-base font-semibold mb-2">AI Optimization</h3>
          <p className="text-sm text-gray-600 mb-3">Analyze logs and manage the prompt library.</p>
          <ul className="space-y-2 text-sm">
            <li>
              <a className="text-blue-700 hover:underline inline-flex items-center gap-2" href="/maintenance/ai/optimization?view=logs">
                <span>📜</span>
                <span>Logs</span>
              </a>
            </li>
            <li>
              <a className="text-blue-700 hover:underline inline-flex items-center gap-2" href="/maintenance/ai/optimization/prompts">
                <span>📚</span>
                <span>Prompt Library</span>
              </a>
            </li>
            {/* subtle separator between static links and editor links */}
            <li role="separator" aria-hidden className="my-1"><span className="block border-t border-gray-200" /></li>
            {/* Dynamic AI process links */}
            {processes.map((p) => (
              <li key={p.name}>
                <a
                  className="text-blue-700 hover:underline inline-flex items-center gap-2"
                  href={`/maintenance/ai/optimization/${encodeURIComponent(p.name)}/editor`}
                  title={p.title || p.name}
                >
                  <span>🧠</span>
                  <span>{p.title || p.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
