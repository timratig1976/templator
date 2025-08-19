import designSplitRepo from '../../services/database/DesignSplitRepository';
import TestRunRepository from '../../services/database/TestRunRepository';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HAS_DB = !!process.env.DATABASE_URL;
const maybeDescribe: jest.Describe = HAS_DB ? describe : describe.skip;

maybeDescribe('DB Integration: TestRun & TestResult persistence', () => {
  const repo = new TestRunRepository();
  let designSplitId: string;

  beforeAll(async () => {
    const upload = await (await import('../../services/database/DesignUploadRepository')).default.create({
      filename: 'test-module.html',
      mime: 'text/html',
      size: 2048,
      storageUrl: null,
    });

    const split = await designSplitRepo.create({
      designUploadId: upload.id,
      status: 'completed',
      metrics: { parts: 2 },
    });

    designSplitId = split.id;
  });

  it('creates a test run, appends results, completes it, and reads back', async () => {
    const run = await repo.createRun({
      designSplitId,
      type: 'integration',
      status: 'running',
      summary: { startedBy: 'tester' },
    });

    expect(run.id).toBeTruthy();

    await repo.addResult(run.id, {
      name: 'HTML renders without errors',
      status: 'passed',
      durationMs: 120,
      details: { env: 'node' },
    });

    await repo.addResult(run.id, {
      name: 'Accessibility audit (basic)',
      status: 'failed',
      durationMs: 340,
      details: { a11y: [{ rule: 'img-alt', count: 2 }] },
    });

    await repo.completeRun(run.id, 'partial', { total: 2, passed: 1, failed: 1 });

    await sleep(50);

    const found = await repo.getRun(run.id);
    expect(found).toBeTruthy();
    expect(found!.status).toBe('partial');
    expect(found!.results.length).toBeGreaterThanOrEqual(2);

    const runsBySplit = await repo.listRunsBySplit(designSplitId);
    expect(runsBySplit.length).toBeGreaterThanOrEqual(1);
  });
});
