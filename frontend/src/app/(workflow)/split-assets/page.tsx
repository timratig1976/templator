import React from "react";
import SplitAssetsPageClient from "./SplitAssetsPageClient";

// Disable static prerendering for this route; relies on runtime/backend and client-only APIs
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SplitAssetsPage({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const raw = searchParams?.splitId;
  const splitId = Array.isArray(raw) ? raw[0] : raw;
  return <SplitAssetsPageClient splitId={splitId} />;
}
