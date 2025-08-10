import prisma from './prismaClient';
import { Prisma } from '@prisma/client';

export type DesignUploadCreateInput = {
  userId?: string | null;
  filename: string;
  mime: string;
  size: number;
  checksum?: string | null;
  storageUrl?: string | null;
  meta?: unknown | null;
};

export class DesignUploadRepository {
  async create(input: DesignUploadCreateInput) {
    const data: any = {
      userId: input.userId ?? null,
      filename: input.filename,
      mime: input.mime,
      size: input.size,
      checksum: input.checksum ?? null,
      meta: (input.meta ?? undefined) as any,
    };
    if (input.storageUrl !== undefined && input.storageUrl !== null) {
      data.storageUrl = input.storageUrl;
    }
    return prisma.designUpload.create({ data });
  }

  async findById(id: string) {
    return prisma.designUpload.findUnique({ where: { id } });
  }

  async listByUser(userId: string) {
    return prisma.designUpload.findMany({ where: { userId } });
  }

  async delete(id: string) {
    return prisma.designUpload.delete({ where: { id } });
  }

  async listAll(limit = 50, offset = 0) {
    return prisma.designUpload.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async listByUserPaginated(userId: string, limit = 50, offset = 0) {
    return prisma.designUpload.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async countAll() {
    return prisma.designUpload.count();
  }

  async countByUser(userId: string) {
    return prisma.designUpload.count({ where: { userId } });
  }
}

export default new DesignUploadRepository();
