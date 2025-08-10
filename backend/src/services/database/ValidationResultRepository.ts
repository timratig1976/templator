import prisma from './prismaClient';
import { Prisma } from '@prisma/client';

export type ValidationResultCreateInput = {
  artifactId?: string | null;
  designSplitId?: string | null;
  validator: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  details?: unknown | null;
};

export class ValidationResultRepository {
  async create(input: ValidationResultCreateInput) {
    const data: any = {
      artifactId: input.artifactId ?? null,
      designSplitId: input.designSplitId ?? null,
      validator: input.validator,
      status: input.status,
      message: input.message,
    };
    if (input.details !== undefined) {
      data.details = input.details as any;
    }
    return prisma.validationResult.create({ data });
  }

  async listBySplit(designSplitId: string) {
    return prisma.validationResult.findMany({ where: { designSplitId }, orderBy: { createdAt: 'desc' } });
  }

  async listByArtifact(artifactId: string) {
    return prisma.validationResult.findMany({ where: { artifactId }, orderBy: { createdAt: 'desc' } });
  }
}

export default new ValidationResultRepository();
