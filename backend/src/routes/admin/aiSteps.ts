import express from 'express';
import prisma from '../../services/database/prismaClient';

const router = express.Router();

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

// Create a version for a step (no prompt yet)
router.post('/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const { version, defaultConfig } = req.body as { version: string; defaultConfig?: any };
    if (!version) return res.status(400).json({ success: false, error: 'version is required' });
    const created = await prisma.stepVersion.create({
      data: {
        stepId: id,
        version,
        defaultConfig: defaultConfig ?? null,
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
    const { aiPromptId, defaultConfig, isActive } = req.body as { aiPromptId?: string | null; defaultConfig?: any; isActive?: boolean };

    const updated = await prisma.stepVersion.update({
      where: { id: versionId },
      data: {
        aiPromptId: typeof aiPromptId === 'undefined' ? undefined : aiPromptId,
        defaultConfig: typeof defaultConfig === 'undefined' ? undefined : defaultConfig,
        isActive: typeof isActive === 'undefined' ? undefined : !!isActive,
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
