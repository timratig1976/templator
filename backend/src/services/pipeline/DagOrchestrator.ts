import prisma from '../database/prismaClient'

// Types that mirror what's stored in PipelineVersion.dag JSON
export interface DagNode {
  key: string
  stepVersionId: string
  params?: Record<string, any>
  metricProfileId?: string
  // Optional minimal ordering for MVP fallback
  order?: number
  // Optional policy fields
  dependsOn?: string[]
  condition?: string
  continueOnFail?: boolean
  retries?: number
  timeoutMs?: number
  parallelGroup?: string
}

export interface DagEdge {
  from: string
  to: string
}

export interface PipelineDag {
  nodes: DagNode[]
  edges?: DagEdge[]
}

export class DagOrchestrator {
  // Build adjacency/dependency graph from nodes+edges or from dependsOn fields
  private buildGraph(dag: PipelineDag): { nodes: Map<string, DagNode>; deps: Map<string, Set<string>> } {
    const nodes = new Map<string, DagNode>()
    dag.nodes.forEach((n) => nodes.set(n.key, n))

    const deps = new Map<string, Set<string>>()
    // initialize
    dag.nodes.forEach((n) => deps.set(n.key, new Set<string>()))

    if (dag.edges && dag.edges.length > 0) {
      for (const e of dag.edges) {
        if (!nodes.has(e.from) || !nodes.has(e.to)) continue
        deps.get(e.to)!.add(e.from)
      }
    }

    // also honor per-node dependsOn lists
    for (const n of dag.nodes) {
      if (n.dependsOn) {
        for (const d of n.dependsOn) {
          if (nodes.has(d)) deps.get(n.key)!.add(d)
        }
      }
    }

    // MVP fallback: if no edges/dependsOn, use ascending order field if present
    const allEmpty = Array.from(deps.values()).every((s) => s.size === 0)
    if (allEmpty) {
      const ordered = [...dag.nodes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      // No deps; just ensure nodes map is consistent
      nodes.clear()
      ordered.forEach((n) => nodes.set(n.key, n))
    }

    return { nodes, deps }
  }

  // Simple topological sort (Kahn). If cycles, throws.
  private topoSort(nodes: Map<string, DagNode>, deps: Map<string, Set<string>>): string[] {
    const inDeg = new Map<string, number>()
    for (const [k, s] of deps.entries()) inDeg.set(k, s.size)
    // ensure nodes with no deps are represented
    for (const k of nodes.keys()) if (!inDeg.has(k)) inDeg.set(k, 0)

    const q: string[] = []
    for (const [k, d] of inDeg.entries()) if (d === 0) q.push(k)

    const result: string[] = []
    while (q.length) {
      const k = q.shift()!
      result.push(k)
      for (const [to, set] of deps.entries()) {
        if (set.has(k)) {
          set.delete(k)
          inDeg.set(to, set.size)
          if (set.size === 0) q.push(to)
        }
      }
    }

    if (result.length !== nodes.size) {
      throw new Error('DAG contains a cycle or unresolved dependencies')
    }
    return result
  }

  // Naive condition eval: allow simple dot-path equals/rel ops on metrics in accumulated context
  // For safety, we do NOT eval arbitrary JS. Only a tiny subset like metrics.validate.passed == true
  private evaluateCondition(condition: string | undefined, context: Record<string, any>): boolean {
    if (!condition) return true
    // extremely basic: support `metrics.<path> == <literal>` or `>=`/`<=`/`>`/`<`
    // This is a placeholder. In production, replace with a safe expression parser.
    try {
      const m = condition.match(/^(\w+(?:\.[\w\d_]+)*)\s*(==|>=|<=|>|<)\s*(.+)$/)
      if (!m) return true
      const [, path, op, rhsRaw] = m
      const lhs = path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), context as any)
      let rhs: any = rhsRaw.trim()
      if (rhs === 'true') rhs = true
      else if (rhs === 'false') rhs = false
      else if (!isNaN(Number(rhs))) rhs = Number(rhs)
      else if (/^['"].*['"]$/.test(rhs)) rhs = rhs.slice(1, -1)
      switch (op) {
        case '==':
          return lhs === rhs
        case '>=':
          return Number(lhs) >= Number(rhs)
        case '<=':
          return Number(lhs) <= Number(rhs)
        case '>':
          return Number(lhs) > Number(rhs)
        case '<':
          return Number(lhs) < Number(rhs)
        default:
          return true
      }
    } catch {
      return true
    }
  }

  // Draft execution: creates PipelineRun and StepRuns following topo order, applying basic policies.
  // Actual step logic execution is intentionally out of scope of this draft; we mark StepRuns as queued.
  async planAndExecute(opts: {
    pipelineVersionId: string
    origin?: string
    originInfo?: Record<string, any>
    dryRun?: boolean
  }): Promise<{ pipelineRunId: string; plan: string[] }> {
    const pv = await (prisma as any).pipelineVersion.findUnique({ where: { id: opts.pipelineVersionId } })
    if (!pv) throw new Error('pipeline_version_not_found')
    const dag: PipelineDag = pv.dag || { nodes: [] }

    const { nodes, deps } = this.buildGraph(dag)
    const order = this.topoSort(nodes, deps)

    const run = await (prisma as any).pipelineRun.create({
      data: {
        pipelineVersionId: pv.id,
        status: 'running',
        origin: opts.origin ?? 'admin_api',
        originInfo: opts.originInfo ?? {},
        summary: { plannedNodes: order },
      },
    })

    if (opts.dryRun) {
      // do not create step runs
      return { pipelineRunId: run.id, plan: order }
    }

    const context: Record<string, any> = { metrics: {} }

    for (const key of order) {
      const node = nodes.get(key)!
      // Basic condition check
      if (!this.evaluateCondition(node.condition, context)) {
        // record a skipped step
        await (prisma as any).stepRun.create({
          data: {
            pipelineRunId: run.id,
            stepVersionId: node.stepVersionId,
            nodeKey: node.key,
            status: 'skipped',
            params: node.params ?? {},
            origin: opts.origin ?? 'admin_api',
            originInfo: opts.originInfo ?? {},
          },
        })
        continue
      }

      // Create queued step run entry; a real worker would pick this up.
      await (prisma as any).stepRun.create({
        data: {
          pipelineRunId: run.id,
          stepVersionId: node.stepVersionId,
          nodeKey: node.key,
          status: 'queued',
          params: node.params ?? {},
          origin: opts.origin ?? 'admin_api',
          originInfo: { ...opts.originInfo, retries: node.retries ?? 0, timeoutMs: node.timeoutMs ?? null, parallelGroup: node.parallelGroup ?? null },
        },
      })

      // In this draft we do not execute; a background worker would transition queued -> running -> completed/failed and populate context.
    }

    // Mark pipeline run as planned; if a worker exists, it will update later.
    await (prisma as any).pipelineRun.update({ where: { id: run.id }, data: { status: 'planned' } })

    return { pipelineRunId: run.id, plan: order }
  }
}

export default new DagOrchestrator()
