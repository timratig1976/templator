import prisma from './prismaClient';
import { Prisma } from '@prisma/client';

export type DesignSplitCreateInput = {
  designUploadId: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | string;
  metrics?: unknown | null;
  projectId?: string | null;
};

export class DesignSplitRepository {
  async create(input: DesignSplitCreateInput) {
    const data: any = {
      designUploadId: input.designUploadId,
      status: input.status ?? 'processing',
      metrics: (input.metrics ?? undefined) as any,
    };
    if (typeof input.projectId !== 'undefined') {
      data.projectId = input.projectId;
    }
    return prisma.designSplit.create({ data });
  }

  async updateStatus(id: string, status: string) {
    return prisma.designSplit.update({
      where: { id },
      data: { status },
    });
  }

  async addMetrics(id: string, metrics: unknown) {
    return prisma.designSplit.update({
      where: { id },
      data: { metrics: metrics as any },
    });
  }

  async setProject(id: string, projectId: string) {
    const data: any = { projectId };
    return prisma.designSplit.update({
      where: { id },
      data,
    });
  }

  async findById(id: string) {
    return prisma.designSplit.findUnique({ where: { id }, include: { assets: true, designUpload: true } });
  }

  async listByUpload(designUploadId: string) {
    return prisma.designSplit.findMany({ where: { designUploadId }, orderBy: { createdAt: 'desc' } });
  }

  async listRecent(limit: number = 20) {
    return prisma.designSplit.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }

  async listAssets(splitId: string) {
    return prisma.splitAsset.findMany({ where: { splitId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
  }
}

export default new DesignSplitRepository();
