import prisma from '../database/prismaClient'

export type PipelineRunStatus = 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled'
export type StepRunStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface StartRunInput {
  pipelineVersionId: string
  summary?: Record<string, any>
  origin?: string
  originInfo?: Record<string, any>
}

export interface CompleteRunInput {
  runId: string
  status?: PipelineRunStatus
  summary?: Record<string, any>
}

export interface StartStepInput {
  pipelineRunId: string
  stepVersionId: string
  nodeKey: string
  params?: Record<string, any>
  origin?: string
  originInfo?: Record<string, any>
}

export interface CompleteStepInput {
  stepRunId: string
  status?: StepRunStatus
  error?: string | null
}

export interface IRInput {
  stepRunId: string
  irJson: Record<string, any>
  isValid?: boolean
  validationErrors?: any[]
}

export interface MetricInput {
  stepRunId: string
  metricKey: string
  value?: number | null
  stringValue?: string | null
  passed?: boolean
  details?: Record<string, any>
}

export interface OutputLinkInput {
  stepRunId: string
  targetType: string
  targetId: string
  meta?: Record<string, any>
}

export const TelemetryHelper = {
  async startPipelineRun(input: StartRunInput) {
    const now = new Date()
    return prisma.pipelineRun.create({
      data: {
        pipelineVersionId: input.pipelineVersionId,
        status: 'running',
        startedAt: now,
        summary: input.summary ?? {},
        origin: input.origin ?? 'frontend_user',
        originInfo: input.originInfo ?? undefined,
      },
    })
  },

  async completePipelineRun(input: CompleteRunInput) {
    const now = new Date()
    return prisma.pipelineRun.update({
      where: { id: input.runId },
      data: {
        status: input.status ?? 'completed',
        completedAt: now,
        summary: input.summary ?? undefined,
      },
    })
  },

  async startStepRun(input: StartStepInput) {
    const now = new Date()
    return prisma.stepRun.create({
      data: {
        pipelineRunId: input.pipelineRunId,
        stepVersionId: input.stepVersionId,
        nodeKey: input.nodeKey,
        status: 'running',
        startedAt: now,
        params: input.params ?? {},
        origin: input.origin ?? 'frontend_user',
        originInfo: input.originInfo ?? undefined,
      },
    })
  },

  async completeStepRun(input: CompleteStepInput) {
    const now = new Date()
    return prisma.stepRun.update({
      where: { id: input.stepRunId },
      data: {
        status: input.status ?? 'completed',
        completedAt: now,
        error: input.error ?? null,
      },
    })
  },

  async failStep(stepRunId: string, error: string) {
    const now = new Date()
    return prisma.stepRun.update({
      where: { id: stepRunId },
      data: { status: 'failed', completedAt: now, error },
    })
  },

  async recordIR(input: IRInput) {
    return prisma.iRArtifact.create({
      data: {
        stepRunId: input.stepRunId,
        irJson: input.irJson,
        isValid: input.isValid ?? true,
        validationErrors: input.validationErrors ?? [],
      },
    })
  },

  async recordMetrics(metrics: MetricInput[]) {
    if (!metrics.length) return { count: 0 }
    return prisma.metricResult.createMany({
      data: metrics.map((m) => ({
        stepRunId: m.stepRunId,
        metricKey: m.metricKey,
        value: m.value ?? null,
        stringValue: m.stringValue ?? null,
        passed: m.passed ?? null,
        details: m.details ?? {},
      })),
    })
  },

  async linkOutput(input: OutputLinkInput) {
    return prisma.stepOutputLink.create({
      data: {
        stepRunId: input.stepRunId,
        targetType: input.targetType,
        targetId: input.targetId,
        meta: input.meta ?? {},
      },
    })
  },
}

export default TelemetryHelper
