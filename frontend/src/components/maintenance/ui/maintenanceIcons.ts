// Centralized icons for Maintenance area (string-based)
// Use these in places that don't need exact SVGs
export const MAINTENANCE_ICONS = {
  home: "🏠",
  ai: "🤖",
  core: "🧰",
  buildTests: "🔧",
  deadCode: "🧹",
  testSuite: "🧪",
  qualityMetrics: "📊",
  aiDashboard: "📊",
  aiEditor: "✏️",
  aiLogs: "📜",
} as const;

export function iconForPath(pathname: string | null | undefined): string {
  const p = pathname || "";
  if (p === "/maintenance" || p === "/maintenance/") return MAINTENANCE_ICONS.home;
  if (p.startsWith("/maintenance/core/dead-code") || p.startsWith("/maintenance/dead-code")) return MAINTENANCE_ICONS.deadCode;
  if (p.startsWith("/maintenance/core/jest-tests")) return MAINTENANCE_ICONS.testSuite;
  if (p.startsWith("/maintenance/core/build-tests")) return MAINTENANCE_ICONS.buildTests;
  if (p.startsWith("/maintenance/core/metrics")) return MAINTENANCE_ICONS.qualityMetrics;
  if (p.startsWith("/maintenance/core")) return MAINTENANCE_ICONS.core;
  if (p.startsWith("/maintenance/ai/") && p.includes("/dashboard")) return MAINTENANCE_ICONS.aiDashboard;
  if (p.startsWith("/maintenance/ai/") && p.includes("/editor")) return MAINTENANCE_ICONS.aiEditor;
  if (p.startsWith("/maintenance/ai/") && p.includes("/log-view")) return MAINTENANCE_ICONS.aiLogs;
  if (p === "/maintenance/ai" || p.startsWith("/maintenance/ai")) return MAINTENANCE_ICONS.ai;
  return MAINTENANCE_ICONS.home;
}
