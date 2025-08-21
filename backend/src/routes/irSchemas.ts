import { Router } from 'express';
import prisma from '../services/database/prismaClient';

const router = Router();

// NOTE: The Prisma Client may not be regenerated yet; access the model via `as any` to avoid TS errors.
const IR = (prisma as any).iRSchema;

// List IR Schemas for a StepVersion
router.get('/', async (req, res, next) => {
  try {
    const stepVersionId = String(req.query.stepVersionId || '');
    if (!stepVersionId) return res.status(400).json({ error: 'stepVersionId is required' });

    const items = await IR.findMany({
      where: { stepVersionId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// Create IR Schema
router.post('/', async (req, res, next) => {
  try {
    const { stepVersionId, name, version, schema, isActive } = req.body || {};
    if (!stepVersionId || !name || !version || schema == null) {
      return res.status(400).json({ error: 'stepVersionId, name, version, schema are required' });
    }

    if (isActive) {
      // Deactivate others for this step version
      await IR.updateMany({ where: { stepVersionId }, data: { isActive: false } });
    }

    const created = await IR.create({
      data: { stepVersionId, name, version, schema, isActive: !!isActive },
    });
    res.status(201).json({ item: created });
  } catch (err) {
    next(err);
  }
});

// Update IR Schema
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, schema, isActive } = req.body || {};

    const existing = await IR.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    if (isActive === true) {
      await IR.updateMany({ where: { stepVersionId: existing.stepVersionId }, data: { isActive: false } });
    }

    const updated = await IR.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        schema: schema ?? existing.schema,
        isActive: isActive ?? existing.isActive,
      },
    });
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

// Activate IR Schema (single active per StepVersion)
router.post('/:id/activate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await IR.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await IR.updateMany({ where: { stepVersionId: existing.stepVersionId }, data: { isActive: false } });
    const activated = await IR.update({ where: { id }, data: { isActive: true } });

    res.json({ item: activated });
  } catch (err) {
    next(err);
  }
});

export default router;
