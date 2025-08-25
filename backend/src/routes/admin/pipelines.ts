import { Router } from 'express'
import prisma from '../../services/database/prismaClient'
import DagOrchestrator from '../../services/pipeline/DagOrchestrator'

const router = Router()

// Pipelines
router.get('/pipelines', async (req, res) => {
  const defs = await (prisma as any).pipelineDefinition.findMany({
    orderBy: { name: 'asc' },
    include: {
      versions: { select: { id: true, version: true, isActive: true, _count: { select: { runs: true } } } },
      _count: { select: { versions: true } },
    },
  })

// Generate a Pipeline (and initial active version DAG) from a Project Flow
// - Nodes are ordered by `DomainPhase.orderIndex`, then `DomainPhaseStep.orderIndex`
// - Each node's stepVersionId is chosen as: pinnedStepVersionId if set; otherwise the active StepVersion for the StepDefinition
// - Edges are linear by default (v1 MVP). Future improvements can infer dependsOn by phase grouping.
// Body: { dryRun?: boolean, apply?: boolean, bindToFlow?: boolean, pipelineName?: string, description?: string }
router.post('/pipelines/generate-from-flow/:flowId', async (req, res) => {
  try {
    const flowId = String(req.params.flowId)
    const { dryRun, apply, bindToFlow, pipelineName, description } = (req.body ?? {}) as {
      dryRun?: boolean
      apply?: boolean
      bindToFlow?: boolean
      pipelineName?: string
      description?: string
    }

    const flow = await (prisma as any).projectFlow.findUnique({
      where: { id: flowId },
      include: {
        phases: {
          orderBy: { orderIndex: 'asc' },
          include: {
            steps: { orderBy: { orderIndex: 'asc' }, include: { step: true } },
          },
        },
      },
    })
    if (!flow) return res.status(404).json({ error: 'flow_not_found' })

    // Flatten steps in order and resolve stepVersionIds
    const steps: Array<{ key: string; stepId: string; pinnedStepVersionId?: string | null }> = []
    for (const phase of flow.phases ?? []) {
      for (const s of phase.steps ?? []) {
        const baseKey = `${phase.key || `phase${phase.orderIndex}`}.${s.step?.key || `step${s.orderIndex}`}`
        steps.push({ key: baseKey, stepId: String(s.stepId), pinnedStepVersionId: s.pinnedStepVersionId })
      }
    }

    // Resolve version IDs for each step
    const nodes: Array<{ key: string; stepVersionId: string; order: number }> = []
    const issues: Array<{ key: string; reason: string }> = []
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      if (s.pinnedStepVersionId) {
        const sv = await (prisma as any).stepVersion.findUnique({ where: { id: String(s.pinnedStepVersionId) }, select: { id: true } })
        if (!sv) {
          issues.push({ key: s.key, reason: 'pinned_step_version_not_found' })
          continue
        }
        nodes.push({ key: s.key, stepVersionId: String(s.pinnedStepVersionId), order: i })
      } else {
        // Choose active version for this step
        const sv = await (prisma as any).stepVersion.findFirst({ where: { stepId: s.stepId, isActive: true } })
        if (!sv) {
          issues.push({ key: s.key, reason: 'no_active_step_version' })
          continue
        }
        nodes.push({ key: s.key, stepVersionId: String(sv.id), order: i })
      }
    }

    // Build a simple linear DAG
    const dag = { nodes: nodes.map((n) => ({ key: n.key, stepVersionId: n.stepVersionId, order: n.order })) }

    const proposedName = pipelineName || `${flow.name || flow.key || 'Flow'} Pipeline`
    const summary = { stepCount: nodes.length, issues }

    if (!apply) {
      // Dry-run (default)
      return res.json({ data: { dryRun: true, pipeline: { name: proposedName, description: description ?? '', version: '1', dag }, summary } })
    }

    // Apply: create pipeline and initial active version; optionally bind to flow
    const createdPipeline = await (prisma as any).pipelineDefinition.create({ data: { name: proposedName, description: description ?? '' } })
    // Make new version active, deactivate others just in case (none expected)
    await (prisma as any).pipelineVersion.updateMany({ where: { pipelineId: createdPipeline.id }, data: { isActive: false } })
    const createdVersion = await (prisma as any).pipelineVersion.create({
      data: {
        pipelineId: createdPipeline.id,
        version: '1',
        dag,
        config: {},
        isActive: true,
      },
    })

    let bound: any = null
    if (bindToFlow) {
      bound = await (prisma as any).projectFlow.update({
        where: { id: flowId },
        data: { pipelineId: createdPipeline.id, pinnedPipelineVersionId: createdVersion.id },
      })
    }

    return res.status(201).json({ data: { dryRun: false, pipeline: createdPipeline, version: createdVersion, boundFlow: !!bound && { id: bound.id } }, summary })
  } catch (err: any) {
    const message = err?.message || 'Internal Server Error'
    return res.status(500).json({ error: 'generate_from_flow_failed', message })
  }
})
  const data = defs.map((d: any) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    versionCount: d._count?.versions ?? 0,
    versions: d.versions,
  }))
  res.json({ data })
})

