import express from 'express';
import prisma from '../../services/database/prismaClient';

const router = express.Router();

// -------- Project Flows --------
// AI-assisted generation (MVP heuristic; replace with real LLM + fuzzy matcher later)
router.post('/generate-from-brief', async (req, res) => {
  try {
    const { brief, flowId, flowKey, flowName, description, apply, overwrite } = req.body || {};
    if (!brief || typeof brief !== 'string' || !brief.trim()) {
      return res.status(400).json({ success: false, error: 'brief_required' });
    }

    // Fetch StepDefinitions to match against
    const steps = await (prisma as any).stepDefinition.findMany({
      select: { id: true, key: true, name: true, description: true },
      orderBy: { createdAt: 'asc' },
    });

    const text = brief.toLowerCase();
    const tokens = Array.from(new Set(text.split(/[^a-z0-9]+/g).filter(Boolean)));

    function scoreStep(s: any) {
      const hay = `${s.key || ''} ${s.name || ''} ${s.description || ''}`.toLowerCase();
      let hits = 0;
      for (const t of tokens) {
        if (t.length < 3) continue;
        if (hay.includes(t)) hits += 1;
      }
      const denom = Math.max(1, Math.min(12, tokens.length));
      const confidence = Math.min(0.99, hits / denom);
      return { hits, confidence };
    }

    const scored = steps
      .map((s: any) => ({ step: s, ...scoreStep(s) }))
      .sort((a: any, b: any) => b.confidence - a.confidence || b.hits - a.hits)
      .slice(0, Math.min(12, steps.length));

    // Proposal: single phase 'generated' for MVP
    const proposedPhaseKey = `generated_main`;
    const proposedPhaseName = `Generated`;
    const proposedSteps = scored
      .filter((x: any) => x.confidence > 0)
      .map((x: any, idx: number) => ({
        stepId: String(x.step.id),
        stepKey: x.step.key,
        stepName: x.step.name,
        confidence: Number(x.confidence.toFixed(2)),
        rationale: `Matched ${x.hits} keyword(s) from brief against step key/name/description.`,
        orderIndex: idx,
      }));

    const proposal = {
      phases: [
        {
          key: proposedPhaseKey,
          name: proposedPhaseName,
          steps: proposedSteps,
        },
      ],
      summary: {
        totalSteps: steps.length,
        proposedStepCount: proposedSteps.length,
        tokensConsidered: tokens.length,
      },
    };

    if (!apply) {
      return res.json({ success: true, data: { dryRun: true, proposal } });
    }

    // Apply: create or update a flow with proposed phases/steps
    let targetFlow: any = null;
    if (flowId) {
      targetFlow = await (prisma as any).projectFlow.findUnique({ where: { id: String(flowId) } });
      if (!targetFlow) return res.status(404).json({ success: false, error: 'flow_not_found' });
    } else {
      if (!flowKey || !flowName) return res.status(400).json({ success: false, error: 'flowKey_and_flowName_required_to_create' });
      // Create a new flow
      targetFlow = await (prisma as any).projectFlow.create({
        data: {
          key: String(flowKey),
          name: String(flowName),
          description: typeof description === 'string' ? description : null,
        },
      });
    }

    const nowSuffix = Date.now().toString().slice(-6);
    const phaseKeyFinal = `${proposedPhaseKey}_${nowSuffix}`;

    const result = await prisma.$transaction(async (tx) => {
      // Optionally overwrite: remove existing phases for the flow
      if (overwrite === true) {
        const existingPhases = await (tx as any).domainPhase.findMany({ where: { flowId: targetFlow.id }, select: { id: true } });
        const existingPhaseIds = existingPhases.map((p: any) => p.id);
        if (existingPhaseIds.length) {
          // delete steps then phases
          await (tx as any).domainPhaseStep.deleteMany({ where: { phaseId: { in: existingPhaseIds } } });
          await (tx as any).domainPhase.deleteMany({ where: { id: { in: existingPhaseIds } } });
        }
      }

      // Determine next orderIndex for phases
      const maxPhase = await (tx as any).domainPhase.findFirst({ where: { flowId: targetFlow.id }, orderBy: { orderIndex: 'desc' }, select: { orderIndex: true } });
      const phaseOrderIndex = (maxPhase?.orderIndex ?? -1) + 1;

      const createdPhase = await (tx as any).domainPhase.create({
        data: { flowId: targetFlow.id, key: phaseKeyFinal, name: proposedPhaseName, description: null, orderIndex: phaseOrderIndex },
      });

      // Create steps
      for (const st of proposedSteps) {
        await (tx as any).domainPhaseStep.create({
          data: {
            phaseId: createdPhase.id,
            stepId: st.stepId,
            orderIndex: st.orderIndex,
            // Leave pinnedStepVersionId null to follow active versions
          },
        });
      }

      return { createdPhase };
    });

    return res.json({
      success: true,
      data: {
        dryRun: false,
        flow: targetFlow,
        createdPhase: result.createdPhase,
        proposal,
      },
    });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ success: false, error: 'flow_key_conflict' });
    return res.status(500).json({ success: false, error: 'failed_to_generate_from_brief' });
  }
});
router.get('/', async (_req, res) => {
  try {
    const flows = await (prisma as any).projectFlow.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        phases: { orderBy: { orderIndex: 'asc' } },
        pipeline: true,
        pinnedPipelineVersion: true,
      },
    });
    return res.json({ success: true, data: flows });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'failed_to_list_flows' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { key, name, description, isActive, pipelineId, pinnedPipelineVersionId } = req.body || {};
    if (!key || !name) return res.status(400).json({ success: false, error: 'key_and_name_required' });
    // Optional validation: if pinnedPipelineVersionId provided but pipelineId omitted, infer
    let inferredPipelineId: string | undefined = undefined;
    if (pinnedPipelineVersionId && !pipelineId) {
      const pinned = await (prisma as any).pipelineVersion.findUnique({ where: { id: pinnedPipelineVersionId } });
      if (!pinned) return res.status(400).json({ success: false, error: 'pinned_pipeline_version_not_found' });
      inferredPipelineId = (pinned as any).pipelineId;
    }
    // If both provided, ensure they match
    if (pinnedPipelineVersionId && (pipelineId || inferredPipelineId)) {
      const pinned = await (prisma as any).pipelineVersion.findUnique({ where: { id: pinnedPipelineVersionId } });
      if (!pinned) return res.status(400).json({ success: false, error: 'pinned_pipeline_version_not_found' });
      const pinPid = (pinned as any).pipelineId;
      if (pipelineId && pipelineId !== pinPid) return res.status(400).json({ success: false, error: 'pinned_version_pipeline_mismatch' });
      if (inferredPipelineId && inferredPipelineId !== pinPid) return res.status(400).json({ success: false, error: 'pinned_version_pipeline_mismatch' });
    }
    const created = await (prisma as any).projectFlow.create({
      data: {
        key,
        name,
        description: description ?? null,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
        pipelineId: (pipelineId ?? inferredPipelineId) || undefined,
        pinnedPipelineVersionId: typeof pinnedPipelineVersionId === 'undefined' ? undefined : pinnedPipelineVersionId,
      },
      include: { pipeline: true, pinnedPipelineVersion: true },
    });
    return res.status(201).json({ success: true, data: created });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ success: false, error: 'flow_key_conflict' });
    return res.status(500).json({ success: false, error: 'failed_to_create_flow' });
  }
});

