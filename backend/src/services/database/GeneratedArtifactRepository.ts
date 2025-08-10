import prisma from './prismaClient';
import { Prisma } from '@prisma/client';

export type GeneratedArtifactCreateInput = {
  designSplitId?: string | null;
  moduleId?: string | null;
  type: string; // 'html' | 'css' | 'bundle' | 'preview'
  contentUrl?: string | null;
  content?: string | null;
  meta?: unknown | null;
  status: string; // 'pending' | 'completed' | 'failed'
};

export class GeneratedArtifactRepository {
  async create(input: GeneratedArtifactCreateInput) {
    const data: any = {
      designSplitId: input.designSplitId ?? null,
      moduleId: input.moduleId ?? null,
      type: input.type,
      meta: (input.meta ?? undefined) as any,
      status: input.status,
    };
    if (input.contentUrl !== undefined && input.contentUrl !== null) {
      data.contentUrl = input.contentUrl;
    }
    if (input.content !== undefined && input.content !== null) {
      data.content = input.content;
    }
    return prisma.generatedArtifact.create({ data });
  }

  async updateStatus(id: string, status: string, fields?: { contentUrl?: string | null; content?: string | null; meta?: unknown | null }) {
    const data: any = { status };
    if (fields) {
      if (fields.contentUrl !== undefined) data.contentUrl = fields.contentUrl;
      if (fields.content !== undefined) data.content = fields.content;
      if (fields.meta !== undefined) data.meta = fields.meta as any;
    }
    await prisma.generatedArtifact.update({ where: { id }, data });
  }

  async findById(id: string) {
    return prisma.generatedArtifact.findUnique({ where: { id } });
  }

  async listBySplit(designSplitId: string) {
    return prisma.generatedArtifact.findMany({ where: { designSplitId }, orderBy: { createdAt: 'desc' } });
  }

  async listByModule(moduleId: string) {
    return prisma.generatedArtifact.findMany({ where: { moduleId }, orderBy: { createdAt: 'desc' } });
  }
}

export default new GeneratedArtifactRepository();
