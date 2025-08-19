import express from 'express';
import { TestRunnerService } from '../services/TestRunnerService';
import { TestStateStore } from '../services/TestStateStore';

const router = express.Router();
const runner = TestRunnerService.getInstance();
const store = new TestStateStore();

// POST /api/tests/start - start a new Jest run
router.post('/start', async (_req, res) => {
  try {
    const result = await runner.start();
    if ('error' in result) {
      return res.status(409).json({ success: false, error: result.error });
    }
    return res.json({ success: true, executionId: result.executionId });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to start tests' });
  }
});

// GET /api/tests/status - get current execution state
router.get('/status', (_req, res) => {
  const state = runner.getStatus();
  return res.json({ success: true, state });
});

// GET /api/tests/results - get last run results
router.get('/results', (_req, res) => {
  const results = runner.getResults();
  return res.json({ success: true, results });
});

// GET /api/tests/history - list recent results files
router.get('/history', (_req, res) => {
  const history = store.listHistory(20);
  return res.json({ success: true, history });
});

export default router;
