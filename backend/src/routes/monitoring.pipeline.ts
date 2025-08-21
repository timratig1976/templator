import { Router } from 'express';
import { getFeatureFlags } from '../config/featureFlags';
import prisma from '../services/database/prismaClient';
import PipelineRegistry from '../services/pipeline/PipelineRegistry';
import StepTelemetryRunner from '../services/pipeline/StepTelemetryRunner';

// Read-only, additive monitoring routes for Pipeline/Step runs
// Registered conditionally in api.ts based on feature flag

const router = Router();

// GET /api/monitoring/pipelines/runs
// Returns recent PipelineRun rows with basic metadata
router.get('/runs', async (req, res) => {
  const flags = getFeatureFlags();
  if (!flags.PIPELINE_LOGGING_ENABLED) {
    return res.json({ enabled: false, runs: [], total: 0 });
  }

  try {
    const take = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
    const where: any = {};
    const origin = req.query.origin ? String(req.query.origin) : undefined;
    if (origin) where.origin = origin;
    const items = await (prisma as any).pipelineRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take,
      include: {
        PipelineVersion: {
          select: {
            id: true,
            version: true,
            definition: { select: { id: true, name: true } },
          },
        },
        _count: { select: { stepRuns: true } },
      },
    });

    const normalized = items.map((r: any) => ({
      id: r.id,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      pipeline: r.PipelineVersion?.definition?.name ?? 'unknown',
      version: r.PipelineVersion?.version ?? 'n/a',
      stepCount: r._count?.stepRuns ?? 0,
      summary: r.summary ?? null,
      origin: r.origin ?? null,
    }));

    res.json({ enabled: true, runs: normalized, total: normalized.length, filter: { origin: origin ?? null } });
  } catch (err: any) {
    res.status(500).json({ enabled: true, error: 'failed_to_list_runs', message: err?.message });
  }
});

// GET /api/monitoring/pipelines/runs/:id/steps
// Returns StepRun rows for a given PipelineRun
router.get('/runs/:id/steps', async (req, res) => {
  const flags = getFeatureFlags();
  if (!flags.PIPELINE_LOGGING_ENABLED) {
    return res.json({ enabled: false, steps: [] });
  }

  try {
    const steps = await (prisma as any).stepRun.findMany({
      where: { pipelineRunId: String(req.params.id) },
      orderBy: { startedAt: 'asc' },
      include: {
        StepVersion: {
          select: {
            id: true,
            version: true,
            definition: { select: { id: true, key: true, name: true } },
          },
        },
        _count: { select: { irArtifacts: true, metricResults: true, outputLinks: true } },
      },
    });

    const normalized = steps.map((s: any) => ({
      id: s.id,
      nodeKey: s.nodeKey,
      status: s.status,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      stepKey: s.StepVersion?.definition?.key ?? 'unknown',
      stepName: s.StepVersion?.definition?.name ?? s.nodeKey,
      stepVersion: s.StepVersion?.version ?? 'n/a',
      counts: {
        irArtifacts: s._count?.irArtifacts ?? 0,
        metrics: s._count?.metricResults ?? 0,
        outputs: s._count?.outputLinks ?? 0,
      },
      error: s.error ?? null,
      origin: s.origin ?? null,
    }));

    res.json({ enabled: true, steps: normalized });
  } catch (err: any) {
    res.status(500).json({ enabled: true, error: 'failed_to_list_step_runs', message: err?.message });
  }
});

// GET /api/monitoring/pipelines/steps/:id
// Returns a detailed StepRun view with IR, metrics, and output links
router.get('/steps/:id', async (req, res) => {
  const flags = getFeatureFlags();
  if (!flags.PIPELINE_LOGGING_ENABLED) {
    return res.json({ enabled: false, step: null, irPreview: null, metrics: [], outputs: [] });
  }

  try {
    const id = String(req.params.id);
    const step = await (prisma as any).stepRun.findUnique({
      where: { id },
      include: {
        StepVersion: { select: { version: true, definition: { select: { key: true, name: true } } } },
        irArtifacts: { orderBy: { createdAt: 'asc' } },
        metricResults: { orderBy: { createdAt: 'asc' } },
        outputLinks: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!step) {
      return res.status(404).json({ enabled: true, error: 'not_found' });
    }

    const irPreview = step.irArtifacts?.length ? step.irArtifacts[0] : null;
    const normalizedStep = {
      id: step.id,
      nodeKey: step.nodeKey,
      status: step.status,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      stepKey: step.StepVersion?.definition?.key ?? 'unknown',
      stepName: step.StepVersion?.definition?.name ?? step.nodeKey,
      stepVersion: step.StepVersion?.version ?? 'n/a',
      error: step.error ?? null,
      origin: (step as any).origin ?? null,
      counts: {
        irArtifacts: step.irArtifacts?.length ?? 0,
        metrics: step.metricResults?.length ?? 0,
        outputs: step.outputLinks?.length ?? 0,
      },
    };

    res.json({
      enabled: true,
      step: normalizedStep,
      irPreview,
      metrics: step.metricResults ?? [],
      outputs: step.outputLinks ?? [],
    });
  } catch (err: any) {
    res.status(500).json({ enabled: true, error: 'failed_to_get_step', message: err?.message });
  }
});

// POST /api/monitoring/pipelines/runs/quick
// Triggers a quick pipeline step run (primarily for maintenance testing)
// Body: { pipelineName: string, pipelineVersion?: string, stepKey: string, params?: object, summary?: object, origin?: string, originInfo?: object }
router.post('/runs/quick', async (req, res) => {
  const flags = getFeatureFlags();
  if (!flags.PIPELINE_LOGGING_ENABLED) {
    return res.status(403).json({ enabled: false, error: 'feature_disabled' });
  }

  try {
    const {
      pipelineName,
      pipelineVersion = 'v1',
      stepKey,
      params = {},
      summary = {},
      origin = 'maintenance_test',
      originInfo,
    } = req.body || {};

    if (!pipelineName || !stepKey) {
      return res.status(400).json({ enabled: true, error: 'invalid_request', message: 'pipelineName and stepKey are required' });
    }

    // Ensure pipeline and step exist
    const ensured = await PipelineRegistry.ensure({
      pipelineName,
      pipelineVersion,
      steps: [{ key: stepKey, name: stepKey }],
    });

    const stepVersionId = ensured.stepVersionByKey[stepKey];
    if (!stepVersionId) {
      return res.status(500).json({ enabled: true, error: 'step_not_ensured' });
    }

    // Run a single step with telemetry and origin tagging
    const run = await StepTelemetryRunner.runStep(
      {
        pipelineVersionId: ensured.pipelineVersionId,
        stepVersionId,
        nodeKey: stepKey,
        params,
        summary: { action: `quick_run:${stepKey}`, ...summary },
        origin,
        originInfo,
      },
      async () => ({ status: 'completed' })
    );

    return res.json({ enabled: true, success: true, data: { runId: run.runId, stepRunId: run.stepRunId } });
  } catch (err: any) {
    return res.status(500).json({ enabled: true, error: 'failed_to_quick_run', message: err?.message });
  }
});

export default router;
