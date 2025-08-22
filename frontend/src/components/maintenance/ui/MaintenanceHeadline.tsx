"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { iconForPath } from "./maintenanceIcons";

function titleForPath(p: string): string {
  if (!p) return "Maintenance";
  if (p === "/maintenance" || p === "/maintenance/") return "Maintenance Overview";

  // Core
  if (p.startsWith("/maintenance/core/dead-code")) return "Dead Code";
  if (p.startsWith("/maintenance/core/jest-tests")) return "Test Suite";
  if (p.startsWith("/maintenance/core/build-tests")) return "Build Tests";
  if (p.startsWith("/maintenance/core/metrics")) return "Quality Metrics";
  if (p.startsWith("/maintenance/core")) return "Core Overview";

  // AI
  if (p.startsWith("/maintenance/ai/system")) return "AI System";
  if (p.startsWith("/maintenance/ai/settings")) return "AI Settings";
  if (p.startsWith("/maintenance/ai/optimization")) return "AI Optimization";
  if (p.startsWith("/maintenance/ai/pipelines")) return "Pipelines";
  if (p.startsWith("/maintenance/ai/steps")) return "Steps";
  if (p.startsWith("/maintenance/ai/prompts")) return "Prompts";
  // AI process subroutes
  if (p.startsWith("/maintenance/ai/") && p.includes("/dashboard")) return "AI Dashboard";
  if (p.startsWith("/maintenance/ai/") && p.includes("/editor")) return "AI Editor";
  if (p.startsWith("/maintenance/ai/") && p.includes("/log-view")) return "AI Logs";
  if (p === "/maintenance/ai" || p === "/maintenance/ai/") return "AI Overview";

  // Fallback
  return "Maintenance";
}

export default function MaintenanceHeadline() {
  const pathname = usePathname();
  const icon = iconForPath(pathname);
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-xl leading-none select-none">{icon}</span>
        <h2 className="text-xl font-semibold text-gray-900">{titleForPath(pathname)}</h2>
      </div>
    </div>
  );
}

