"use client";
import React from "react";
// Reuse the existing editor implementation via non-routing backup alias
import LegacyEditor from "@/legacy/ai/process-editor-legacy";

export default function MaintenanceEditorPage(props: { params: { process: string } }) {
  return <LegacyEditor {...(props as any)} />;
}
