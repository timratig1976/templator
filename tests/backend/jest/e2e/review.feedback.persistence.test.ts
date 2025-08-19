import designSplitRepo from '../../services/database/DesignSplitRepository';
import ReviewFeedbackRepository from '../../services/database/ReviewFeedbackRepository';

// Narrow sleep util to allow Neon to settle writes in CI if needed
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HAS_DB = !!process.env.DATABASE_URL;
const maybeDescribe: jest.Describe = HAS_DB ? describe : describe.skip;

maybeDescribe('DB Integration: ReviewFeedback persistence', () => {
  const reviewRepo = new ReviewFeedbackRepository();
  let designSplitId: string;

  beforeAll(async () => {
    const upload = await (await import('../../services/database/DesignUploadRepository')).default.create({
      filename: 'test.png',
      mime: 'image/png',
      size: 1234,
      storageUrl: null,
    });

    const split = await designSplitRepo.create({
      designUploadId: upload.id,
      status: 'completed',
      metrics: { parts: 1 },
    });

    designSplitId = split.id;
  });

  it('creates review feedback for a split and reads it back', async () => {
    const created1 = await reviewRepo.create({
      designSplitId,
      artifactId: null,
      moduleId: null,
      reviewer: 'reviewer_001',
      status: 'submitted',
      ratings: { overall_score: 92 },
      comments: 'Looks solid. Minor accessibility tweaks.',
      findings: { a11y: [{ issue: 'missing alt', severity: 'low' }] },
    });

    const created2 = await reviewRepo.create({
      designSplitId,
      artifactId: null,
      moduleId: null,
      reviewer: 'reviewer_002',
      status: 'submitted',
      ratings: { overall_score: 88 },
      comments: 'Performance could improve on mobile.',
      findings: { perf: [{ issue: 'large images', severity: 'medium' }] },
    });

    expect(created1.id).toBeTruthy();
    expect(created2.id).toBeTruthy();

    // optional settle
    await sleep(50);

    const bySplit = await reviewRepo.listBySplit(designSplitId);
    const comments = bySplit.map((r) => r.comments).join(' ');

    expect(bySplit.length).toBeGreaterThanOrEqual(2);
    expect(comments).toContain('accessibility');
    expect(comments).toContain('Performance');
  });
});
