import { aiLogger } from '@/services/aiLogger';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3009';

export interface PipelineRunSummary {
  id: string;
  pipelineName: string | null;
  version: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
  startedAt: string | null;
  finishedAt: string | null;
  summary?: Record<string, unknown> | null;
  stepsCount?: number;
}

export interface StepRunSummary {
  id: string;
  nodeKey: string | null;
  stepVersion: number | null;
  definitionKey: string | null;
  definitionName: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
  startedAt: string | null;
  finishedAt: string | null;
  error?: string | null;
  irCount?: number;
  metricCount?: number;
  outputCount?: number;
}

export interface MetricResult {
  id: string;
  metricKey: string | null;
  value: number | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface IRArtifactPreview {
  id: string;
  schemaKey: string | null;
  version: number | null;
  payloadPreview?: Record<string, unknown> | null;
  createdAt: string;
}

export interface StepRunDetail extends StepRunSummary {
  irPreview?: IRArtifactPreview | null;
  metricResults?: MetricResult[];
  outputLinks?: Array<{ id: string; key: string | null; value: string | null; createdAt: string }>;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Request failed ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    aiLogger.error('system', 'Monitoring API request failed', { url, error: String(err) });
    throw err;
  }
}

export const pipelineMonitoringService = {
  async listRuns(): Promise<{ enabled: boolean; runs: PipelineRunSummary[] }> {
    return http('/api/monitoring/pipelines/runs');
  },

  async listStepRuns(pipelineRunId: string): Promise<{ enabled: boolean; steps: StepRunSummary[] }> {
    return http(`/api/monitoring/pipelines/runs/${encodeURIComponent(pipelineRunId)}/steps`);
  },

  async getStepRun(stepRunId: string): Promise<{ enabled: boolean; step: StepRunDetail | null }> {
    return http(`/api/monitoring/pipelines/steps/${encodeURIComponent(stepRunId)}`);
  },
};
