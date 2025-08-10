import LocalStorageService from './LocalStorageService';
import type { IStorageService } from './IStorage';

// In future, choose based on env (e.g., S3/MinIO). For now, local FS.
let storage: IStorageService = new LocalStorageService();

export default storage;
