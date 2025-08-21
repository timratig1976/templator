import 'dotenv/config';
import prisma from '../src/services/database/prismaClient';
import { getFeatureFlags } from '../src/config/featureFlags';

async function main() {
  const { PIPELINE_LOGGING_ENABLED } = getFeatureFlags();
  if (!PIPELINE_LOGGING_ENABLED) {
    console.log('[seed] Skipped: PIPELINE_LOGGING_ENABLED=false');
    return;
  }

  // Seed a basic pipeline with two steps and IR/metrics
  const pipelineName = 'templator-default';
  const pipelineVersion = 'v1';

  const stepAKey = 'ingest_upload';
  const stepBKey = 'generate_module';

  console.log('[seed] Starting...');

  // PipelineDefinition
  const pipelineDef = await (prisma as any).pipelineDefinition.upsert({
    where: { name: pipelineName },
    update: {},
    create: {
      name: pipelineName,
      description: 'Default Templator pipeline (ingest -> generate)',
    },
  });

  // PipelineVersion
  const pver = await (prisma as any).pipelineVersion.upsert({
    where: { pipelineId_version: { pipelineId: pipelineDef.id, version: pipelineVersion } },
    update: {},
    create: {
      pipelineId: pipelineDef.id,
      version: pipelineVersion,
      isActive: true,
      dag: {
        nodes: [
          { key: stepAKey, next: [stepBKey] },
          { key: stepBKey, next: [] },
        ],
      },
      config: {},
    },
  });

  // Step A definition + version
  const stepADef = await (prisma as any).stepDefinition.upsert({
    where: { key: stepAKey },
    update: {},
    create: { key: stepAKey, name: 'Ingest Upload', description: 'Accept uploaded design' },
  });
  const stepAVer = await (prisma as any).stepVersion.upsert({
    where: { stepId_version: { stepId: stepADef.id, version: 'v1' } },
    update: {},
    create: {
      stepId: stepADef.id,
      version: 'v1',
      isActive: true,
      defaultConfig: { accept: ['image/jpeg', 'image/png'] },
    },
  });
  await (prisma as any).iRSchema.upsert({
    where: { stepVersionId_version: { stepVersionId: stepAVer.id, version: '1' } },
    update: {},
    create: {
      stepVersionId: stepAVer.id,
      name: 'UploadIR',
      version: '1',
      schema: { type: 'object', properties: { uploadId: { type: 'string' } }, required: ['uploadId'] },
      isActive: true,
    },
  });

  // Step B definition + version
  const stepBDef = await (prisma as any).stepDefinition.upsert({
    where: { key: stepBKey },
    update: {},
    create: { key: stepBKey, name: 'Generate Module', description: 'Generate HubSpot module' },
  });
  const stepBVer = await (prisma as any).stepVersion.upsert({
    where: { stepId_version: { stepId: stepBDef.id, version: 'v1' } },
    update: {},
    create: {
      stepId: stepBDef.id,
      version: 'v1',
      isActive: true,
      defaultConfig: { framework: 'hubspot' },
    },
  });
  await (prisma as any).iRSchema.upsert({
    where: { stepVersionId_version: { stepVersionId: stepBVer.id, version: '1' } },
    update: {},
    create: {
      stepVersionId: stepBVer.id,
      name: 'ModuleIR',
      version: '1',
      schema: { type: 'object', properties: { moduleId: { type: 'string' } }, required: ['moduleId'] },
      isActive: true,
    },
  });

  // Metrics: definitions and profile
  const latencyDef = await (prisma as any).metricDefinition.upsert({
    where: { key: 'latency_ms' },
    update: {},
    create: { key: 'latency_ms', name: 'Latency (ms)', unit: 'ms', aggregation: 'avg', scope: 'step' },
  });
  const validityDef = await (prisma as any).metricDefinition.upsert({
    where: { key: 'ir_valid' },
    update: {},
    create: { key: 'ir_valid', name: 'IR Valid', unit: 'bool', aggregation: 'ratio', scope: 'step' },
  });

  let profile = await (prisma as any).metricProfile.findFirst({ where: { name: 'default-step-profile' } });
  if (!profile) {
    profile = await (prisma as any).metricProfile.create({ data: { name: 'default-step-profile', isActive: true } });
  }

  // Ensure items exist (idempotent-ish)
  const items: Array<{ metricId: string }> = await (prisma as any).metricProfileItem.findMany({ where: { profileId: profile.id } });
  const haveLatency = items.some((i: { metricId: string }) => i.metricId === latencyDef.id);
  const haveValidity = items.some((i: { metricId: string }) => i.metricId === validityDef.id);
  if (!haveLatency) {
    await (prisma as any).metricProfileItem.create({ data: { profileId: profile.id, metricId: latencyDef.id, weight: 0.5 } });
  }
  if (!haveValidity) {
    await (prisma as any).metricProfileItem.create({ data: { profileId: profile.id, metricId: validityDef.id, weight: 0.5 } });
  }

  // Create a sample PipelineRun with two StepRuns if none exist yet for this version
  const existingRun = await (prisma as any).pipelineRun.findFirst({
    where: { pipelineVersionId: pver.id },
  });

  if (!existingRun) {
    const now = new Date();
    const run = await (prisma as any).pipelineRun.create({
      data: {
        pipelineVersionId: pver.id,
        status: 'completed',
        startedAt: now,
        completedAt: now,
        summary: { note: 'seeded run' },
      },
    });

    // Step A run
    const srunA = await (prisma as any).stepRun.create({
      data: {
        pipelineRunId: run.id,
        stepVersionId: stepAVer.id,
        nodeKey: stepAKey,
        status: 'completed',
        startedAt: now,
        completedAt: now,
        params: { fileType: 'image/jpeg' },
      },
    });
    await (prisma as any).iRArtifact.create({
      data: {
        stepRunId: srunA.id,
        irJson: { uploadId: 'seed-upload-1' },
        isValid: true,
        validationErrors: [],
      },
    });
    await (prisma as any).metricResult.createMany({
      data: [
        { stepRunId: srunA.id, metricKey: 'latency_ms', value: 120, passed: true, details: { source: 'seed' } },
        { stepRunId: srunA.id, metricKey: 'ir_valid', value: 1, passed: true, details: { source: 'seed' } },
      ],
    });

    // Step B run
    const srunB = await (prisma as any).stepRun.create({
      data: {
        pipelineRunId: run.id,
        stepVersionId: stepBVer.id,
        nodeKey: stepBKey,
        status: 'completed',
        startedAt: now,
        completedAt: now,
        params: { framework: 'hubspot' },
      },
    });
    await (prisma as any).iRArtifact.create({
      data: {
        stepRunId: srunB.id,
        irJson: { moduleId: 'seed-module-1' },
        isValid: true,
        validationErrors: [],
      },
    });
    await (prisma as any).metricResult.createMany({
      data: [
        { stepRunId: srunB.id, metricKey: 'latency_ms', value: 450, passed: true, details: { source: 'seed' } },
        { stepRunId: srunB.id, metricKey: 'ir_valid', value: 1, passed: true, details: { source: 'seed' } },
      ],
    });

    console.log('[seed] Created run:', { runId: run.id });
  }

  console.log('[seed] Done:', { pipeline: pipelineDef.name, version: pver.version, steps: [stepAKey, stepBKey] });
}

main()
  .catch((e) => {
    console.error('[seed] Error', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