router.patch('/:flowId', async (req, res) => {
  try {
    const { flowId } = req.params;
    const { key, name, description, isActive, pipelineId, pinnedPipelineVersionId } = req.body || {};
    // Validate optional binding
    let nextPipelineId = pipelineId as string | undefined;
    if (typeof pinnedPipelineVersionId !== 'undefined') {
      if (pinnedPipelineVersionId === null) {
        // unpin request, leave pipelineId as-is unless explicitly provided
      } else {
        const pinned = await (prisma as any).pipelineVersion.findUnique({ where: { id: String(pinnedPipelineVersionId) } });
        if (!pinned) return res.status(400).json({ success: false, error: 'pinned_pipeline_version_not_found' });
        const pinPid = (pinned as any).pipelineId;
        // If caller also passes pipelineId, ensure match. Else infer
        if (nextPipelineId && nextPipelineId !== pinPid) return res.status(400).json({ success: false, error: 'pinned_version_pipeline_mismatch' });
        if (!nextPipelineId) nextPipelineId = pinPid;
      }
    }
    const updated = await (prisma as any).projectFlow.update({
      where: { id: flowId },
      data: {
        key: typeof key === 'undefined' ? undefined : key,
        name: typeof name === 'undefined' ? undefined : name,
        description: typeof description === 'undefined' ? undefined : description,
        isActive: typeof isActive === 'undefined' ? undefined : !!isActive,
        pipelineId: typeof nextPipelineId === 'undefined' ? undefined : nextPipelineId,
        pinnedPipelineVersionId: typeof pinnedPipelineVersionId === 'undefined' ? undefined : pinnedPipelineVersionId,
      },
      include: { pipeline: true, pinnedPipelineVersion: true },
    });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'flow_not_found' });
    if (e?.code === 'P2002') return res.status(409).json({ success: false, error: 'flow_key_conflict' });
    return res.status(500).json({ success: false, error: 'failed_to_update_flow' });
  }
});

