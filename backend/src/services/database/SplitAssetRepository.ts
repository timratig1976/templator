import prisma from './prismaClient';
import { Prisma } from '@prisma/client';

export type SplitAssetCreateInput = {
  splitId: string;
  kind: string; // image | html | css | json | other
  storageUrl?: string | null;
  meta?: unknown | null;
  order?: number | null;
  projectId?: string | null;
};

export class SplitAssetRepository {
  async create(input: SplitAssetCreateInput) {
    const data: any = {
      splitId: input.splitId,
      kind: input.kind,
      storageUrl: input.storageUrl ?? null,
      meta: (input.meta ?? undefined) as any,
      order: input.order ?? null,
    };
    if (typeof input.projectId !== 'undefined') {
      data.projectId = input.projectId;
    }
    return prisma.splitAsset.create({ data });
  }

  async listBySplit(splitId: string) {
    return prisma.splitAsset.findMany({ where: { splitId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
  }
}

export default new SplitAssetRepository();
