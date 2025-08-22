'use client';
import React from 'react';
import { MaintenanceDashboard } from '../../../../components/maintenance';

export default function AISystemPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <a href="/maintenance/ai/system" className="inline-flex items-center gap-2 text-blue-700 hover:underline">
          <span>🤖</span>
          <span>AI System</span>
        </a>
        <a href="/maintenance/ai/optimization/prompts" className="inline-flex items-center gap-2 text-blue-700 hover:underline">
          <span>📚</span>
          <span>Prompt Library</span>
        </a>
        
        <span className="text-gray-300">|</span>
        <a href="/maintenance/ai/settings/pipelines" className="inline-flex items-center gap-2 text-blue-700 hover:underline">
          <span>🛠️</span>
          <span>Pipelines</span>
        </a>
        <a href="/maintenance/ai/settings/steps" className="inline-flex items-center gap-2 text-blue-700 hover:underline">
          <span>🧩</span>
          <span>Steps</span>
        </a>
        <a href="/maintenance/ai/settings/ir-schemas" className="inline-flex items-center gap-2 text-blue-700 hover:underline">
          <span>📐</span>
          <span>IR Schemas</span>
        </a>
        <a href="/maintenance/dead-code" className="inline-flex items-center gap-2 text-blue-700 hover:underline">
          <span>🧹</span>
          <span>Dead Code</span>
        </a>
      </div>

      <MaintenanceDashboard initialTab="ai-system" />
    </div>
  );
}