// Bind a pipeline to a flow (and optionally set pin)
router.patch('/:flowId/pipeline', async (req, res) => {
  try {
    const { flowId } = req.params;
    const { pipelineId, pinnedPipelineVersionId } = req.body || {};
    if (!pipelineId && !pinnedPipelineVersionId) return res.status(400).json({ success: false, error: 'nothing_to_update' });
    let nextPipelineId = pipelineId as string | undefined;
    if (pinnedPipelineVersionId) {
      const pinned = await (prisma as any).pipelineVersion.findUnique({ where: { id: String(pinnedPipelineVersionId) } });
      if (!pinned) return res.status(400).json({ success: false, error: 'pinned_pipeline_version_not_found' });
      const pinPid = (pinned as any).pipelineId;
      if (nextPipelineId && nextPipelineId !== pinPid) return res.status(400).json({ success: false, error: 'pinned_version_pipeline_mismatch' });
      if (!nextPipelineId) nextPipelineId = pinPid;
    }
    const updated = await (prisma as any).projectFlow.update({
      where: { id: flowId },
      data: { pipelineId: nextPipelineId, pinnedPipelineVersionId: typeof pinnedPipelineVersionId === 'undefined' ? undefined : pinnedPipelineVersionId },
      include: { pipeline: true, pinnedPipelineVersion: true },
    });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'flow_not_found' });
    return res.status(500).json({ success: false, error: 'failed_to_bind_pipeline' });
  }
});

// Unpin the pipeline version for a flow (keeps pipelineId)
router.patch('/:flowId/pipeline/unpin', async (req, res) => {
  try {
    const { flowId } = req.params;
    const updated = await (prisma as any).projectFlow.update({
      where: { id: flowId },
      data: { pinnedPipelineVersionId: null },
      include: { pipeline: true, pinnedPipelineVersion: true },
    });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'flow_not_found' });
    return res.status(500).json({ success: false, error: 'failed_to_unpin_pipeline' });
  }
});

router.delete('/:flowId', async (req, res) => {
  try {
    const { flowId } = req.params;
    await (prisma as any).projectFlow.delete({ where: { id: flowId } });
    return res.status(204).end();
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'flow_not_found' });
    return res.status(500).json({ success: false, error: 'failed_to_delete_flow' });
  }
});

// -------- Domain Phases --------
router.get('/:flowId/phases', async (req, res) => {
  try {
    const { flowId } = req.params;
    const phases = await (prisma as any).domainPhase.findMany({
      where: { flowId },
      orderBy: { orderIndex: 'asc' },
    });
    return res.json({ success: true, data: phases });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'failed_to_list_phases' });
  }
});

router.post('/:flowId/phases', async (req, res) => {
  try {
    const { flowId } = req.params;
    const { key, name, description } = req.body || {};
    if (!key || !name) return res.status(400).json({ success: false, error: 'key_and_name_required' });

    // Determine next orderIndex
    const max = await (prisma as any).domainPhase.findFirst({
      where: { flowId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    const orderIndex = (max?.orderIndex ?? -1) + 1;

    const created = await (prisma as any).domainPhase.create({
      data: { flowId, key, name, description: description ?? null, orderIndex },
    });
    return res.status(201).json({ success: true, data: created });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ success: false, error: 'phase_key_conflict' });
    return res.status(500).json({ success: false, error: 'failed_to_create_phase' });
  }
});

router.patch('/phases/:phaseId', async (req, res) => {
  try {
    const { phaseId } = req.params;
    const { key, name, description, orderIndex } = req.body || {};
    const updated = await (prisma as any).domainPhase.update({
      where: { id: phaseId },
      data: {
        key: typeof key === 'undefined' ? undefined : key,
        name: typeof name === 'undefined' ? undefined : name,
        description: typeof description === 'undefined' ? undefined : description,
        orderIndex: typeof orderIndex === 'undefined' ? undefined : orderIndex,
      },
    });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'phase_not_found' });
    if (e?.code === 'P2002') return res.status(409).json({ success: false, error: 'phase_key_conflict' });
    return res.status(500).json({ success: false, error: 'failed_to_update_phase' });
  }
});

