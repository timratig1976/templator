import express from 'express';
import prisma from '../../services/database/prismaClient';

const router = express.Router();

// List step definitions (with optional search and pagination)
router.get('/', async (req, res) => {
  try {
    const { q, take, skip } = req.query as { q?: string; take?: string; skip?: string };
    const where: any = {};
    if (q && q.trim().length > 0) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { key: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    const takeNum = Math.min(Math.max(parseInt(String(take || '50'), 10) || 50, 1), 200);
    const skipNum = Math.max(parseInt(String(skip || '0'), 10) || 0, 0);
    const items = await prisma.stepDefinition.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: takeNum,
      skip: skipNum,
    });
    return res.json({ success: true, data: items });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'Failed to list steps' });
  }
});

// Create an abstract AI Step (no prompt)
router.post('/', async (req, res) => {
  try {
    const { name, description, process, key } = req.body as { name?: string; description?: string; process?: string; key?: string };
    if (!process) return res.status(400).json({ success: false, error: 'process is required' });
    const step = await prisma.stepDefinition.create({
      data: {
        key: key && key.trim().length > 0 ? key : `step_${Date.now()}`,
        name: name ?? null,
        description: description ?? null,
        process: process ?? null,
      },
    });
    return res.json({ success: true, data: step });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'Failed to create step' });
  }
});

// Read a step by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const step = await prisma.stepDefinition.findUnique({
      where: { id },
      include: {
        activeVersion: true,
      },
    });
    if (!step) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, data: step });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch step' });
  }
});

// Update a step
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, process } = req.body as { name?: string; description?: string; process?: string };
    const step = await prisma.stepDefinition.update({
      where: { id },
      data: {
        name: name ?? undefined,
        description: description ?? undefined,
        process: process ?? undefined,
      },
    });
    return res.json({ success: true, data: step });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'Not found' });
    return res.status(500).json({ success: false, error: 'Failed to update step' });
  }
});

// List versions for a step
router.get('/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const versions = await prisma.stepVersion.findMany({
      where: { stepId: id },
      orderBy: { createdAt: 'desc' },
      include: { aiPrompt: true },
    });
    return res.json({ success: true, data: versions });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch versions' });
  }
});

// Create a version for a step (optionally include prompt)
router.post('/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const { version, defaultConfig, prompt } = req.body as { version: string; defaultConfig?: any; prompt?: any };
    if (!version) return res.status(400).json({ success: false, error: 'version is required' });
    const created = await prisma.stepVersion.create({
      data: {
        stepId: id,
        version,
        defaultConfig: defaultConfig ?? null,
        prompt: typeof prompt === 'undefined' ? undefined : (prompt ?? null),
      },
    });
    return res.json({ success: true, data: created });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ success: false, error: 'version already exists for this step' });
    return res.status(500).json({ success: false, error: 'Failed to create version' });
  }
});

// Update a version (attach prompt, update config)
router.put('/versions/:versionId', async (req, res) => {
  try {
    const { versionId } = req.params;
    const { aiPromptId, defaultConfig, isActive, prompt } = req.body as { aiPromptId?: string | null; defaultConfig?: any; isActive?: boolean; prompt?: any };

    const updated = await prisma.stepVersion.update({
      where: { id: versionId },
      data: {
        aiPromptId: typeof aiPromptId === 'undefined' ? undefined : aiPromptId,
        defaultConfig: typeof defaultConfig === 'undefined' ? undefined : defaultConfig,
        isActive: typeof isActive === 'undefined' ? undefined : !!isActive,
        prompt: typeof prompt === 'undefined' ? undefined : (prompt ?? null),
      },
    });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'Not found' });
    return res.status(500).json({ success: false, error: 'Failed to update version' });
  }
});

// Activate a version for its step
router.put('/versions/:versionId/activate', async (req, res) => {
  try {
    const { versionId } = req.params;
    const version = await prisma.stepVersion.findUnique({ where: { id: versionId } });
    if (!version) return res.status(404).json({ success: false, error: 'Not found' });

    await prisma.$transaction([
      prisma.stepVersion.updateMany({ where: { stepId: version.stepId }, data: { isActive: false } }),
      prisma.stepVersion.update({ where: { id: versionId }, data: { isActive: true } }),
      prisma.stepDefinition.update({ where: { id: version.stepId }, data: { activeVersionId: versionId } }),
    ]);

    const updated = await prisma.stepVersion.findUnique({ where: { id: versionId } });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'Failed to activate version' });
  }
});

