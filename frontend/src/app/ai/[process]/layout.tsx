"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";

// Shared AI layout with Humanloop-style tabs
// Routes under /ai/[process]/: dashboard | editor | logs | evals
export default function AILayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { process: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const base = `/ai/${params.process}`;
  const [processes, setProcesses] = useState<Array<{ name: string; title?: string }>>([]);
  const [loadingProc, setLoadingProc] = useState(false);

  const tabs = [
    { href: `${base}/dashboard`, label: "Dashboard" },
    { href: `${base}/editor`, label: "Editor" },
    { href: `${base}/log-view`, label: "Logs" },
  ];

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoadingProc(true);
      try {
        const res = await fetch('/api/admin/ai-prompts/processes');
        if (!res.ok) throw new Error(`Failed to load processes: ${res.status}`);
        const json = await res.json();
        if (mounted && json?.success && Array.isArray(json.data)) {
          setProcesses(json.data);
        }
      } catch (e) {
        // Silent fail – sidebar is optional
      } finally {
        mounted = false; setLoadingProc(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="ai-layout">
      <header className="sticky top-0 z-20 bg-white border-b">
        <div className="mx-auto max-w-[1500px] px-4 py-3 flex items-center justify-between gap-4">
          <div className="font-medium text-gray-700 truncate">
            <span className="text-gray-400">Process:</span> <span className="font-semibold">{params.process}</span>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex gap-2">
              {tabs.map((t) => {
                const active = pathname?.startsWith(t.href);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`px-3 py-1.5 rounded-md border text-sm ${
                      active
                        ? "bg-gray-100 border-gray-300 text-gray-900"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>
            {/* Readme toggle in header */}
            <button
              className="px-3 py-1.5 rounded-md border bg-white text-sm hover:bg-gray-50"
              onClick={() => {
                const isEditor = pathname?.startsWith(`${base}/editor`);
                if (!isEditor) {
                  router.push(`${base}/editor?readme=1`);
                  return;
                }
                const sp = new URLSearchParams(searchParams.toString());
                if (sp.get('readme') === '1') {
                  sp.delete('readme');
                } else {
                  sp.set('readme', '1');
                }
                const qs = sp.toString();
                router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
              }}
            >
              Readme
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left quick navigation for AI processes */}
          <aside className="hidden lg:block col-span-2">
            <div className="border rounded-md bg-white">
              <div className="px-3 py-2 border-b text-xs uppercase text-gray-500">AI Processes</div>
              <nav className="p-2 space-y-1 max-h-[70vh] overflow-auto">
                {processes.map((p) => {
                  const isActiveProc = p.name === params.process;
                  return (
                    <Link
                      key={p.name}
                      href={`/ai/${p.name}/editor`}
                      className={`block px-2.5 py-1.5 rounded-md text-sm ${
                        isActiveProc ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      title={p.title || p.name}
                    >
                      <span className="font-medium">{p.title || p.name}</span>
                      {isActiveProc && <span className="ml-2 text-xs text-gray-500">(current)</span>}
                    </Link>
                  );
                })}
                {(!processes || processes.length === 0) && (
                  <div className="px-2.5 py-2 text-sm text-gray-500">{loadingProc ? 'Loading…' : 'No processes'}</div>
                )}
              </nav>
            </div>
          </aside>

          {/* Right content area */}
          <section className="col-span-12 lg:col-span-10">
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
