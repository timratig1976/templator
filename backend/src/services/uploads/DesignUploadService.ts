import path from 'path';
import designUploadRepo from '../database/DesignUploadRepository';
import storage from '../storage';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

function deriveKeyFromUrl(url: string): string {
  try {
    // Works for local file paths and http(s) URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const u = new URL(url);
      const parts = u.pathname.split('/');
      return parts.pop() || u.pathname; // last segment
    }
    // Local path
    return path.basename(url);
  } catch {
    // fallback: last path segment by slash
    const parts = url.split('/');
    return parts.pop() || url;
  }
}

export class DesignUploadService {
  /**
   * Deletes the storage object (best-effort) and removes the DesignUpload DB record.
   * Returns true if a record existed and was deleted, false if no record was found.
   */
  async deleteById(id: string): Promise<boolean> {
    const upload = await designUploadRepo.findById(id);
    if (!upload) return false;

    // Best-effort storage deletion
    if (upload.storageUrl) {
      try {
        const key = deriveKeyFromUrl(upload.storageUrl);
        await storage.delete(key);
      } catch (e) {
        logger.warn('Failed to delete storage object for DesignUpload', {
          id,
          storageUrl: upload.storageUrl,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    await designUploadRepo.delete(id);
    return true;
  }
}

export default new DesignUploadService();
