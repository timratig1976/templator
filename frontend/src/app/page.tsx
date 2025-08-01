'use client';

import React from 'react';
import { WorkflowProvider } from '@/contexts/WorkflowContext';
import MainWorkflow from '@/components/workflow/MainWorkflow';

export default function Home() {
  return (
    <WorkflowProvider>
      <MainWorkflow />
    </WorkflowProvider>
  );
}
