"use client";
import Link from "next/link";
import React from "react";

export default function AISettingsIndexPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">AI Settings</h2>
      <p className="text-sm text-gray-600">Configure project flows, pipelines, AI steps, and IR schemas.</p>
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <Link className="text-blue-700 hover:underline" href="/maintenance/ai/settings/project-flows">
            Project Flows
          </Link>
        </li>
        <li>
          <Link className="text-blue-700 hover:underline" href="/maintenance/ai/settings/pipelines">
            Pipelines
          </Link>
        </li>
        <li>
          <Link className="text-blue-700 hover:underline" href="/maintenance/ai/settings/steps">
            AI Steps
          </Link>
        </li>
        <li>
          <Link className="text-blue-700 hover:underline" href="/maintenance/ai/settings/ir-schemas">
            IR Schemas
          </Link>
        </li>
      </ul>
    </div>
  );
}
