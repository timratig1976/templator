import request from 'supertest';
import { createApp } from '@backend/app';
import designUploadRepo from '@backend/services/database/DesignUploadRepository';

const HAS_DB = !!process.env.DATABASE_URL;
const maybeDescribe = HAS_DB ? describe : describe.skip;

maybeDescribe('E2E: Design Uploads list endpoint', () => {
  const app = createApp();
  const createdIds: string[] = [];

  beforeAll(async () => {
    const a = await designUploadRepo.create({ filename: 'a.png', mime: 'image/png', size: 10, storageUrl: '/tmp/a.png', checksum: 'a', meta: { user: 'u1' }, userId: 'u1' });
    const b = await designUploadRepo.create({ filename: 'b.png', mime: 'image/png', size: 20, storageUrl: '/tmp/b.png', checksum: 'b', meta: { user: 'u2' }, userId: 'u2' });
    const c = await designUploadRepo.create({ filename: 'c.png', mime: 'image/png', size: 30, storageUrl: '/tmp/c.png', checksum: 'c', meta: { user: 'u1' }, userId: 'u1' });
    createdIds.push(a.id, b.id, c.id);
  });

  it('lists uploads with pagination', async () => {
    const res = await request(app).get('/api/design-uploads?limit=2&offset=0');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.limit).toBe(2);
  });

  it('filters by userId', async () => {
    const res = await request(app).get('/api/design-uploads?userId=u1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    for (const item of res.body.data) {
      expect(item.userId).toBe('u1');
    }
  });
});
