import prisma from '../../services/database/prismaClient';
import designUploadRepo from '../../services/database/DesignUploadRepository';
import designSplitRepo from '../../services/database/DesignSplitRepository';
import generatedArtifactRepo from '../../services/database/GeneratedArtifactRepository';

/**
 * Integration test for GeneratedArtifact lifecycle against real DB.
 * Requires DATABASE_URL configured.
 */

describe('DB Integration: GeneratedArtifact persistence', () => {
  const created: { uploadId?: string; splitId?: string; artifactId?: string } = {};

  it('creates artifact for a split and reads it back', async () => {
    // Ensure a split exists
    const upload = await designUploadRepo.create({
      filename: `ga-upload-${Date.now()}.png`,
      mime: 'image/png',
      size: 2048,
      meta: { source: 'generated-artifact-it' },
    });
    created.uploadId = upload.id;

    const split = await designSplitRepo.create({
      designUploadId: upload.id,
      status: 'processing',
      metrics: { stage: 'assembly' },
    });
    created.splitId = split.id;

    const artifact = await generatedArtifactRepo.create({
      designSplitId: split.id,
      type: 'html',
      status: 'completed',
      content: '<div class="module">Hello</div>',
      meta: { bytes: 32, generator: 'ComponentAssemblyEngine' },
    });
    created.artifactId = artifact.id;

    expect(artifact.id).toBeTruthy();
    expect(artifact.type).toBe('html');
    expect(artifact.status).toBe('completed');

    const bySplit = await generatedArtifactRepo.listBySplit(split.id);
    expect(bySplit.length).toBeGreaterThan(0);
    expect(bySplit[0].designSplitId).toBe(split.id);
  });

  afterAll(async () => {
    // best-effort cleanup
    if (created.artifactId) {
      await generatedArtifactRepo
        .updateStatus(created.artifactId, 'deleted')
        .catch(() => {});
    }
    if (created.splitId) {
      await prisma.designSplit.delete({ where: { id: created.splitId } }).catch(() => {});
    }
    if (created.uploadId) {
      await prisma.designUpload.delete({ where: { id: created.uploadId } }).catch(() => {});
    }
  });
});
