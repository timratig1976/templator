"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { WorkflowProvider } from "@/contexts/WorkflowContext";

export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const projectId = pathname?.split("/").find((seg, i, arr) => arr[i - 1] === "projects") || "";
  const inProject = !!projectId && /\/projects\/[^^/]+/.test(pathname || "");

  const designUploadId = search.get("designUploadId") || "";
  const splitId = search.get("splitId") || "";

  const stepLink = (step: string) => {
    const params = new URLSearchParams();
    if (designUploadId) params.set("designUploadId", designUploadId);
    if (splitId) params.set("splitId", splitId);
    return `/projects/${projectId}/${step}?${params.toString()}`;
  };

  const navItem = (label: string, step: string) => {
    const href = stepLink(step);
    const active = pathname?.includes(`/${step}`);
    return (
      <li>
        <Link
          className={`block px-3 py-2 rounded-md text-sm ${active ? "bg-blue-100 text-blue-900" : "text-gray-700 hover:bg-gray-100"}`}
          href={href}
        >
          {label}
        </Link>
      </li>
    );
  };

  return (
    <WorkflowProvider>
      <div className="min-h-screen">
        {/* Header removed per request to declutter (no Dashboard/Old UI menu) */}
        <main className="p-4 bg-gray-50 min-h-screen">
          {inProject && (
            <nav className="max-w-screen-2xl mx-auto mb-4">
              <ol className="flex items-center gap-2 text-sm">
                {navItem('Upload', 'upload')}
                <span className="text-gray-400">/</span>
                {navItem('Split', 'split')}
                <span className="text-gray-400">/</span>
                {navItem('Plan', 'plan')}
                <span className="text-gray-400">/</span>
                {navItem('Generate', 'generate')}
              </ol>
            </nav>
          )}
          <div className="max-w-screen-xl mx-auto px-2 md:px-4">
            {children}
          </div>
        </main>
        <footer className="w-full border-t bg-white">
          <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-end">
            <Link href="/old" className="text-xs text-gray-600 hover:text-gray-800 underline">Old UI</Link>
          </div>
        </footer>
      </div>
    </WorkflowProvider>
  );
}
