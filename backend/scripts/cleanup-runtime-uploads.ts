#!/usr/bin/env ts-node

/**
 * Cleanup Runtime Uploads Script
 * - Deletes files under backend/storage/uploads/ (configurable via UPLOADS_DIR)
 * - Deletes corresponding DesignUpload records via DesignUploadService.deleteById()
 * - Safe by default with --dry-run support
 *
 * Flags:
 *   --dry-run    Preview actions without deleting
 *   --no-fs      Skip filesystem deletion
 *   --no-db      Skip database cleanup
 *
 * Env:
 *   REPORTS_DIR  Defaults to ./reports
 *   UPLOADS_DIR  Defaults to backend/storage/uploads
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Local imports from backend services
import designUploadRepo from '../src/services/database/DesignUploadRepository';
import designUploadService from '../src/services/uploads/DesignUploadService';

// Config
const PROJECT_ROOT = path.resolve(__dirname, '..'); // backend/

// Load environment from backend/.env (preferred) then project root .env as fallback
try {
  const backendEnv = path.resolve(PROJECT_ROOT, '.env');
  if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv, override: false });
  const rootEnv = path.resolve(PROJECT_ROOT, '..', '.env');
  if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: false });
} catch {
  // ignore env load errors
}
const DEFAULT_UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(PROJECT_ROOT, 'storage', 'uploads');
const REPORTS_DIR = process.env.REPORTS_DIR ? path.resolve(process.env.REPORTS_DIR) : path.resolve(PROJECT_ROOT, '..', 'reports');
const LOG_DIR = path.join(REPORTS_DIR, 'logs');

// CLI flags
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const SKIP_FS = args.has('--no-fs');
const SKIP_DB = args.has('--no-db');

function logSetup() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(msg: string) {
  const line = `[cleanup-uploads] ${new Date().toISOString()} ${msg}`;
  // eslint-disable-next-line no-console
  console.log(line);
  try {
    fs.appendFileSync(path.join(LOG_DIR, `cleanup-uploads-${new Date().toISOString().slice(0,10)}.log`), line + '\n');
  } catch {
    // ignore log file errors
  }
}

async function deleteUploadFiles(dir: string): Promise<{ total: number; deleted: number; errors: number; }>{
  const summary = { total: 0, deleted: 0, errors: 0 };
  if (SKIP_FS) {
    log('Skipping filesystem cleanup (--no-fs)');
    return summary;
  }
  if (!fs.existsSync(dir)) {
    log(`Uploads directory does not exist, skipping FS cleanup: ${dir}`);
    return summary;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries.filter(e => e.isFile()).map(e => e.name);
  summary.total = files.length;

  for (const name of files) {
    const filePath = path.join(dir, name);
    if (DRY_RUN) {
      log(`DRY-RUN would delete file: ${filePath}`);
      continue;
    }
    try {
      fs.unlinkSync(filePath);
      summary.deleted += 1;
      log(`Deleted file: ${filePath}`);
    } catch (e: any) {
      summary.errors += 1;
      log(`ERROR deleting file ${filePath}: ${e?.message || String(e)}`);
    }
  }

  return summary;
}

async function deleteDesignUploads(): Promise<{ total: number; deleted: number; errors: number; }>{
  const summary = { total: 0, deleted: 0, errors: 0 };
  if (SKIP_DB) {
    log('Skipping database cleanup (--no-db)');
    return summary;
  }
  const uploads = await designUploadRepo.listAll(10000, 0);
  summary.total = uploads.length;

  for (const u of uploads as any[]) {
    if (DRY_RUN) {
      log(`DRY-RUN would delete DesignUpload: id=${u.id} filename=${u.filename}`);
      continue;
    }
    try {
      await designUploadService.deleteById(u.id);
      summary.deleted += 1;
      log(`Deleted DesignUpload: id=${u.id}`);
    } catch (e: any) {
      summary.errors += 1;
      log(`ERROR deleting DesignUpload id=${u.id}: ${e?.message || String(e)}`);
    }
  }
  return summary;
}

async function main() {
  logSetup();
  log(`Starting cleanup. DRY_RUN=${DRY_RUN} SKIP_FS=${SKIP_FS} SKIP_DB=${SKIP_DB}`);
  log(`REPORTS_DIR=${REPORTS_DIR}`);
  log(`UPLOADS_DIR=${DEFAULT_UPLOADS_DIR}`);

  const fsSummary = await deleteUploadFiles(DEFAULT_UPLOADS_DIR);
  const dbSummary = await deleteDesignUploads();

  log(`FS files: total=${fsSummary.total} deleted=${fsSummary.deleted} errors=${fsSummary.errors}`);
  log(`DB uploads: total=${dbSummary.total} deleted=${dbSummary.deleted} errors=${dbSummary.errors}`);

  if (DRY_RUN) {
    log('Completed DRY-RUN (no deletions performed).');
  } else {
    log('Cleanup completed.');
  }
}

main().catch((e) => {
  log(`FATAL: ${e instanceof Error ? e.stack || e.message : String(e)}`);
  process.exit(1);
});
