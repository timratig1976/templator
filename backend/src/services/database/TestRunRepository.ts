import prisma from './prismaClient';

export type CreateTestRunInput = {
  designSplitId?: string | null;
  artifactId?: string | null;
  moduleId?: string | null;
  type: string; // e.g., 'unit' | 'integration' | ...
  status?: string; // defaults to 'queued'
  summary?: any | null; // JSON
};

export type AddTestResultInput = {
  name: string;
  status: string; // 'passed' | 'failed' | 'skipped' | 'flaky'
  durationMs: number;
  details?: any | null; // JSON
};

export default class TestRunRepository {
  async createRun(input: CreateTestRunInput) {
    return prisma.testRun.create({
      data: {
        designSplitId: input.designSplitId ?? null,
        artifactId: input.artifactId ?? null,
        moduleId: input.moduleId ?? null,
        type: input.type,
        status: input.status ?? 'queued',
        summary: input.summary ?? undefined,
      },
    });
  }

  async addResult(testRunId: string, input: AddTestResultInput) {
    return prisma.testResult.create({
      data: {
        testRunId,
        name: input.name,
        status: input.status,
        durationMs: input.durationMs,
        details: input.details ?? undefined,
      },
    });
  }

  async completeRun(testRunId: string, status: string, summary?: any | null) {
    return prisma.testRun.update({
      where: { id: testRunId },
      data: {
        status,
        completedAt: new Date(),
        summary: summary ?? undefined,
      },
    });
  }

  async getRun(testRunId: string) {
    return prisma.testRun.findUnique({
      where: { id: testRunId },
      include: { results: true },
    });
  }

  async listRunsBySplit(designSplitId: string) {
    return prisma.testRun.findMany({ where: { designSplitId }, orderBy: { startedAt: 'desc' } });
  }

  async listRunsByModule(moduleId: string, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 100);
    return prisma.testRun.findMany({
      where: { moduleId },
      orderBy: { startedAt: 'desc' },
      take,
      include: { results: true },
    });
  }
}
