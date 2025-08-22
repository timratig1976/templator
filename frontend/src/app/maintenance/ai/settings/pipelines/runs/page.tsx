"use client";
import React, { useEffect } from "react";
import PipelineRunsPage from "@/app/maintenance/pipelines/runs/page";

export default function AISettingsPipelineRunsPage() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      try {
        const url = new URL(anchor.href, window.location.origin);
        if (url.pathname.startsWith("/maintenance/pipelines/")) {
          url.pathname = url.pathname.replace(
            "/maintenance/pipelines/",
            "/maintenance/ai/settings/pipelines/"
          );
          anchor.href = url.toString();
        } else if (url.pathname === "/maintenance/pipelines") {
          url.pathname = "/maintenance/ai/settings/pipelines";
          anchor.href = url.toString();
        }
      } catch {}
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pipeline Runs</h2>
      <div className="rounded border bg-white">
        <PipelineRunsPage />
      </div>
    </div>
  );
}
