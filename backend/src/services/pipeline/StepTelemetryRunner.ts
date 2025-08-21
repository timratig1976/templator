import TelemetryHelper, { MetricInput } from './TelemetryHelper'

export interface StepExecutorResult {
  ir?: Record<string, any>
  metrics?: Omit<MetricInput, 'stepRunId'>[]
  outputs?: { targetType: string; targetId: string; meta?: Record<string, any> }[]
  status?: 'completed' | 'failed'
  error?: string | null
}

export interface RunStepOptions {
  pipelineVersionId: string
  stepVersionId: string
  nodeKey: string
  params?: Record<string, any>
  summary?: Record<string, any>
  // Origin tagging for telemetry
  origin?: string
  originInfo?: Record<string, any>
  // Optional hooks
  onStart?: (ctx: { runId: string; stepRunId: string }) => Promise<void> | void
  onComplete?: (ctx: { runId: string; stepRunId: string }) => Promise<void> | void
}

export class StepTelemetryRunner {
  static async runStep<T>(
    opts: RunStepOptions,
    executor: () => Promise<StepExecutorResult & { result?: T }>
  ): Promise<{ runId: string; stepRunId: string; result?: T }> {
    // Start run (or reuse? For simplicity, one run per call)
    const run = await TelemetryHelper.startPipelineRun({
      pipelineVersionId: opts.pipelineVersionId,
      summary: opts.summary,
      origin: opts.origin,
      originInfo: opts.originInfo,
    })

    const stepRun = await TelemetryHelper.startStepRun({
      pipelineRunId: run.id,
      stepVersionId: opts.stepVersionId,
      nodeKey: opts.nodeKey,
      params: opts.params,
      origin: opts.origin,
      originInfo: opts.originInfo,
    })

    await opts.onStart?.({ runId: run.id, stepRunId: stepRun.id })

    try {
      const out = await executor()

      if (out.ir) {
        await TelemetryHelper.recordIR({ stepRunId: stepRun.id, irJson: out.ir, isValid: true, validationErrors: [] })
      }
      if (out.metrics?.length) {
        await TelemetryHelper.recordMetrics(
          out.metrics.map((m) => ({ ...m, stepRunId: stepRun.id }))
        )
      }
      if (out.outputs?.length) {
        for (const o of out.outputs) {
          await TelemetryHelper.linkOutput({ stepRunId: stepRun.id, targetType: o.targetType, targetId: o.targetId, meta: o.meta })
        }
      }

      await TelemetryHelper.completeStepRun({ stepRunId: stepRun.id, status: out.status ?? 'completed' })
      await TelemetryHelper.completePipelineRun({ runId: run.id, status: 'completed' })
      await opts.onComplete?.({ runId: run.id, stepRunId: stepRun.id })

      return { runId: run.id, stepRunId: stepRun.id, result: out.result }
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : 'Unknown error'
      await TelemetryHelper.failStep(stepRun.id, msg)
      await TelemetryHelper.completePipelineRun({ runId: run.id, status: 'failed', summary: { error: msg } })
      throw e
    }
  }
}

export default StepTelemetryRunner
