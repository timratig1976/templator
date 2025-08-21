import prisma from '../database/prismaClient'

export type EnsureOpts = {
  pipelineName: string
  pipelineVersion: string
  steps: Array<{ key: string; name: string; description?: string; defaultConfig?: Record<string, any> }>
}

export interface EnsuredPipeline {
  pipelineVersionId: string
  stepVersionByKey: Record<string, string>
}

export class PipelineRegistry {
  static async ensure(opts: EnsureOpts): Promise<EnsuredPipeline> {
    const pdef = await (prisma as any).pipelineDefinition.upsert({
      where: { name: opts.pipelineName },
      update: {},
      create: { name: opts.pipelineName, description: `${opts.pipelineName} pipeline` },
    })

    const dag = { nodes: opts.steps.map((s, i) => ({ key: s.key, next: i < opts.steps.length - 1 ? [opts.steps[i + 1].key] : [] })) }

    const pver = await (prisma as any).pipelineVersion.upsert({
      where: { pipelineId_version: { pipelineId: pdef.id, version: opts.pipelineVersion } },
      update: { dag },
      create: { pipelineId: pdef.id, version: opts.pipelineVersion, isActive: true, dag, config: {} },
    })

    const stepVersionByKey: Record<string, string> = {}

    for (const s of opts.steps) {
      const sdef = await (prisma as any).stepDefinition.upsert({
        where: { key: s.key },
        update: {},
        create: { key: s.key, name: s.name, description: s.description ?? '' },
      })
      const sver = await (prisma as any).stepVersion.upsert({
        where: { stepId_version: { stepId: sdef.id, version: 'v1' } },
        update: { isActive: true },
        create: { stepId: sdef.id, version: 'v1', isActive: true, defaultConfig: s.defaultConfig ?? {} },
      })
      stepVersionByKey[s.key] = sver.id
    }

    return { pipelineVersionId: pver.id, stepVersionByKey }
  }
}

export default PipelineRegistry
