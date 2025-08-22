import React from "react";
import PipelineRunDetailPage from "@/app/maintenance/pipelines/runs/[id]/page";

export default function AISettingsPipelineRunDetailPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pipeline Run</h2>
      <div className="rounded border bg-white">
        <PipelineRunDetailPage />
      </div>
    </div>
  );
}
