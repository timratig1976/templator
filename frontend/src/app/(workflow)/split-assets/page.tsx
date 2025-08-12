"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import SplitAssetsManager from "@/components/SplitAssetsManager";

export default function SplitAssetsPage() {
  const search = useSearchParams();
  const splitId = search.get("splitId") || undefined;
  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Split Assets Manager</h1>
        <p className="text-sm text-gray-600">List, preview, and delete split parts.</p>
      </div>
      <SplitAssetsManager initialSplitId={splitId} />
    </div>
  );
}
