import prisma from '../../../services/database/prismaClient';
import designUploadRepo from '../../../services/database/DesignUploadRepository';
import designSplitRepo from '../../../services/database/DesignSplitRepository';
import splitAssetRepo from '../../../services/database/SplitAssetRepository';

// Basic integration test to verify Prisma-backed repositories work against the DB
// Requires DATABASE_URL to be set (Neon Postgres). This test creates and cleans up its own data.

describe('DB Integration: DesignUpload → DesignSplit → SplitAsset', () => {
  const createdIds: { uploadId?: string; splitId?: string } = {};

  it('should create upload, split, and assets; then read them back', async () => {
    // 1) Create DesignUpload
    const upload = await designUploadRepo.create({
      filename: `it-upload-${Date.now()}.png`,
      mime: 'image/png',
      size: 12345,
      meta: { source: 'integration-test' },
    });
    createdIds.uploadId = upload.id;

    expect(upload.id).toBeTruthy();
    expect(upload.mime).toBe('image/png');

    // 2) Create DesignSplit
    const split = await designSplitRepo.create({
      designUploadId: upload.id,
      status: 'processing',
      metrics: { initiatedBy: 'jest' },
    });
    createdIds.splitId = split.id;

    expect(split.id).toBeTruthy();
    expect(split.designUploadId).toBe(upload.id);

    // 3) Add SplitAssets
    await splitAssetRepo.create({
      splitId: split.id,
      kind: 'json',
      meta: { name: 'Header', type: 'header', bounds: { x: 0, y: 0, w: 100, h: 80 } },
      order: 0,
    });
    await splitAssetRepo.create({
      splitId: split.id,
      kind: 'json',
      meta: { name: 'Footer', type: 'footer', bounds: { x: 0, y: 420, w: 100, h: 80 } },
      order: 1,
    });

    // 4) Update status and metrics
    await designSplitRepo.addMetrics(split.id, { suggestionCount: 2 });
    await designSplitRepo.updateStatus(split.id, 'completed');

    // 5) Read back and assert
    const fetchedSplit = await designSplitRepo.findById(split.id);
    expect(fetchedSplit).toBeTruthy();
    expect(fetchedSplit?.status).toBe('completed');
    expect(fetchedSplit?.assets?.length).toBeGreaterThanOrEqual(2);
    expect(fetchedSplit?.designUpload?.id).toBe(upload.id);

    const assets = await splitAssetRepo.listBySplit(split.id);
    expect(assets.length).toBe(2);
    expect((assets[0].meta as any).name).toBe('Header');
  });

  afterAll(async () => {
    // Best-effort cleanup
    if (createdIds.splitId) {
      await prisma.splitAsset.deleteMany({ where: { splitId: createdIds.splitId } }).catch(() => {});
      await prisma.designSplit.delete({ where: { id: createdIds.splitId } }).catch(() => {});
    }
    if (createdIds.uploadId) {
      await prisma.designUpload.delete({ where: { id: createdIds.uploadId } }).catch(() => {});
    }
  });
});
