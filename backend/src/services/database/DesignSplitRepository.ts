import prisma from './prismaClient';
import { Prisma } from '@prisma/client';

export type DesignSplitCreateInput = {
  designUploadId: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | string;
  metrics?: Prisma.InputJsonValue | null;
};

export class DesignSplitRepository {
  async create(input: DesignSplitCreateInput) {
    return prisma.designSplit.create({
      data: {
        designUploadId: input.designUploadId,
        status: input.status ?? 'processing',
        metrics: input.metrics ?? undefined,
      },
    });
  }

  async updateStatus(id: string, status: string) {
    return prisma.designSplit.update({
      where: { id },
      data: { status },
    });
  }

  async addMetrics(id: string, metrics: Prisma.InputJsonValue) {
    return prisma.designSplit.update({
      where: { id },
      data: { metrics },
    });
  }

  async findById(id: string) {
    return prisma.designSplit.findUnique({ where: { id }, include: { assets: true, designUpload: true } });
  }

  async listByUpload(designUploadId: string) {
    return prisma.designSplit.findMany({ where: { designUploadId }, orderBy: { createdAt: 'desc' } });
  }
}

export default new DesignSplitRepository();
