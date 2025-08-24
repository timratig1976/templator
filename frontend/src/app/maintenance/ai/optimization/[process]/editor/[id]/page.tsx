"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function EditorPageWithId({ params }: { params: { process: string } }) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const sp = useSearchParams();
  const id = Array.isArray(routeParams?.id) ? routeParams.id[0] : routeParams?.id;
  const runId = sp.get('runId');

  React.useEffect(() => {
    if (!id) return;
    const qs = new URLSearchParams();
    qs.set("promptId", id);
    if (runId) qs.set("runId", runId);
    router.replace(`/maintenance/ai/optimization/${encodeURIComponent(params.process)}/editor?${qs.toString()}`);
  }, [id, runId, params.process, router]);

  return null;
}
