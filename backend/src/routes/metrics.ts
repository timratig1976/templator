import { Router } from 'express';
import prisma from '../services/database/prismaClient';

const router = Router();

// ----- Metric Definitions -----
router.get('/definitions', async (_req, res, next) => {
  try {
    const items = await prisma.metricDefinition.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/definitions', async (req, res, next) => {
  try {
    const { key, name, description, unit, target, aggregation, scope } = req.body || {};
    if (!key || !name) return res.status(400).json({ error: 'key and name are required' });
    const item = await prisma.metricDefinition.create({
      data: { key, name, description, unit, target, aggregation, scope },
    });
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

router.put('/definitions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, unit, target, aggregation, scope } = req.body || {};
    const existing = await prisma.metricDefinition.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const item = await prisma.metricDefinition.update({
      where: { id },
      data: { name, description, unit, target, aggregation, scope },
    });
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// ----- Metric Profiles -----
router.get('/profiles', async (_req, res, next) => {
  try {
    const items = await prisma.metricProfile.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { metric: true } } },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/profiles', async (req, res, next) => {
  try {
    const { name, description, isActive } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    if (isActive) {
      await prisma.metricProfile.updateMany({ data: { isActive: false } });
    }

    const item = await prisma.metricProfile.create({ data: { name, description, isActive: !!isActive } });
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

router.put('/profiles/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body || {};
    const existing = await prisma.metricProfile.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    if (isActive === true) {
      await prisma.metricProfile.updateMany({ data: { isActive: false } });
    }

    const item = await prisma.metricProfile.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        description: description ?? existing.description,
        isActive: isActive ?? existing.isActive,
      },
    });
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

// Add item to profile
router.post('/profiles/:id/items', async (req, res, next) => {
  try {
    const { id } = req.params; // profile id
    const { metricId, weight, threshold, config } = req.body || {};
    if (!metricId) return res.status(400).json({ error: 'metricId is required' });

    const exists = await prisma.metricProfile.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ error: 'Profile not found' });

    const item = await prisma.metricProfileItem.create({
      data: { profileId: id, metricId, weight, threshold, config },
      include: { metric: true },
    });
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

// Remove item from profile
router.delete('/profiles/items/:itemId', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const existing = await prisma.metricProfileItem.findUnique({ where: { id: itemId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.metricProfileItem.delete({ where: { id: itemId } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
