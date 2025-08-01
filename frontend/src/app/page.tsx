'use client';

import React from 'react';
import { WorkflowProvider } from '@/contexts/WorkflowContext';
import UnifiedAIWorkflow from '@/components/workflow/UnifiedAIWorkflow';

export default function Home() {
  return (
    <WorkflowProvider>
      <UnifiedAIWorkflow />
    </WorkflowProvider>
  );
}
