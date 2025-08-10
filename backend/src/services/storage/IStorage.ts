import { Readable } from 'stream';

export type PutResult = {
  key: string;
  url: string; // opaque location reference; for local storage this is a file path
};

export interface IStorageService {
  put(buffer: Buffer, options: { mime?: string; extension?: string }): Promise<PutResult>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}

export default IStorageService;
