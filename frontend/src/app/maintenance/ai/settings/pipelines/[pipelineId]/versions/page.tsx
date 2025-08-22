import React from "react";
import PipelineVersionsPage from "@/app/maintenance/pipelines/[pipelineId]/versions/[version]/page";

// Note: The original versions listing may be inside the version page or a sibling.
// If there is a dedicated listing, replace the import accordingly.
export default function AISettingsPipelineVersionsIndexFallback() {
  // Fallback: if no separate versions index exists, we can show a helpful notice
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pipeline Versions</h2>
      <div className="rounded border bg-white p-4 text-sm text-gray-600">
        Select a specific version to view details. If you navigated here directly, please use the Pipelines page to choose a pipeline and version.
      </div>
    </div>
  );
}
