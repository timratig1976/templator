"use client";
import React, { useEffect } from "react";
import ManageStepsPage from "@/app/maintenance/pipelines/manage-steps/page";

// Wrapper to expose the existing Manage Steps UI under the new Settings path
export default function AISettingsPipelinesManageStepsPage() {
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
      <h2 className="text-lg font-semibold">Manage Steps</h2>
      <div className="rounded border bg-white">
        <ManageStepsPage />
      </div>
    </div>
  );
}
