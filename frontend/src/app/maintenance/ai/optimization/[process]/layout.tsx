"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";

// Optimization AI layout with tabs: dashboard | editor | log-view
export default function OptimizationProcessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { process: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const base = `/maintenance/ai/optimization/${params.process}`;
  const [processes, setProcesses] = useState<Array<{ name: string; title?: string }>>([]);
  const [loadingProc, setLoadingProc] = useState(false);

  const tabs = [
    { href: `${base}/dashboard`, label: "Dashboard" },
    { href: `${base}/editor`, label: "Editor" },
    { href: `${base}/log-view`, label: "Logs" },
  ];

  // Click interceptor to rewrite legacy /ai/[process] links
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      try {
        const url = new URL(anchor.href, window.location.origin);
        const legacyPrefix = `/ai/${params.process}`;
        if (url.pathname.startsWith(legacyPrefix)) {
          url.pathname = url.pathname.replace(
            legacyPrefix,
            `/maintenance/ai/optimization/${params.process}`
          );
          anchor.href = url.toString();
        }
      } catch {}
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [params.process]);

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
          <div className="flex items-center gap-3 min-w-0">
            <label htmlFor="process-select" className="text-sm text-gray-500 shrink-0">Optimization Process</label>
            <select
              id="process-select"
              className="max-w-[320px] truncate px-2 py-1.5 border rounded-md bg-white text-sm text-gray-800"
              value={params.process}
              onChange={(e) => {
                const next = e.target.value;
                const prefix = `/maintenance/ai/optimization/${params.process}`;
                // keep current tab/suffix if present; default to /editor
                let suffix = pathname?.startsWith(prefix) ? pathname!.slice(prefix.length) : '';
                if (!suffix || suffix === '/') suffix = '/editor';
                router.push(`/maintenance/ai/optimization/${next}${suffix}`);
              }}
            >
              {processes.map((p) => (
                <option key={p.name} value={p.name}>{p.title || p.name}</option>
              ))}
            </select>
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
        <section>
          {children}
        </section>
      </main>
    </div>
  );
}
