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
  const { name, description } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name_required' })
  const created = await (prisma as any).pipelineDefinition.create({ data: { name, description: description ?? '' } })
  res.status(201).json({ data: created })
})

router.patch('/pipelines/:pipelineId', async (req, res) => {
  const { description, name } = req.body || {}
  const updated = await (prisma as any).pipelineDefinition.update({ where: { id: String(req.params.pipelineId) }, data: { description, name } })
  res.json({ data: updated })
})

router.delete('/pipelines/:pipelineId', async (req, res) => {
  const id = String(req.params.pipelineId)
  // Guard: disallow delete if versions exist
  const versions = await (prisma as any).pipelineVersion.count({ where: { pipelineId: id } })
  if (versions > 0) return res.status(409).json({ error: 'has_versions' })
  await (prisma as any).pipelineDefinition.delete({ where: { id } })
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
  const item = await (prisma as any).pipelineVersion.findUnique({
    where: { pipelineId_version: { pipelineId: String(req.params.pipelineId), version: String(req.params.version) } },
  })
  if (!item) return res.status(404).json({ error: 'version_not_found' })
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
  if (isActive === true) {
    await (prisma as any).pipelineVersion.updateMany({ where: { pipelineId }, data: { isActive: false } })
  }
  const updated = await (prisma as any).pipelineVersion.update({
    where: { pipelineId_version: { pipelineId, version } },
    data: { dag, config, isActive: isActive ?? undefined },
  })
  res.json({ data: updated })
})

router.post('/pipelines/:pipelineId/versions/:version/activate', async (req, res) => {
  const pipelineId = String(req.params.pipelineId)
  const version = String(req.params.version)
  await (prisma as any).pipelineVersion.updateMany({ where: { pipelineId }, data: { isActive: false } })
  const updated = await (prisma as any).pipelineVersion.update({ where: { pipelineId_version: { pipelineId, version } }, data: { isActive: true } })
  res.json({ data: updated })
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
  const items = await (prisma as any).stepDefinition.findMany({
    orderBy: { key: 'asc' },
    include: { _count: { select: { versions: true } }, versions: { select: { id: true, version: true, isActive: true } } },
  })
  const data = items.map((s: any) => ({ id: s.id, key: s.key, name: s.name, description: s.description, versionCount: s._count?.versions ?? 0, versions: s.versions }))
  res.json({ data })
})

router.post('/steps', async (req, res) => {
  const { key, name, description } = req.body || {}
  if (!key) return res.status(400).json({ error: 'key_required' })
  const created = await (prisma as any).stepDefinition.create({ data: { key, name, description: description ?? '' } })
  res.status(201).json({ data: created })
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

router.post('/steps/:stepId/versions/:version/activate', async (req, res) => {
  const stepId = String(req.params.stepId)
  const version = String(req.params.version)
  await (prisma as any).stepVersion.updateMany({ where: { stepId }, data: { isActive: false } })
  const updated = await (prisma as any).stepVersion.update({ where: { stepId_version: { stepId, version } }, data: { isActive: true } })
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

export default router
