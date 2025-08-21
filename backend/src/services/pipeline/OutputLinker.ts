/**
 * OutputLinker
 * Writes StepOutputLink records to relate StepRun to existing domain outputs
 * (SplitAsset, ModuleTemplate, GeneratedArtifact). Stubbed for now.
 */

import { getFeatureFlags } from '../../config/featureFlags';
import prisma from '../database/prismaClient';

export interface OutputRef {
  targetType: 'split_assets' | 'module_templates' | 'generated_artifacts' | string;
  targetId: string;
}

export class OutputLinker {
  async link(stepRunId: string, outputs: OutputRef[]): Promise<number> {
    const flags = getFeatureFlags();
    if (!flags.PIPELINE_LOGGING_ENABLED) return 0;

    try {
      if (!outputs.length) return 0;
      await (prisma as any).stepOutputLink.createMany({
        data: outputs.map((o) => ({
          stepRunId,
          targetType: o.targetType,
          targetId: o.targetId,
          meta: {},
        })),
        skipDuplicates: true,
      });
      return outputs.length;
    } catch (_err) {
      // swallow in shadow mode
      return 0;
    }
  }
}