export default router;

// --- PromptAsset (simple library) & StepVersion bindings ---

// List prompt assets, optionally filtered by stepId or stepVersionId
router.get('/prompt-assets', async (req, res) => {
  try {
    const { stepId, stepVersionId } = req.query as { stepId?: string; stepVersionId?: string };
    const where: any = {};
    if (stepId) where.stepId = String(stepId);
    if (stepVersionId) where.stepVersionId = String(stepVersionId);
    const items = await (prisma as any).promptAsset.findMany({ where, orderBy: { updatedAt: 'desc' } });
    return res.json({ success: true, data: items });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'Failed to list prompt assets' });
  }
});

// Create a prompt asset
router.post('/prompt-assets', async (req, res) => {
  try {
    const { name, description, tags, owner, quality, flags, promptContent, irSchema, stepId, stepVersionId } = req.body || {};
    if (!name || !promptContent) return res.status(400).json({ success: false, error: 'name_and_promptContent_required' });
    const created = await (prisma as any).promptAsset.create({
      data: {
        name,
        description: description ?? null,
        tags: Array.isArray(tags) ? tags : [],
        owner: owner ?? null,
        quality: quality ?? null,
        flags: flags ?? null,
        promptContent,
        irSchema: typeof irSchema === 'undefined' ? undefined : (irSchema ?? null),
        stepId: stepId ?? null,
        stepVersionId: stepVersionId ?? null,
      },
    });
    return res.status(201).json({ success: true, data: created });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'Failed to create prompt asset' });
  }
});

// Update a prompt asset
router.put('/prompt-assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, tags, owner, quality, flags, promptContent, irSchema } = req.body || {};
    const updated = await (prisma as any).promptAsset.update({
      where: { id },
      data: {
        name: typeof name === 'undefined' ? undefined : name,
        description: typeof description === 'undefined' ? undefined : description,
        tags: typeof tags === 'undefined' ? undefined : (Array.isArray(tags) ? tags : []),
        owner: typeof owner === 'undefined' ? undefined : owner,
        quality: typeof quality === 'undefined' ? undefined : quality,
        flags: typeof flags === 'undefined' ? undefined : flags,
        promptContent: typeof promptContent === 'undefined' ? undefined : promptContent,
        irSchema: typeof irSchema === 'undefined' ? undefined : irSchema,
      },
    });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'Not found' });
    return res.status(500).json({ success: false, error: 'Failed to update prompt asset' });
  }
});

// Delete a prompt asset (guard if bound as production/default)
router.delete('/prompt-assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const boundCount = await (prisma as any).stepVersion.count({ where: { OR: [{ productionPromptId: id }, { defaultPromptId: id }] } });
    if (boundCount > 0) return res.status(409).json({ success: false, error: 'asset_bound_to_step_versions' });
    await (prisma as any).promptAsset.delete({ where: { id } });
    return res.status(204).end();
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'Not found' });
    return res.status(500).json({ success: false, error: 'Failed to delete prompt asset' });
  }
});

// Bind production prompt for a step version
router.put('/versions/:versionId/production-prompt', async (req, res) => {
  try {
    const { versionId } = req.params;
    const { assetId } = req.body as { assetId?: string | null };
    const updated = await (prisma as any).stepVersion.update({
      where: { id: versionId },
      data: { productionPromptId: typeof assetId === 'undefined' ? undefined : assetId },
    });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'Not found' });
    return res.status(500).json({ success: false, error: 'Failed to set production prompt' });
  }
});

// Bind default prompt for a step version
router.put('/versions/:versionId/default-prompt', async (req, res) => {
  try {
    const { versionId } = req.params;
    const { assetId } = req.body as { assetId?: string | null };
    const updated = await (prisma as any).stepVersion.update({
      where: { id: versionId },
      data: { defaultPromptId: typeof assetId === 'undefined' ? undefined : assetId },
    });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'Not found' });
    return res.status(500).json({ success: false, error: 'Failed to set default prompt' });
  }
});
