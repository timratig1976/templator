"use client";
import React, { useEffect } from "react";
import PipelinesPage from "@/app/maintenance/pipelines/page";

export default function AISettingsPipelinesPage() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      try {
        const url = new URL(anchor.href, window.location.origin);
        // Rewrite old maintenance paths to new AI Settings namespace
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
      {/* Rely on layout-level headline; render PipelinesPage directly without white wrapper */}
      <PipelinesPage />
    </div>
  );
}
