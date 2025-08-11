'use client';

import React from 'react';
import { WorkflowProvider } from '@/contexts/WorkflowContext';
import UnifiedAIWorkflow from '@/components/workflow/UnifiedAIWorkflow';
import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect root to the dashboard entry point
  redirect('/projects');
}
