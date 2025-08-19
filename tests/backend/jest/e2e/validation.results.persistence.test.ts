import designUploadRepo from '../../services/database/DesignUploadRepository';
import designSplitRepo from '../../services/database/DesignSplitRepository';
import validationResultRepo from '../../services/database/ValidationResultRepository';
import prisma from '../../services/database/prismaClient';

/**
 * Integration test for ValidationResult lifecycle against real DB.
 * Requires DATABASE_URL configured.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const maybeDescribe: jest.Describe = HAS_DB ? describe : describe.skip;

maybeDescribe('DB Integration: ValidationResult persistence', () => {
  const created: { uploadId?: string; splitId?: string; resultIds: string[] } = { resultIds: [] };

  it('creates validation results for a split and reads them back', async () => {
    const upload = await designUploadRepo.create({
      filename: `vr-upload-${Date.now()}.png`,
      mime: 'image/png',
      size: 1024,
      meta: { source: 'validation-results-it' },
    });
    created.uploadId = upload.id;

    const split = await designSplitRepo.create({
      designUploadId: upload.id,
      status: 'processing',
      metrics: { stage: 'validation' },
    });
    created.splitId = split.id;

    const r1 = await validationResultRepo.create({
      designSplitId: split.id,
      validator: 'HubSpotValidationService',
      status: 'passed',
      message: 'Structure validation passed',
      details: { type: 'structure' },
    });
    const r2 = await validationResultRepo.create({
      designSplitId: split.id,
      validator: 'HubSpotValidationService',
      status: 'warning',
      message: 'Performance could be improved',
      details: { type: 'performance', sizeKB: 120 },
    });
    created.resultIds.push(r1.id, r2.id);

    const bySplit = await validationResultRepo.listBySplit(split.id);
    expect(bySplit.length).toBeGreaterThanOrEqual(2);
    expect(bySplit[0].designSplitId).toBe(split.id);
  });

  afterAll(async () => {
    // best-effort cleanup
    for (const id of created.resultIds) {
      await prisma.validationResult.delete({ where: { id } }).catch(() => {});
    }
    if (created.splitId) {
      await prisma.designSplit.delete({ where: { id: created.splitId } }).catch(() => {});
    }
    if (created.uploadId) {
      await prisma.designUpload.delete({ where: { id: created.uploadId } }).catch(() => {});
    }
  });
});
