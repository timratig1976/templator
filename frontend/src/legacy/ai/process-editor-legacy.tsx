import React from "react";

// Minimal legacy editor shim to satisfy imports in pages that still reference it.
// This component intentionally renders nothing significant and should be
// replaced/removed once all usages are migrated to the new editor.
export type LegacyEditorProps = {
  // Accept any props to avoid strict typing issues in legacy call sites
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

const LegacyEditor: React.FC<LegacyEditorProps> = () => {
  return (
    <div style={{ display: "none" }} aria-hidden>
      Legacy Process Editor (shim)
    </div>
  );
};

export default LegacyEditor;