router.post('/pipelines', async (req, res) => {
  const { name, description, createInitialVersion, activateInitial } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name_required' })
  // uniqueness (case-insensitive)
  const exists = await (prisma as any).pipelineDefinition.findFirst({ where: { name: { equals: String(name), mode: 'insensitive' } } })
  if (exists) return res.status(409).json({ error: 'name_exists' })
  const created = await (prisma as any).pipelineDefinition.create({ data: { name, description: description ?? '' } })
  let initialVersion: any = null
  const shouldCreateInitial = createInitialVersion !== false // default true
  if (shouldCreateInitial) {
    const makeActive = !!activateInitial
    if (makeActive) {
      await (prisma as any).pipelineVersion.updateMany({ where: { pipelineId: created.id }, data: { isActive: false } })
    }
    initialVersion = await (prisma as any).pipelineVersion.create({
      data: {
        pipelineId: created.id,
        version: '1',
        dag: { nodes: [] },
        config: {},
        isActive: makeActive,
      },
    })
  }
  res.status(201).json({ data: { pipeline: created, initialVersion } })
})

router.patch('/pipelines/:pipelineId', async (req, res) => {
  const { description, name } = req.body || {}
  const id = String(req.params.pipelineId)
  if (name) {
    const exists = await (prisma as any).pipelineDefinition.findFirst({
      where: { id: { not: id }, name: { equals: String(name), mode: 'insensitive' } },
    })
    if (exists) return res.status(409).json({ error: 'name_exists' })
  }
  const updated = await (prisma as any).pipelineDefinition.update({ where: { id }, data: { description, name } })
  res.json({ data: updated })
})

router.delete('/pipelines/:pipelineId', async (req, res) => {
  const id = String(req.params.pipelineId)
  // Fail-safe: block if there is any active version
  const activeCount = await (prisma as any).pipelineVersion.count({ where: { pipelineId: id, isActive: true } })
  if (activeCount > 0) return res.status(409).json({ error: 'cannot_delete_active' })
  // Delete all versions (if any) then the pipeline in a transaction
  await (prisma as any).$transaction([
    (prisma as any).pipelineVersion.deleteMany({ where: { pipelineId: id } }),
    (prisma as any).pipelineDefinition.delete({ where: { id } }),
  ])
  res.status(204).end()
})

// Pipeline versions
router.get('/pipelines/:pipelineId/versions', async (req, res) => {
  const items = await (prisma as any).pipelineVersion.findMany({
    where: { pipelineId: String(req.params.pipelineId) },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ data: items })
})