router.post('/phases/reorder', async (req, res) => {
  try {
    const { flowId, orderedPhaseIds } = req.body as { flowId: string; orderedPhaseIds: string[] };
    if (!flowId || !Array.isArray(orderedPhaseIds)) return res.status(400).json({ success: false, error: 'invalid_payload' });
    await prisma.$transaction(
      orderedPhaseIds.map((id, idx) => (prisma as any).domainPhase.update({ where: { id, flowId }, data: { orderIndex: idx } }))
    );
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'failed_to_reorder_phases' });
  }
});

router.delete('/phases/:phaseId', async (req, res) => {
  try {
    const { phaseId } = req.params;
    await (prisma as any).domainPhase.delete({ where: { id: phaseId } });
    return res.status(204).end();
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'phase_not_found' });
    return res.status(500).json({ success: false, error: 'failed_to_delete_phase' });
  }
});

// -------- Domain Phase Steps (hybrid binding) --------
router.get('/phases/:phaseId/steps', async (req, res) => {
  try {
    const { phaseId } = req.params;
    const items = await (prisma as any).domainPhaseStep.findMany({
      where: { phaseId },
      orderBy: { orderIndex: 'asc' },
      include: { step: true, pinnedVersion: true },
    });
    return res.json({ success: true, data: items });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'failed_to_list_phase_steps' });
  }
});

