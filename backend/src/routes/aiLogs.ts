import { Router } from 'express';
import { AILogService } from '../services/logging/AILogService';

const router = Router();

// GET /api/monitoring/ai-logs
router.get('/', async (req, res) => {
  try {
    const {
      limit,
      offset,
      level,
      category,
      process,
      from,
      to,
      rag,
      error,
      q,
    } = req.query as Record<string, string | undefined>;

    const { items, total } = await AILogService.query({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      level,
      category,
      process,
      from,
      to,
      rag,
      error,
      q,
    });

    res.json({ success: true, items, total });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to load AI logs' });
  }
});

export default router;
