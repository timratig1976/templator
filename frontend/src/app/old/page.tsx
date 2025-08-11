'use client';

import React from 'react';
import { WorkflowProvider } from '@/contexts/WorkflowContext';
import UnifiedAIWorkflow from '@/components/workflow/UnifiedAIWorkflow';

export default function LegacyOldHome() {
  return (
    <div className="p-4">
      <div className="mb-4 p-3 rounded border bg-yellow-50 text-yellow-800 text-sm">
        This is the legacy single-page/accordion workflow. The new multi-page workflow is available under the Projects dashboard.
      </div>
      <WorkflowProvider>
        <UnifiedAIWorkflow />
      </WorkflowProvider>
    </div>
  );
}
