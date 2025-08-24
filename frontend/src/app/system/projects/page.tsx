import React from "react";
import ProjectsDashboardPageClient from "./ProjectsDashboardPageClient";

// Disable static prerendering for this route; relies on client-only/runtime data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ProjectsDashboardPage() {
  return <ProjectsDashboardPageClient />;
}
