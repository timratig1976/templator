/**
 * PipelineStepExecutor
 * Thin orchestration wrapper that composes existing services.
 * - Reuse-first: calls existing AI/module/quality services
 * - Safe by default: no-ops when PIPELINE_LOGGING_ENABLED=false
 */

import { getFeatureFlags } from '../../config/featureFlags';
import prisma from '../database/prismaClient';
import { IRValidationAdapter } from './IRValidationAdapter';
import { MetricsAdapter } from './MetricsAdapter';
import { OutputLinker, OutputRef } from './OutputLinker';

export interface StepExecutionParams {
  stepVersionId: string;
  nodeKey: string;
  config?: Record<string, any>;
  pipelineRunId?: string; // when provided, enables shadow writes for StepRun/IR/Metrics/Links
  context: {
    // Domain context identifiers
    designSplitId?: string;
    projectId?: string;
    artifactId?: string;
    moduleId?: string;
    // Prompt/process context
    processId?: string;
    promptId?: string;
  };
}

export interface StepExecutionResult {
  skipped: boolean;
  reason?: string;
  // IR object produced by the step
  ir?: Record<string, any>;
  // IDs of created/updated domain records
  outputs?: Array<{ targetType: string; targetId: string }>;
}

export class PipelineStepExecutor {
  async execute(params: StepExecutionParams): Promise<StepExecutionResult> {
    const flags = getFeatureFlags();
    if (!flags.PIPELINE_LOGGING_ENABLED) {
      return { skipped: true, reason: 'PIPELINE_LOGGING_DISABLED' };
    }

    // TODO: Map stepVersionId to the appropriate existing service call.
    // For now, simulate a step result to keep behavior inert while enabling shadow writes when pipelineRunId is present.
    const result: StepExecutionResult = {
      skipped: false,
      ir: { _note: 'stub-ir', nodeKey: params.nodeKey },
      outputs: [],
    };

    // Shadow writes (guarded) only if caller supplies a pipelineRunId
    if (!params.pipelineRunId) {
      return result;
    }

    let stepRunId: string | undefined;
    try {
      const stepRun = await (prisma as any).stepRun.create({
        data: {
          pipelineRunId: params.pipelineRunId,
          stepVersionId: params.stepVersionId,
          nodeKey: params.nodeKey,
          status: 'completed',
          completedAt: new Date(),
          params: { config: params.config ?? {}, context: params.context },
        },
        select: { id: true },
      });
      stepRunId = stepRun.id;
    } catch (_err) {
      // Swallow errors to avoid impacting existing flows if migrations not applied
      // Optionally log in the future
      return result; // cannot persist downstream artifacts without a StepRun
    }

    // Validate and persist IR
    if (stepRunId && result.ir) {
      try {
        const validator = new IRValidationAdapter();
        const v = await validator.validateIR(params.stepVersionId, result.ir);
        // Shadow persist IR artifact
        await (prisma as any).iRArtifact.create({
          data: {
            stepRunId,
            irJson: result.ir,
            isValid: v.isValid,
            validationErrors: v.errors ? v.errors : null,
          },
        });
      } catch (_err) {
        // ignore
      }
    }

    // Evaluate and persist metrics
    try {
      const metricsAdapter = new MetricsAdapter();
      const metrics = await metricsAdapter.evaluate(params.stepVersionId, params.context, result.ir);
      if (metrics && metrics.length && stepRunId) {
        await (prisma as any).metricResult.createMany({
          data: metrics.map((m) => ({
            stepRunId,
            metricKey: m.key,
            value: typeof m.value === 'number' ? m.value : null,
            stringValue: typeof m.value === 'string' ? m.value : null,
            passed: m.passed ?? null,
            details: m.details ?? {},
          })),
          skipDuplicates: true,
        });
      }
    } catch (_err) {
      // ignore
    }

    // Link outputs if any
    if (result.outputs && result.outputs.length && stepRunId) {
      try {
        const linker = new OutputLinker();
        await linker.link(stepRunId, result.outputs as OutputRef[]);
      } catch (_err) {
        // ignore
      }
    }

    return result;
  }
}
