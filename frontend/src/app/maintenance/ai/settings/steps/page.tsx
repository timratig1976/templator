import React from "react";
import StepsPage from "@/app/maintenance/steps/page";

export default function AISettingsStepsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Steps</h2>
      <div className="rounded border bg-white">
        <StepsPage />
      </div>
    </div>
  );
}
