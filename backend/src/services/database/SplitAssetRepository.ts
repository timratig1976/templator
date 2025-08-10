import prisma from './prismaClient';
import { Prisma } from '@prisma/client';

export type SplitAssetCreateInput = {
  splitId: string;
  kind: string; // image | html | css | json | other
  storageUrl?: string | null;
  meta?: Prisma.InputJsonValue | null;
  order?: number | null;
};

export class SplitAssetRepository {
  async create(input: SplitAssetCreateInput) {
    return prisma.splitAsset.create({
      data: {
        splitId: input.splitId,
        kind: input.kind,
        storageUrl: input.storageUrl ?? null,
        meta: input.meta ?? undefined,
        order: input.order ?? null,
      },
    });
  }

  async listBySplit(splitId: string) {
    return prisma.splitAsset.findMany({ where: { splitId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
  }
}

export default new SplitAssetRepository();
