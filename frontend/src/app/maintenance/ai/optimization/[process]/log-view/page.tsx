"use client";
import React from "react";
import ComprehensiveAILogs from "@/components/optimization/ComprehensiveAILogs";

export default function OptimizationLogsPage({ params }: { params: { process: string } }) {
  const { process } = params;
  return (
    <div className="space-y-4">
      {/* Rely on layout headline; no local h1 */}
      <ComprehensiveAILogs process={process} />
    </div>
  );
}
