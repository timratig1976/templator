import React from "react";
import IRSchemasPage from "@/app/maintenance/ir-schemas/page";

export default function AISettingsIRSchemasPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">IR Schemas</h2>
      <div className="rounded border bg-white">
        <IRSchemasPage />
      </div>
    </div>
  );
}
