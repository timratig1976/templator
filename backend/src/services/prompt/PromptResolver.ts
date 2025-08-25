import prisma from '../database/prismaClient';

export type ResolvedPrompt = {
  source: 'production' | 'default' | 'inline' | 'none';
  assetId?: string;
  promptContent?: any;
  irSchema?: any;
};

export class PromptResolver {
  /**
   * Resolve the effective prompt for a StepVersion by precedence:
   * 1) productionPromptId (PromptAsset)
   * 2) defaultPromptId (PromptAsset)
   * 3) inline StepVersion.prompt (legacy)
   */
  async resolveForStepVersion(stepVersionId: string): Promise<ResolvedPrompt> {
    const sv = await (prisma as any).stepVersion.findUnique({
      where: { id: stepVersionId },
      select: {
        productionPromptId: true,
        defaultPromptId: true,
        prompt: true,
      },
    });
    if (!sv) return { source: 'none' };

    // Production asset
    if (sv.productionPromptId) {
      const asset = await (prisma as any).promptAsset.findUnique({
        where: { id: sv.productionPromptId },
        select: { id: true, promptContent: true, irSchema: true },
      });
      if (asset) {
        return {
          source: 'production',
          assetId: asset.id,
          promptContent: asset.promptContent,
          irSchema: asset.irSchema ?? undefined,
        };
      }
    }

    // Default asset
    if (sv.defaultPromptId) {
      const asset = await (prisma as any).promptAsset.findUnique({
        where: { id: sv.defaultPromptId },
        select: { id: true, promptContent: true, irSchema: true },
      });
      if (asset) {
        return {
          source: 'default',
          assetId: asset.id,
          promptContent: asset.promptContent,
          irSchema: asset.irSchema ?? undefined,
        };
      }
    }

    // Inline (legacy)
    if (sv.prompt) {
      return { source: 'inline', promptContent: sv.prompt };
    }

    return { source: 'none' };
  }
}
