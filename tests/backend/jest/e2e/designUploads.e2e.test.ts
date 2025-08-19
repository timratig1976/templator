import request from 'supertest';
import { createApp } from '../../app';
import designUploadRepo from '../../services/database/DesignUploadRepository';

describe('E2E: Design Uploads deletion', () => {
  const app = createApp();

  it('deletes an existing design upload and returns 404 on subsequent read', async () => {
    // Seed a design upload record (storage deletion is best-effort)
    const upload = await designUploadRepo.create({
      filename: 'sample.png',
      mime: 'image/png',
      size: 1234,
      storageUrl: '/tmp/storage/uploads/sample.png',
      checksum: 'deadbeef',
      meta: { source: 'test' },
    });

    // Ensure it exists
    const get1 = await request(app).get(`/api/design-uploads/${upload.id}`);
    expect(get1.status).toBe(200);
    expect(get1.body.success).toBe(true);

    // Delete it
    const del = await request(app).delete(`/api/design-uploads/${upload.id}`);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    // Now it should be gone
    const get2 = await request(app).get(`/api/design-uploads/${upload.id}`);
    expect(get2.status).toBe(404);
  });

  it('returns 404 when deleting a non-existent upload', async () => {
    const del = await request(app).delete(`/api/design-uploads/00000000-0000-0000-0000-000000000000`);
    expect(del.status).toBe(404);
  });
});