router.post('/phases/:phaseId/steps', async (req, res) => {
  try {
    const { phaseId } = req.params;
    const { stepId, pinnedStepVersionId, params } = req.body || {};
    if (!stepId) return res.status(400).json({ success: false, error: 'stepId_required' });

    // Validate phase exists
    const phase = await (prisma as any).domainPhase.findUnique({ where: { id: phaseId } });
    if (!phase) return res.status(404).json({ success: false, error: 'phase_not_found' });

    // Validate step definition exists
    const stepDef = await (prisma as any).stepDefinition.findUnique({ where: { id: String(stepId) } });
    if (!stepDef) return res.status(404).json({ success: false, error: 'step_not_found' });

    // Enforce (only if bound): step must belong to the flow's bound pipeline version (pinned or active)
    // Find the flow to get pipeline binding
    const flow = await (prisma as any).projectFlow.findUnique({ where: { id: phase.flowId } });
    if (!flow) return res.status(404).json({ success: false, error: 'flow_not_found' });

    // Resolve effective pipeline version: pinned on flow, else active for pipeline
    let effectivePv: any = null;
    if (flow.pinnedPipelineVersionId) {
      effectivePv = await (prisma as any).pipelineVersion.findUnique({ where: { id: flow.pinnedPipelineVersionId } });
      if (!effectivePv) return res.status(400).json({ success: false, error: 'pinned_pipeline_version_not_found' });
    } else if (flow.pipelineId) {
      effectivePv = await (prisma as any).pipelineVersion.findFirst({ where: { pipelineId: flow.pipelineId, isActive: true } });
      if (!effectivePv) {
        // Flow bound to pipeline but no active version -> cannot validate membership
        return res.status(400).json({ success: false, error: 'no_active_pipeline_version_for_flow' });
      }
    }

    // If there is an effective pipeline version, enforce membership; else allow (unbound flow prototype mode)
    let allowedStepVersionIds: Set<string> | null = null;
    if (effectivePv) {
      const dagNodes: any[] = Array.isArray(effectivePv?.dag?.nodes) ? effectivePv.dag.nodes : [];
      const pvStepVersionIds: string[] = dagNodes.map((n: any) => n?.stepVersionId).filter((id: any) => typeof id === 'string');
      if (pvStepVersionIds.length === 0) return res.status(400).json({ success: false, error: 'pipeline_version_has_no_steps' });

      const stepVersions = await (prisma as any).stepVersion.findMany({ where: { id: { in: pvStepVersionIds } }, select: { id: true, stepId: true } });
      const allowedStepIds = new Set<string>(stepVersions.map((sv: any) => String(sv.stepId)));
      allowedStepVersionIds = new Set<string>(stepVersions.map((sv: any) => String(sv.id)));
      if (!allowedStepIds.has(String(stepId))) {
        return res.status(400).json({ success: false, error: 'step_not_in_bound_pipeline' });
      }
    }

    // Validate pinned step version if provided
    if (typeof pinnedStepVersionId !== 'undefined' && pinnedStepVersionId !== null) {
      const stepVer = await (prisma as any).stepVersion.findUnique({ where: { id: String(pinnedStepVersionId) }, select: { id: true, stepId: true } });
      if (!stepVer) return res.status(400).json({ success: false, error: 'pinned_step_version_not_found' });
      if (String(stepVer.stepId) !== String(stepId)) {
        return res.status(400).json({ success: false, error: 'pinned_step_version_mismatch_step' });
      }
      // Only enforce DAG membership if effective pipeline version exists
      if (allowedStepVersionIds && !allowedStepVersionIds.has(String(pinnedStepVersionId))) {
        return res.status(400).json({ success: false, error: 'pinned_step_version_not_in_pipeline' });
      }
    }

    // next orderIndex
    const max = await (prisma as any).domainPhaseStep.findFirst({
      where: { phaseId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    const orderIndex = (max?.orderIndex ?? -1) + 1;

    const created = await (prisma as any).domainPhaseStep.create({
      data: {
        phaseId,
        stepId,
        pinnedStepVersionId: typeof pinnedStepVersionId === 'undefined' ? undefined : pinnedStepVersionId,
        orderIndex,
        params: typeof params === 'undefined' ? undefined : params,
      },
      include: { step: true, pinnedVersion: true },
    });
    return res.status(201).json({ success: true, data: created });
  } catch (e: any) {
    // Map common Prisma errors
    if (e?.code === 'P2003') {
      // Foreign key constraint failed
      return res.status(400).json({ success: false, error: 'foreign_key_violation' });
    }
    return res.status(500).json({ success: false, error: 'failed_to_add_phase_step' });
  }
});

router.patch('/phase-steps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { pinnedStepVersionId, params, orderIndex } = req.body || {};
    // Load existing DPS to know phase/flow and stepId
    const existing = await (prisma as any).domainPhaseStep.findUnique({
      where: { id },
      include: { phase: true },
      select: undefined as any,
    } as any);
    if (!existing) return res.status(404).json({ success: false, error: 'phase_step_not_found' });

    // Resolve effective pipeline version for this DPS's flow
    const flow = await (prisma as any).projectFlow.findUnique({ where: { id: existing.phase.flowId } });
    if (!flow) return res.status(404).json({ success: false, error: 'flow_not_found' });
    let effectivePv: any = null;
    if (flow.pinnedPipelineVersionId) {
      effectivePv = await (prisma as any).pipelineVersion.findUnique({ where: { id: flow.pinnedPipelineVersionId } });
      if (!effectivePv) return res.status(400).json({ success: false, error: 'pinned_pipeline_version_not_found' });
    } else if (flow.pipelineId) {
      effectivePv = await (prisma as any).pipelineVersion.findFirst({ where: { pipelineId: flow.pipelineId, isActive: true } });
      if (!effectivePv) return res.status(400).json({ success: false, error: 'no_active_pipeline_version_for_flow' });
    }

    let allowedStepVersionIds: Set<string> | null = null;
    if (effectivePv) {
      const nodes: any[] = Array.isArray(effectivePv?.dag?.nodes) ? effectivePv.dag.nodes : [];
      const pvStepVersionIds: string[] = nodes.map((n: any) => n?.stepVersionId).filter((x: any) => typeof x === 'string');
      allowedStepVersionIds = new Set<string>(pvStepVersionIds);
    }

    if (typeof pinnedStepVersionId !== 'undefined' && pinnedStepVersionId !== null) {
      // Validate pinned version belongs to the same StepDefinition and is present in the pipeline version DAG
      const sv = await (prisma as any).stepVersion.findUnique({ where: { id: String(pinnedStepVersionId) }, select: { id: true, stepId: true } });
      if (!sv) return res.status(400).json({ success: false, error: 'pinned_step_version_not_found' });

      // Get the existing stepId
      const dps = await (prisma as any).domainPhaseStep.findUnique({ where: { id }, select: { stepId: true } });
      if (!dps) return res.status(404).json({ success: false, error: 'phase_step_not_found' });
      if (String(sv.stepId) !== String(dps.stepId)) {
        return res.status(400).json({ success: false, error: 'pinned_step_version_mismatch_step' });
      }
      // Only enforce DAG membership if effective pipeline version exists (i.e., flow is bound)
      if (allowedStepVersionIds && !allowedStepVersionIds.has(String(pinnedStepVersionId))) {
        return res.status(400).json({ success: false, error: 'pinned_step_version_not_in_pipeline' });
      }
    }

    const updated = await (prisma as any).domainPhaseStep.update({
      where: { id },
      data: {
        pinnedStepVersionId: typeof pinnedStepVersionId === 'undefined' ? undefined : pinnedStepVersionId,
        params: typeof params === 'undefined' ? undefined : params,
        orderIndex: typeof orderIndex === 'undefined' ? undefined : orderIndex,
      },
      include: { step: true, pinnedVersion: true },
    });
    return res.json({ success: true, data: updated });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'phase_step_not_found' });
    return res.status(500).json({ success: false, error: 'failed_to_update_phase_step' });
  }
});

