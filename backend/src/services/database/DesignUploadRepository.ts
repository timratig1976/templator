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

  async deleteWithCascade(id: string) {
    // Use transaction to ensure all related records are deleted in the correct order
    return prisma.$transaction(async (tx) => {
      // First, find all related design splits
      const splits = await tx.designSplit.findMany({
        where: { designUploadId: id },
        select: { id: true }
      });

      const splitIds = splits.map(s => s.id);

      if (splitIds.length > 0) {
        // Delete split-specific assets and generated content
        for (const splitId of splitIds) {
          try {
            // Delete split_assets records (cropped images, etc.)
            await tx.$executeRaw`DELETE FROM split_assets WHERE "splitId" = ${splitId}`;
          } catch (e) {
            console.warn(`Could not delete split_assets for split ${splitId}:`, e);
          }
        }

        // Delete generated artifacts that are not marked as golden set
        await tx.generatedArtifact.deleteMany({ 
          where: { 
            designSplitId: { in: splitIds },
            // Only delete if not marked as golden set (assuming meta field tracks this)
            NOT: {
              meta: {
                path: ['isGoldenSet'],
                equals: true
              }
            }
          } 
        });

        // PRESERVE AI Maintenance data - DO NOT DELETE:
        // - testRun (AI maintenance test data)
        // - reviewFeedback (expert review data for AI improvement)
        // - validationResult (validation data for AI learning)
        
        // Update these records to remove the split reference instead of deleting
        await tx.testRun.updateMany({ 
          where: { designSplitId: { in: splitIds } },
          data: { designSplitId: null }
        });
        
        await tx.reviewFeedback.updateMany({ 
          where: { designSplitId: { in: splitIds } },
          data: { designSplitId: null }
        });
        
        await tx.validationResult.updateMany({ 
          where: { designSplitId: { in: splitIds } },
          data: { designSplitId: null }
        });

        // Delete design splits (this will cascade to records with onDelete: Cascade)
        await tx.designSplit.deleteMany({
          where: { designUploadId: id }
        });
      }

      // Finally, delete the design upload
      return tx.designUpload.delete({ where: { id } });
    });
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
