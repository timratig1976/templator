"use client";
import Link from "next/link";
import React from "react";
import { useSearchParams } from "next/navigation";
import ComprehensiveAILogs from "@/components/optimization/ComprehensiveAILogs";

export default function AIOptimizationIndexPage() {
  const sp = useSearchParams();
  const view = sp.get("view");
  const showLogs = view === "logs";
  return (
    <div className="space-y-4">
      {!showLogs && (
        <>
          <h2 className="text-lg font-semibold">AI Optimization</h2>
          <p className="text-sm text-gray-600">Analyze logs and manage prompt library to improve AI performance.</p>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>
              <Link className="text-blue-700 hover:underline" href="/maintenance/ai/optimization/logs">
                Logs (All Processes)
              </Link>
            </li>
            <li>
              <Link className="text-blue-700 hover:underline" href="/maintenance/ai/optimization/prompts">
                Prompt Library
              </Link>
            </li>
          </ul>
        </>
      )}
      {showLogs && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">Global Logs — All Processes</div>
            <Link className="text-sm text-blue-700 hover:underline" href="/maintenance/ai/optimization">Back</Link>
          </div>
          <ComprehensiveAILogs />
        </div>
      )}
    </div>
  );
}