router.post('/phases/:phaseId/steps/reorder', async (req, res) => {
  try {
    const { phaseId } = req.params;
    const { orderedIds } = req.body as { orderedIds: string[] };
    if (!Array.isArray(orderedIds)) return res.status(400).json({ success: false, error: 'invalid_payload' });
    await prisma.$transaction(
      orderedIds.map((id, idx) => (prisma as any).domainPhaseStep.update({ where: { id, phaseId }, data: { orderIndex: idx } }))
    );
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'failed_to_reorder_phase_steps' });
  }
});

router.delete('/phase-steps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await (prisma as any).domainPhaseStep.delete({ where: { id } });
    return res.status(204).end();
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ success: false, error: 'phase_step_not_found' });
    return res.status(500).json({ success: false, error: 'failed_to_delete_phase_step' });
  }
});

export default router;

// -------- Helper: allowed steps for a flow --------
// Returns the StepDefinitions that are present in the bound pipeline version (pinned or active).
router.get('/:flowId/allowed-steps', async (req, res) => {
  try {
    const { flowId } = req.params;
    const flow = await (prisma as any).projectFlow.findUnique({ where: { id: String(flowId) } });
    if (!flow) return res.status(404).json({ success: false, error: 'flow_not_found' });

    let effectivePv: any = null;
    if (flow.pinnedPipelineVersionId) {
      effectivePv = await (prisma as any).pipelineVersion.findUnique({ where: { id: flow.pinnedPipelineVersionId } });
    } else if (flow.pipelineId) {
      effectivePv = await (prisma as any).pipelineVersion.findFirst({ where: { pipelineId: flow.pipelineId, isActive: true } });
    }

    if (!effectivePv) {
      return res.json({ success: true, data: { allowedSteps: [], pipelineBound: !!flow.pipelineId, activePipelineVersion: null } });
    }

    const nodes: any[] = Array.isArray(effectivePv?.dag?.nodes) ? effectivePv.dag.nodes : [];
    const pvStepVersionIds: string[] = nodes.map((n: any) => n?.stepVersionId).filter((x: any) => typeof x === 'string');
    if (pvStepVersionIds.length === 0) {
      return res.json({ success: true, data: { allowedSteps: [], pipelineBound: true, activePipelineVersion: effectivePv.id } });
    }

    const stepVersions = await (prisma as any).stepVersion.findMany({ where: { id: { in: pvStepVersionIds } }, select: { id: true, stepId: true } });
    const stepIds = Array.from(new Set<string>(stepVersions.map((sv: any) => String(sv.stepId))));

    const steps = await (prisma as any).stepDefinition.findMany({ where: { id: { in: stepIds } }, select: { id: true, key: true, name: true, description: true } });
    return res.json({ success: true, data: { allowedSteps: steps, pipelineBound: true, activePipelineVersion: effectivePv.id } });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'failed_to_get_allowed_steps' });
  }
});
