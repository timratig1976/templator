/**
 * Dead Code Scanner (Scaffold)
 * Non-destructive analyzer that aggregates signals for unused files/exports/deps.
 * TODO: Integrate real tools: ts-prune, unimported, depcheck, ESLint, coverage, route-hit telemetry.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export interface DeadCodeItem {
  type: 'file' | 'export' | 'dependency';
  path?: string;
  symbol?: string;
  packageName?: string;
  signals: string[]; // e.g., ['ts-prune', 'unimported']
  severity: 'low' | 'medium' | 'high';
  lastSeen?: string; // ISO
  notes?: string;
}

export interface DeadCodeReport {
  generatedAt: string;
  summary: {
    deadFiles: number;
    unusedExports: number;
    unusedDependencies: number;
    signals: string[];
  };
  items: DeadCodeItem[];
}

export default class DeadCodeScanner {
  private reportPath: string;
  // Ignore noisy paths and dev-only packages to reduce false positives
  private ignoreGlobs: string[] = [
    '**/__tests__/**',
    '**/tests/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/.runtime/**',
    '**/coverage/**',
    '**/dist/**',
    '**/build/**',
    '**/*.d.ts',
    '**/scripts/**',
  ];
  private ignorePackages: string[] = [
    'typescript',
    'ts-node',
    'ts-node-dev',
    'tsx',
    'jest',
    'vitest',
    'ts-jest',
    'eslint',
    'eslint-*',
    '@eslint/*',
    'prettier',
    'husky',
    'lint-staged',
  ];

  constructor(reportDir?: string) {
    const baseReports = process.env.REPORTS_DIR || 'reports';
    const basePath = path.isAbsolute(baseReports)
      ? baseReports
      : path.resolve(process.cwd(), '..', baseReports);
    const finalDir = reportDir || path.join(basePath, 'maintenance');
    this.reportPath = path.join(finalDir, 'dead-code.json');
    // Ensure directory exists
    try {
      fs.mkdirSync(finalDir, { recursive: true });
    } catch {}
  }

  // Very small glob-to-regex converter for our ignore patterns
  private globToRegExp(glob: string): RegExp {
    // Escape regex special chars, then replace globs
    const escaped = glob
      .replace(/[.+^${}()|\[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '(?:.*/)?') // **/ -> optional any path
      .replace(/\*\*/g, '.*') // ** -> any
      .replace(/\*/g, '[^/]*'); // * -> any but '/'
    return new RegExp('^' + escaped + '$');
  }

  private matchesAnyPattern(filePath: string, patterns: string[]): boolean {
    for (const p of patterns) {
      // handle leading './'
      const normalized = filePath.replace(/\\/g, '/');
      const re = this.globToRegExp(p);
      if (re.test(normalized)) return true;
      // also try without leading './'
      if (re.test(normalized.replace(/^\.\//, ''))) return true;
    }
    return false;
  }

  private shouldIgnore(item: DeadCodeItem): boolean {
    if (item.type === 'dependency') {
      const name = item.packageName || '';
      if (name.startsWith('@types/')) return true;
      // simple wildcard match for eslint-* and @eslint/*
      for (const p of this.ignorePackages) {
        if (p.endsWith('/*')) {
          const ns = p.slice(0, -2);
          if (name.startsWith(ns)) return true;
        } else if (p.endsWith('-*')) {
          const base = p.slice(0, -2);
          if (name === base || name.startsWith(base + '-')) return true;
        } else if (name === p) {
          return true;
        }
      }
      return false;
    }
    // file/export items
    const filePath = item.path || '';
    return this.matchesAnyPattern(filePath, this.ignoreGlobs);
  }

  private runCmd(cmd: string, args: string[], cwd: string, timeoutMs = 60000): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn(cmd, args, { cwd, shell: process.platform === 'win32' });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
        resolve({ code: -1, stdout, stderr: stderr + `\n[TIMEOUT ${timeoutMs}ms]` });
      }, timeoutMs);
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 0, stdout, stderr });
      });
    });
  }

  private tryParseJson<T = any>(text: string): T | null {
    try { return JSON.parse(text) as T; } catch { return null; }
  }

  private async scanTsPrune(projectDir: string): Promise<DeadCodeItem[]> {
    // ts-prune supports JSON via -j
    const { code, stdout } = await this.runCmd('npx', ['-y', 'ts-prune', '-j'], projectDir, 60000);
    if (code !== 0) return [];
    const data = this.tryParseJson<any[]>(stdout) || [];
    // ts-prune JSON: array of { file, name, line, isExport?, isDefault? }
    const now = new Date().toISOString();
    const items: DeadCodeItem[] = [];
    for (const row of data) {
      if (!row) continue;
      const f = (row.file || '').toString();
      const name = (row.name || '').toString();
      if (name) {
        items.push({ type: 'export', path: f, symbol: name, signals: ['ts-prune'], severity: 'medium', lastSeen: now });
      } else if (f) {
        items.push({ type: 'file', path: f, signals: ['ts-prune'], severity: 'low', lastSeen: now });
      }
    }
    return items;
  }

  private async scanUnimported(projectDir: string): Promise<DeadCodeItem[]> {
    // unimported supports JSON via --reporter json
    const { code, stdout } = await this.runCmd('npx', ['-y', 'unimported', '--reporter', 'json'], projectDir, 60000);
    if (code !== 0) return [];
    const data = this.tryParseJson<any>(stdout) || {};
    const now = new Date().toISOString();
    const items: DeadCodeItem[] = [];
    // data.unusedFiles?: string[]
    const files: string[] = Array.isArray(data.unusedFiles) ? data.unusedFiles : [];
    for (const f of files) {
      items.push({ type: 'file', path: f, signals: ['unimported'], severity: 'medium', lastSeen: now });
    }
    return items;
  }

  private async scanDepcheck(projectDir: string): Promise<DeadCodeItem[]> {
    const { code, stdout } = await this.runCmd('npx', ['-y', 'depcheck', '--json'], projectDir, 60000);
    if (code !== 0) return [];
    const data = this.tryParseJson<any>(stdout) || {};
    const now = new Date().toISOString();
    const items: DeadCodeItem[] = [];
    const unused: string[] = Array.isArray(data.dependencies) ? data.dependencies : (Array.isArray(data.unused) ? data.unused : []);
    const devUnused: string[] = Array.isArray(data.devDependencies) ? data.devDependencies : [];
    for (const p of [...unused, ...devUnused]) {
      items.push({ type: 'dependency', packageName: p, signals: ['depcheck'], severity: 'low', lastSeen: now });
    }
    return items;
  }

  // Enhanced scan running available tools with graceful fallback
  public async scan(): Promise<DeadCodeReport> {
    const now = new Date().toISOString();
    const projectDir = process.cwd();

    const allItems: DeadCodeItem[] = [];

    // Run tools sequentially with graceful error handling
    try {
      const tsPrune = await this.scanTsPrune(projectDir);
      allItems.push(...tsPrune);
    } catch (e) {
      // swallow to avoid crashing; tool may not be installed or may fail
    }

    try {
      const unimported = await this.scanUnimported(projectDir);
      allItems.push(...unimported);
    } catch (e) {
      // swallow
    }

    try {
      const depcheck = await this.scanDepcheck(projectDir);
      allItems.push(...depcheck);
    } catch (e) {
      // swallow
    }

    // Apply filtering and de-duplicate entries by signature
    const seen = new Set<string>();
    const items: DeadCodeItem[] = [];
    for (const it of allItems) {
      if (this.shouldIgnore(it)) continue;
      const key = `${it.type}:${it.path || ''}:${it.symbol || ''}:${it.packageName || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(it);
    }

    const summary = {
      deadFiles: items.filter(i => i.type === 'file').length,
      unusedExports: items.filter(i => i.type === 'export').length,
      unusedDependencies: items.filter(i => i.type === 'dependency').length,
      signals: Array.from(new Set(items.flatMap(i => i.signals)))
    };

    const report: DeadCodeReport = {
      generatedAt: now,
      summary,
      items
    };

    try {
      fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2), 'utf8');
    } catch {}

    return report;
  }

  public getLatestReport(): DeadCodeReport | null {
    try {
      if (!fs.existsSync(this.reportPath)) return null;
      const txt = fs.readFileSync(this.reportPath, 'utf8');
      return JSON.parse(txt);
    } catch {
      return null;
    }
  }
}
