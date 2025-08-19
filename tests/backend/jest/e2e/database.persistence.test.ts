import prisma from '@backend/services/database/prismaClient';
import designUploadRepo from '@backend/services/database/DesignUploadRepository';
import designSplitRepo from '@backend/services/database/DesignSplitRepository';
import splitAssetRepo from '@backend/services/database/SplitAssetRepository';

// Integration test verifying Prisma-backed repositories against the real DB.
// Requires DATABASE_URL configured.

const HAS_DB = !!process.env.DATABASE_URL;

const maybeDescribe: jest.Describe = HAS_DB ? describe : describe.skip;

maybeDescribe('DB Integration: DesignUpload → DesignSplit → SplitAsset', () => {
  const createdIds: { uploadId?: string; splitId?: string } = {};

  it('creates upload, split, and assets; then reads them back', async () => {
    const upload = await designUploadRepo.create({
      filename: `it-upload-${Date.now()}.png`,
      mime: 'image/png',
      size: 12345,
      meta: { source: 'integration-test' },
    });
    createdIds.uploadId = upload.id;

    expect(upload.id).toBeTruthy();
    expect(upload.mime).toBe('image/png');

    const split = await designSplitRepo.create({
      designUploadId: upload.id,
      status: 'processing',
      metrics: { initiatedBy: 'jest' },
    });
    createdIds.splitId = split.id;

    expect(split.id).toBeTruthy();
    expect(split.designUploadId).toBe(upload.id);

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

    await designSplitRepo.addMetrics(split.id, { suggestionCount: 2 });
    await designSplitRepo.updateStatus(split.id, 'completed');

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
    if (createdIds.splitId) {
      await prisma.splitAsset.deleteMany({ where: { splitId: createdIds.splitId } }).catch(() => {});
      await prisma.designSplit.delete({ where: { id: createdIds.splitId } }).catch(() => {});
    }
    if (createdIds.uploadId) {
      await prisma.designUpload.delete({ where: { id: createdIds.uploadId } }).catch(() => {});
    }
  });
});
