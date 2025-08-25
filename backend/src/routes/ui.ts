import express from 'express';
import prisma from '../services/database/prismaClient';

const router = express.Router();

// Stage 1: Minimal UI Manifest and Action endpoints
// - No DB migrations required
// - Derive executionMode from domainPhaseStep.params?.manual === true
// - Manual steps expose actions [approve, reject]

router.get('/flows/:flowId/manifest', async (req, res) => {
  try {
    const { flowId } = req.params;

    // Validate flow exists
    const flow = await (prisma as any).projectFlow.findUnique({
      where: { id: flowId },
      select: { id: true, key: true, name: true, description: true },
    });
    if (!flow) return res.status(404).json({ success: false, error: 'flow_not_found' });

    // Fetch phases
    const phases = await (prisma as any).domainPhase.findMany({
      where: { flowId },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, key: true, name: true, description: true, orderIndex: true },
    });

    // For simplicity, fetch steps per phase (can be optimized later)
    const manifestPhases = [] as any[];
    for (const ph of phases) {
      const steps = await (prisma as any).domainPhaseStep.findMany({
        where: { phaseId: ph.id },
        orderBy: { orderIndex: 'asc' },
        include: { step: true, pinnedVersion: true },
      });
      const mSteps = steps.map((s: any) => {
        const params = s.params || {};
        const manual = !!(params && params.manual === true);
        const executionMode = manual ? 'manual' : 'auto';
        const actions = manual ? ['approve', 'reject'] : [];
        const title = s.step?.name || s.step?.key || 'Step';
        return {
          id: s.id,
          stepId: s.stepId,
          title,
          stepKey: s.step?.key || null,
          orderIndex: s.orderIndex,
          executionMode,
          actions,
          uiHints: params.uiHints || null,
          params,
          pinnedStepVersionId: s.pinnedStepVersionId || null,
        };
      });
      manifestPhases.push({
        id: ph.id,
        key: ph.key,
        name: ph.name,
        description: ph.description,
        orderIndex: ph.orderIndex,
        steps: mSteps,
      });
    }

    return res.json({
      success: true,
      data: {
        flow,
        phases: manifestPhases,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'failed_to_build_manifest' });
  }
});

// Minimal manual action handler (no persistence yet; extend later)
router.post('/flows/:flowId/steps/:phaseStepId/action', async (req, res) => {
  try {
    const { flowId, phaseStepId } = req.params;
    const { action, comment, input } = req.body || {};
    if (!action) return res.status(400).json({ success: false, error: 'action_required' });

    // Validate phaseStep belongs to flow
    const dps = await (prisma as any).domainPhaseStep.findUnique({
      where: { id: phaseStepId },
      include: { step: true, pinnedVersion: true, phase: true },
    });
    if (!dps) return res.status(404).json({ success: false, error: 'phase_step_not_found' });
    if (dps.phase?.flowId !== flowId) return res.status(400).json({ success: false, error: 'step_not_in_flow' });

    // Derive if manual
    const manual = !!(dps.params && dps.params.manual === true);
    if (!manual) {
      // We still accept the call, but indicate it's not a manual step
      return res.status(400).json({ success: false, error: 'not_a_manual_step' });
    }

    // Echo back for now (future: persist to a table and emit events)
    return res.json({
      success: true,
      data: {
        received: {
          flowId,
          phaseStepId,
          action,
          comment: comment || null,
          input: typeof input === 'undefined' ? null : input,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'failed_to_process_action' });
  }
});

export default router;
