import prisma from './prismaClient';

export interface CreateReviewFeedbackInput {
  designSplitId?: string | null;
  artifactId?: string | null;
  moduleId?: string | null;
  reviewer: string;
  status: 'pending' | 'submitted' | 'approved' | 'revisions_requested';
  ratings?: any | null; // JSON
  comments: string;
  findings?: any | null; // JSON
}

export interface ReviewFeedbackRecord {
  id: string;
  designSplitId?: string | null;
  artifactId?: string | null;
  moduleId?: string | null;
  reviewer: string;
  status: string;
  ratings: any | null;
  comments: string;
  findings: any | null;
  createdAt: Date;
  updatedAt: Date;
}

export default class ReviewFeedbackRepository {
  async create(input: CreateReviewFeedbackInput): Promise<ReviewFeedbackRecord> {
    const record = await prisma.reviewFeedback.create({
      data: {
        designSplitId: input.designSplitId ?? null,
        artifactId: input.artifactId ?? null,
        moduleId: input.moduleId ?? null,
        reviewer: input.reviewer,
        status: input.status,
        ratings: input.ratings ?? undefined,
        comments: input.comments,
        findings: input.findings ?? undefined,
      },
    });
    return record as unknown as ReviewFeedbackRecord;
  }

  async listBySplit(designSplitId: string): Promise<ReviewFeedbackRecord[]> {
    return (await prisma.reviewFeedback.findMany({ where: { designSplitId } })) as unknown as ReviewFeedbackRecord[];
  }

  async listByArtifact(artifactId: string): Promise<ReviewFeedbackRecord[]> {
    return (await prisma.reviewFeedback.findMany({ where: { artifactId } })) as unknown as ReviewFeedbackRecord[];
  }

  async listByModule(moduleId: string): Promise<ReviewFeedbackRecord[]> {
    return (await prisma.reviewFeedback.findMany({ where: { moduleId } })) as unknown as ReviewFeedbackRecord[];
  }
}
