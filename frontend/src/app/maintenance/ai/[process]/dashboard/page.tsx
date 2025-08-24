"use client";
import React from "react";

export default function DashboardPage({ params }: { params: { process: string } }) {
  return (
    <div className="space-y-6">
      {/* Duplicate headline removed; layout-level headline is used */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-md p-4">
          <div className="text-sm text-gray-500 mb-2">% Positive</div>
          <div className="h-40 flex items-center justify-center text-gray-400">chart placeholder</div>
        </div>
        <div className="border rounded-md p-4">
          <div className="text-sm text-gray-500 mb-2">Logs</div>
          <div className="h-40 flex items-center justify-center text-gray-400">chart placeholder</div>
        </div>
      </div>
      <div className="border rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-500">Versions</div>
          <button className="text-sm px-3 py-1.5 border rounded-md">Show diff</button>
        </div>
        <div className="h-24 flex items-center justify-center text-gray-400">versions table placeholder</div>
      </div>
    </div>
  );
}
