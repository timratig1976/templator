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
    const hasMore = offset + data.length < total;
    return res.json({ success: true, data, pagination: { limit, offset, count: data.length, total, hasMore } });
  } catch (e) {
    return res.status(500).json({ success: false, error: e instanceof Error ? e.message : 'Failed to list uploads' });
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
