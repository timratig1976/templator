import { Router, Request, Response } from 'express';
import designUploadService from '../services/uploads/DesignUploadService';
import designUploadRepo from '../services/database/DesignUploadRepository';

const router = Router();

// GET /api/design-uploads?userId=...&limit=50&offset=0
router.get('/', async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || undefined;
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
  const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);
  try {
    const [data, total] = await Promise.all([
      userId
        ? designUploadRepo.listByUserPaginated(userId, limit, offset)
        : designUploadRepo.listAll(limit, offset),
      userId
        ? designUploadRepo.countByUser(userId)
        : designUploadRepo.countAll(),
    ]);
    // If nothing to enrich, return early
    if (!data.length) {
      const hasMore = offset + data.length < total;
      return res.json({ success: true, data, pagination: { limit, offset, count: data.length, total, hasMore } });
    }
    try {
      // Enrich with counts: number of splits and parts (json assets) per upload
      const prisma = (await import('../services/database/prismaClient')).default;
      const ids = data.map((u: any) => u.id);
      const [splitCounts, partCounts, latestSplits] = await Promise.all([
        prisma.designSplit.groupBy({
          by: ['designUploadId'],
          _count: { _all: true },
          where: { designUploadId: { in: ids } },
        }),
        prisma.splitAsset.findMany({
          where: { kind: 'json', split: { designUploadId: { in: ids } } },
          select: { id: true, splitId: true, split: { select: { designUploadId: true } } },
        }),
        // Find latest split per designUploadId by scanning ordered list once
        prisma.designSplit.findMany({
          where: { designUploadId: { in: ids } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, designUploadId: true },
        }),
      ]);
      const splitCountMap: Record<string, number> = {};
      for (const row of splitCounts) {
        splitCountMap[(row as any).designUploadId] = (row as any)._count?._all ?? 0;
      }
      const partCountMap: Record<string, number> = {};
      for (const asset of partCounts as any[]) {
        const uploadId = asset.split.designUploadId;
        partCountMap[uploadId] = (partCountMap[uploadId] || 0) + 1;
      }
      // Build lastSplitId map from latestSplits (first occurrence due to desc order)
      const lastSplitMap: Record<string, string> = {};
      for (const s of latestSplits as any[]) {
        const uploadId = s.designUploadId;
        if (!lastSplitMap[uploadId]) lastSplitMap[uploadId] = s.id;
      }

      const enriched = data.map((u: any) => ({
        ...u,
        splitCount: splitCountMap[u.id] ?? 0,
        partCount: partCountMap[u.id] ?? 0,
        lastSplitId: lastSplitMap[u.id] ?? null,
      }));
      const hasMore = offset + data.length < total;
      return res.json({ success: true, data: enriched, pagination: { limit, offset, count: data.length, total, hasMore } });
    } catch (enrichErr) {
      // Log enrichment error for diagnostics but do not fail the request
      console.error('[design-uploads] enrichment failed:', enrichErr instanceof Error ? enrichErr.stack || enrichErr.message : enrichErr);
      // Fallback: return without enrichment to avoid 500
      const hasMore = offset + data.length < total;
      return res.json({ success: true, data, pagination: { limit, offset, count: data.length, total, hasMore } });
    }
  } catch (e) {
    // Log outer error (likely DB connectivity or repository failure)
    console.error('[design-uploads] list failed (repo path):', e instanceof Error ? e.stack || e.message : e);
    // Try a direct prisma fallback to avoid 500s in the uploads table view
    try {
      const prisma = (await import('../services/database/prismaClient')).default;
      const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
      const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);
      const userId = (req.query.userId as string) || undefined;
      const [data, total] = await Promise.all([
        prisma.designUpload.findMany({
          where: userId ? { userId } : undefined,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.designUpload.count({ where: userId ? { userId } : undefined }),
      ]);
      const hasMore = offset + data.length < total;
      return res.json({ success: true, data, pagination: { limit, offset, count: data.length, total, hasMore } });
    } catch (fallbackErr) {
      console.error('[design-uploads] prisma fallback also failed:', fallbackErr instanceof Error ? fallbackErr.stack || fallbackErr.message : fallbackErr);
      // Final graceful fallback: return empty list to keep UI functional
      const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
      const offset = Math.max(parseInt((req.query.offset as string) || '0', 10), 0);
      const empty = { success: true, data: [], pagination: { limit, offset, count: 0, total: 0, hasMore: false } };
      return res.json(empty);
    }
  }
});

// DELETE /api/design-uploads/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existed = await designUploadService.deleteById(id);
    if (!existed) {
      return res.status(404).json({ success: false, error: 'DesignUpload not found' });
    }
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Failed to delete design upload' });
  }
});

// GET /api/design-uploads/:id (helper for tests/admin)
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const upload = await designUploadRepo.findById(id);
  if (!upload) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: upload });
});

export default router;
