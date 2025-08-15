import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import type { IStorageService, PutResult } from './IStorage';

export default class LocalStorageService implements IStorageService {
  constructor(private baseDir = path.resolve(process.cwd(), 'storage', 'uploads')) {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
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
    const filePath = path.isAbsolute(normalized)
      ? normalized
      : (normalized.startsWith(this.baseDir) ? normalized : path.join(this.baseDir, normalized));
    
    // Check if file exists before creating read stream
    try {
      await fs.promises.access(filePath);
    } catch (error) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    return fs.createReadStream(filePath);
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
