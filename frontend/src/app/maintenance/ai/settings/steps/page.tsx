import React from "react";
import Link from "next/link";
import StepsPage from "@/app/maintenance/steps/page";

export default function AISettingsStepsPage({
  searchParams,
}: {
  searchParams?: { context?: string; flowId?: string };
}) {
  const context = searchParams?.context;
  const flowId = searchParams?.flowId;
  const managePhasesHref = flowId
    ? `/maintenance/ai/settings/project-flows/${flowId}/phases?context=project-flow`
    : `/maintenance/ai/settings/project-flows`;

  return (
    <div className="space-y-4">
      {context === "project-flow" && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          You are in Project Flow context. Domain phases are managed separately from AI Step definitions.
          {" "}
          <Link className="underline font-medium" href={managePhasesHref}>
            Manage Domain Phases
          </Link>
        </div>
      )}
      {/* Duplicate headline removed; layout-level headline is used */}
      {/* Wrapper removed to avoid white top background */}
      <StepsPage />
    </div>
  );
}
