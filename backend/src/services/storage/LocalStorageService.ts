import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import type { IStorageService, PutResult } from './IStorage';

export default class LocalStorageService implements IStorageService {
  constructor(private baseDir = (() => {
    const fromEnv = process.env.UPLOADS_DIR;
    const resolved = fromEnv
      ? (path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv))
      : path.resolve(process.cwd(), 'storage', 'uploads');
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    return resolved;
  })()) {
    // baseDir initialized via IIFE above
  }

  async put(buffer: Buffer, options: { mime?: string; extension?: string }): Promise<PutResult> {
    const ext = (options.extension || (options.mime ? options.mime.split('/')[1] : '') || 'bin').replace('jpeg', 'jpg');
    const key = `${randomUUID()}.${ext}`;
    const filePath = path.join(this.baseDir, key);
    await fs.promises.writeFile(filePath, buffer);
    return { key, url: filePath };
  }

  async getStream(key: string): Promise<Readable> {
    // Accept either a plain key (relative filename) or an absolute file path
    // Avoid duplicating baseDir when the key already contains it or is absolute
    const normalized = key.replace(/^file:\/\//, '');
    const primaryPath = path.isAbsolute(normalized)
      ? normalized
      : (normalized.startsWith(this.baseDir) ? normalized : path.join(this.baseDir, normalized));

    // If primary path doesn't exist and was absolute, try fallback to basename in baseDir
    let finalPath = primaryPath;
    const attempted: string[] = [primaryPath];
    try {
      await fs.promises.access(primaryPath);
    } catch {
      if (path.isAbsolute(normalized)) {
        const fallback = path.join(this.baseDir, path.basename(normalized));
        attempted.push(fallback);
        try {
          await fs.promises.access(fallback);
          finalPath = fallback;
        } catch {
          // will throw below with detailed message
        }
      }
    }

    // Final existence check
    try {
      await fs.promises.access(finalPath);
    } catch {
      throw new Error(`File not found. Attempted paths: ${attempted.join(' | ')}`);
    }

    return fs.createReadStream(finalPath);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    try {
      await fs.promises.unlink(filePath);
    } catch (e) {
      // ignore if missing
    }
  }
}