// Get active version for a pipeline
router.get('/pipelines/:pipelineId/versions/active', async (req, res) => {
  const item = await (prisma as any).pipelineVersion.findFirst({
    where: { pipelineId: String(req.params.pipelineId), isActive: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!item) return res.status(404).json({ error: 'active_version_not_found' })
  res.json({ data: item })
})

// Get a specific version
router.get('/pipelines/:pipelineId/versions/:version', async (req, res) => {
  console.log('[AdminPipelines] GET version', { pipelineId: String(req.params.pipelineId), version: String(req.params.version) })
  const item = await (prisma as any).pipelineVersion.findUnique({
    where: { pipelineId_version: { pipelineId: String(req.params.pipelineId), version: String(req.params.version) } },
  })
  if (!item) return res.status(404).json({ error: 'version_not_found' })
  try {
    const dag = (item as any).dag
    const nodesLen = Array.isArray(dag?.nodes)
      ? dag.nodes.length
      : dag && dag.nodes && typeof dag.nodes === 'object'
      ? Object.keys(dag.nodes).length
      : 0
    console.log('[AdminPipelines] GET version -> found', { nodes: nodesLen, hasEdges: !!dag?.edges })
  } catch {}
  res.json({ data: item })
})

router.post('/pipelines/:pipelineId/versions', async (req, res) => {
  const { version, dag, config, isActive } = req.body || {}
  if (!version) return res.status(400).json({ error: 'version_required' })
  const data: any = { pipelineId: String(req.params.pipelineId), version, dag: dag ?? { nodes: [] }, config: config ?? {}, isActive: !!isActive }
  if (isActive) {
    // Deactivate others
    await (prisma as any).pipelineVersion.updateMany({ where: { pipelineId: data.pipelineId }, data: { isActive: false } })
  }
  const created = await (prisma as any).pipelineVersion.create({ data })
  res.status(201).json({ data: created })
})

// Update a specific version (dag/config/isActive)
router.patch('/pipelines/:pipelineId/versions/:version', async (req, res) => {
  const pipelineId = String(req.params.pipelineId)
  const version = String(req.params.version)
  const { dag, config, isActive } = req.body || {}
  try {
    const nodesLen = Array.isArray(dag?.nodes)
      ? dag.nodes.length
      : dag && dag.nodes && typeof dag.nodes === 'object'
      ? Object.keys(dag.nodes).length
      : 0
    console.log('[AdminPipelines] PATCH version', { pipelineId, version, nodes: nodesLen, hasEdges: !!dag?.edges })
  } catch {}
  if (isActive === true) {
    await (prisma as any).pipelineVersion.updateMany({ where: { pipelineId }, data: { isActive: false } })
  }
  const updated = await (prisma as any).pipelineVersion.update({
    where: { pipelineId_version: { pipelineId, version } },
    data: { dag, config, isActive: isActive ?? undefined },
  })
  try {
    const updDag = (updated as any).dag
    const nodesLen = Array.isArray(updDag?.nodes)
      ? updDag.nodes.length
      : updDag && updDag.nodes && typeof updDag.nodes === 'object'
      ? Object.keys(updDag.nodes).length
      : 0
    console.log('[AdminPipelines] PATCH version -> saved', { nodes: nodesLen, hasEdges: !!updDag?.edges })
  } catch {}
  res.json({ data: updated })
})

router.post('/pipelines/:pipelineId/versions/:version/activate', async (req, res) => {
  const pipelineId = String(req.params.pipelineId)
  const version = String(req.params.version)
  await (prisma as any).pipelineVersion.updateMany({ where: { pipelineId }, data: { isActive: false } })
  const updated = await (prisma as any).pipelineVersion.update({ where: { pipelineId_version: { pipelineId, version } }, data: { isActive: true } })
  res.json({ data: updated })
})

// Deactivate a specific pipeline version (allows pipeline to have no active version)
router.post('/pipelines/:pipelineId/versions/:version/deactivate', async (req, res) => {
  const pipelineId = String(req.params.pipelineId)
  const version = String(req.params.version)
  const existing = await (prisma as any).pipelineVersion.findUnique({ where: { pipelineId_version: { pipelineId, version } } })
  if (!existing) return res.status(404).json({ error: 'version_not_found' })
  if ((existing as any).isActive === false) return res.json({ data: existing })
  const updated = await (prisma as any).pipelineVersion.update({ where: { pipelineId_version: { pipelineId, version } }, data: { isActive: false } })
  res.json({ data: updated })
})

// Delete a non-active pipeline version
router.delete('/pipelines/:pipelineId/versions/:version', async (req, res) => {
  const pipelineId = String(req.params.pipelineId)
  const version = String(req.params.version)
  const pv = await (prisma as any).pipelineVersion.findUnique({ where: { pipelineId_version: { pipelineId, version } } })
  if (!pv) return res.status(404).json({ error: 'version_not_found' })
  if ((pv as any).isActive) return res.status(409).json({ error: 'cannot_delete_active_version' })
  await (prisma as any).pipelineVersion.delete({ where: { pipelineId_version: { pipelineId, version } } })
  return res.status(204).end()
})

// Execute/plan a pipeline version DAG
router.post('/pipelines/:pipelineId/versions/:version/execute', async (req, res) => {
  const pipelineId = String(req.params.pipelineId)
  const version = String(req.params.version)
  const { dryRun, origin, originInfo } = req.body || {}
  const pv = await (prisma as any).pipelineVersion.findUnique({ where: { pipelineId_version: { pipelineId, version } } })
  if (!pv) return res.status(404).json({ error: 'version_not_found' })
  const result = await DagOrchestrator.planAndExecute({ pipelineVersionId: pv.id, dryRun: !!dryRun, origin, originInfo })
  res.status(202).json({ data: result })
})

// Steps
router.get('/steps', async (req, res) => {
  try {
    const items = await (prisma as any).stepDefinition.findMany({
      orderBy: { key: 'asc' },
      include: { _count: { select: { versions: true } }, versions: { select: { id: true, version: true, isActive: true } } },
    })
    const data = items.map((s: any) => ({ id: s.id, key: s.key, name: s.name, description: s.description, versionCount: s._count?.versions ?? 0, versions: s.versions }))
    res.json({ data })
  } catch (err: any) {
    const message = err?.message || 'Internal Server Error'
    // Narrow diagnostics for Prisma/DB issues to help debugging without leaking sensitive info
    const hint = (message.includes('column') || message.includes('relation') || message.includes('does not exist'))
      ? 'database_schema_mismatch' : undefined
    res.status(500).json({ error: 'steps_list_failed', message, hint })
  }
})

router.post('/steps', async (req, res) => {
  const { key, name, description, createInitialVersion, activateInitial } = req.body || {}
  if (!key) return res.status(400).json({ error: 'key_required' })
  const created = await (prisma as any).stepDefinition.create({ data: { key, name, description: description ?? '' } })
  let initialVersion: any = null
  const shouldCreateInitial = createInitialVersion !== false // default true
  if (shouldCreateInitial) {
    const makeActive = !!activateInitial
    if (makeActive) {
      await (prisma as any).stepVersion.updateMany({ where: { stepId: created.id }, data: { isActive: false } })
    }
    initialVersion = await (prisma as any).stepVersion.create({
      data: {
        stepId: created.id,
        version: '1',
        defaultConfig: {},
        isActive: makeActive,
      },
    })
  }
  res.status(201).json({ data: { step: created, initialVersion } })
})

router.patch('/steps/:stepId', async (req, res) => {
  const { name, description } = req.body || {}
  const updated = await (prisma as any).stepDefinition.update({ where: { id: String(req.params.stepId) }, data: { name, description } })
  res.json({ data: updated })
})

router.delete('/steps/:stepId', async (req, res) => {
  const id = String(req.params.stepId)
  // Guard: disallow delete if versions exist
  const versions = await (prisma as any).stepVersion.count({ where: { stepId: id } })
  if (versions > 0) return res.status(409).json({ error: 'has_versions' })
  await (prisma as any).stepDefinition.delete({ where: { id } })
  res.status(204).end()
})

// Step versions
router.get('/steps/:stepId/versions', async (req, res) => {
  const items = await (prisma as any).stepVersion.findMany({ where: { stepId: String(req.params.stepId) }, orderBy: { createdAt: 'desc' } })
  res.json({ data: items })
})

router.post('/steps/:stepId/versions', async (req, res) => {
  const { version, defaultConfig, isActive } = req.body || {}
  if (!version) return res.status(400).json({ error: 'version_required' })
  const stepId = String(req.params.stepId)
  if (isActive) {
    await (prisma as any).stepVersion.updateMany({ where: { stepId }, data: { isActive: false } })
  }
  const created = await (prisma as any).stepVersion.create({ data: { stepId, version, defaultConfig: defaultConfig ?? {}, isActive: !!isActive } })
  res.status(201).json({ data: created })
})

router.delete('/steps/:stepId/versions/:version', async (req, res) => {
  const stepId = String(req.params.stepId)
  const version = String(req.params.version)
  // Ensure it exists and is not active
  const sv = await (prisma as any).stepVersion.findUnique({ where: { stepId_version: { stepId, version } } })
  if (!sv) return res.status(404).json({ error: 'version_not_found' })
  if ((sv as any).isActive) return res.status(409).json({ error: 'cannot_delete_active_version' })
  // Delete will cascade to related IRSchemas and StepRuns per schema
  await (prisma as any).stepVersion.delete({ where: { stepId_version: { stepId, version } } })
  return res.status(204).end()
})

router.post('/steps/:stepId/versions/:version/activate', async (req, res) => {
  const stepId = String(req.params.stepId)
  const version = String(req.params.version)
  await (prisma as any).stepVersion.updateMany({ where: { stepId }, data: { isActive: false } })
  const updated = await (prisma as any).stepVersion.update({ where: { stepId_version: { stepId, version } }, data: { isActive: true } })
  res.json({ data: updated })
})

// Deactivate a specific step version (leaves the step with no active version)
router.post('/steps/:stepId/versions/:version/deactivate', async (req, res) => {
  const stepId = String(req.params.stepId)
  const version = String(req.params.version)
  const existing = await (prisma as any).stepVersion.findUnique({ where: { stepId_version: { stepId, version } } })
  if (!existing) return res.status(404).json({ error: 'version_not_found' })
  if ((existing as any).isActive === false) return res.json({ data: existing })
  const updated = await (prisma as any).stepVersion.update({ where: { stepId_version: { stepId, version } }, data: { isActive: false } })
  res.json({ data: updated })
})

// IR Schemas
router.get('/steps/versions/:stepVersionId/ir-schemas', async (req, res) => {
  const items = await (prisma as any).iRSchema.findMany({ where: { stepVersionId: String(req.params.stepVersionId) }, orderBy: { createdAt: 'desc' } })
  res.json({ data: items })
})

router.post('/steps/versions/:stepVersionId/ir-schemas', async (req, res) => {
  const { name, version, schema, isActive } = req.body || {}
  if (!name || !version || !schema) return res.status(400).json({ error: 'name_version_schema_required' })
  const stepVersionId = String(req.params.stepVersionId)
  if (isActive) {
    await (prisma as any).iRSchema.updateMany({ where: { stepVersionId }, data: { isActive: false } })
  }
  const created = await (prisma as any).iRSchema.create({ data: { stepVersionId, name, version, schema, isActive: !!isActive } })
  res.status(201).json({ data: created })
})

router.patch('/ir-schemas/:id', async (req, res) => {
  const id = String(req.params.id)
  const { name, version, schema, isActive } = req.body || {}
  if (isActive === true) {
    const existing = await (prisma as any).iRSchema.findUnique({ where: { id } })
    if (existing) {
      await (prisma as any).iRSchema.updateMany({ where: { stepVersionId: existing.stepVersionId }, data: { isActive: false } })
    }
  }
  const updated = await (prisma as any).iRSchema.update({ where: { id }, data: { name, version, schema, isActive } })
  res.json({ data: updated })
})

router.delete('/ir-schemas/:id', async (req, res) => {
  const id = String(req.params.id)
  const schema = await (prisma as any).iRSchema.findUnique({ where: { id } })
  if (!schema) return res.status(404).json({ error: 'not_found' })
  if (schema.isActive) return res.status(409).json({ error: 'cannot_delete_active' })
  await (prisma as any).iRSchema.delete({ where: { id } })
  res.status(204).end()
})

// IR Artifacts (view)
router.get('/step-runs/:stepRunId/ir-artifacts', async (req, res) => {
  const items = await (prisma as any).iRArtifact.findMany({ where: { stepRunId: String(req.params.stepRunId) }, orderBy: { createdAt: 'desc' } })
  res.json({ data: items })
})

// DomainPhaseStep params management (manual/uiHints and other per-step UI/behavior flags)
router.get('/domain-phase-steps/:id/params', async (req, res) => {
  const id = String(req.params.id)
  const dps = await (prisma as any).domainPhaseStep.findUnique({ where: { id }, select: { id: true, params: true } })
  if (!dps) return res.status(404).json({ error: 'not_found' })
  res.json({ data: { id: dps.id, params: (dps as any).params ?? {} } })
})

// Merge-safe update of DomainPhaseStep.params
// Body can be either:
// - { params: { manual?: boolean, uiHints?: object, ... } }
// - or a flat object to merge directly into params
router.patch('/domain-phase-steps/:id/params', async (req, res) => {
  const id = String(req.params.id)
  const body = (req.body ?? {}) as any
  const incoming = typeof body.params === 'object' && body.params !== null ? body.params : body
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return res.status(400).json({ error: 'invalid_params_payload', message: 'Expected an object payload or { params: object }' })
  }

  // Guard against undefined (not serializable in JSON)
  const sanitized: any = {}
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== undefined) sanitized[k] = v
  }

  const existing = await (prisma as any).domainPhaseStep.findUnique({ where: { id }, select: { params: true } })
  if (!existing) return res.status(404).json({ error: 'not_found' })

  const merged = { ...((existing as any).params ?? {}), ...sanitized }

  const updated = await (prisma as any).domainPhaseStep.update({ where: { id }, data: { params: merged } })
  res.json({ data: { id, params: (updated as any).params ?? {} } })
})

export default router
