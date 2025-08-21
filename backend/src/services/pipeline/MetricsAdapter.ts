/**
 * MetricsAdapter
 * Bridges to existing quality analyzers and returns normalized metric results.
 * Currently stubbed; respects feature flags and returns empty results when disabled.
 */

import { getFeatureFlags } from '../../config/featureFlags';

export interface MetricResultRecord {
  key: string; // e.g., latency_ms, html_validity
  value: number | string;
  passed?: boolean;
  details?: Record<string, any>;
}

export class MetricsAdapter {
  async evaluate(stepVersionId: string, context: Record<string, any>, ir?: Record<string, any>): Promise<MetricResultRecord[]> {
    const flags = getFeatureFlags();
    if (!flags.PIPELINE_LOGGING_ENABLED) return [];

    // TODO: Select metric profile for stepVersionId and invoke existing analyzers.
    return [];
  }
}
