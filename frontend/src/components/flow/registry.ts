// Registry for ultra-specific step UIs. Stage 1: keep empty.
// Usage: register components with a stable render key in future stages.

import React from "react";

export type StepOverrideProps = {
  flowId: string;
  phaseStepId: string;
  step: {
    id: string;
    stepId: string;
    title: string;
    stepKey: string | null;
    orderIndex: number;
    executionMode: "manual" | "auto";
    actions: string[];
    params: Record<string, any>;
    pinnedStepVersionId: string | null;
  };
  onAction: (action: string, payload?: { comment?: string; input?: Record<string, any> }) => Promise<void>;
};

export type StepOverrideComponent = React.ComponentType<StepOverrideProps>;

const registry: Record<string, StepOverrideComponent> = {};

export function getOverrideComponent(renderKey?: string | null): StepOverrideComponent | undefined {
  if (!renderKey) return undefined;
  return registry[renderKey];
}

export function registerOverride(renderKey: string, component: StepOverrideComponent) {
  registry[renderKey] = component;
}

export default registry;
