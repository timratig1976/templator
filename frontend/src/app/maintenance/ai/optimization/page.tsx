import Link from "next/link";
import React from "react";

export default function AIOptimizationIndexPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">AI Optimization</h2>
      <p className="text-sm text-gray-600">Analyze logs and manage prompt library to improve AI performance.</p>
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <Link className="text-blue-700 hover:underline" href="/maintenance/ai/optimization/logs">
            Logs
          </Link>
        </li>
        <li>
          <Link className="text-blue-700 hover:underline" href="/maintenance/ai/optimization/prompts">
            Prompt Library
          </Link>
        </li>
      </ul>
    </div>
  );
}
