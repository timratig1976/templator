import fs from 'fs';
import path from 'path';

export type TestExecutionState = {
  currentExecution: string | null;
  status: 'idle' | 'running' | 'completed' | 'error';
  startTime?: string;
  endTime?: string;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  skippedTests?: number;
  currentTest?: number;
  currentTestName?: string;
  currentSubtest?: string | null;
  tests?: any[];
  summary?: string;
  error?: string | null;
};

export class TestStateStore {
  private stateFile: string;
  private resultsFile: string;
  private historyDir: string;

  constructor() {
    const baseReports = process.env.REPORTS_DIR || 'reports';
    const basePath = path.isAbsolute(baseReports)
      ? baseReports
      : path.resolve(process.cwd(), '..', baseReports);
    const testsDir = path.join(basePath, 'tests');
    try { fs.mkdirSync(testsDir, { recursive: true }); } catch {}

    this.stateFile = path.join(testsDir, 'test-execution-state.json');
    this.resultsFile = path.join(testsDir, 'test-results.json');
    this.historyDir = path.join(testsDir, 'history');
    try { fs.mkdirSync(this.historyDir, { recursive: true }); } catch {}
  }

  readState(): TestExecutionState {
    try {
      const raw = fs.readFileSync(this.stateFile, 'utf8');
      return JSON.parse(raw);
    } catch {
      return { currentExecution: null, status: 'idle' };
    }
  }

  writeState(state: TestExecutionState) {
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
  }

  writeResults(executionId: string, results: any) {
    fs.writeFileSync(this.resultsFile, JSON.stringify(results, null, 2));
    const historyFile = path.join(this.historyDir, `${executionId}.json`);
    try { fs.writeFileSync(historyFile, JSON.stringify(results, null, 2)); } catch {}
  }

  readResults(): any {
    try {
      const raw = fs.readFileSync(this.resultsFile, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  listHistory(limit = 10): Array<{ id: string; path: string; mtime: number }> {
    try {
      const files = fs.readdirSync(this.historyDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const p = path.join(this.historyDir, f);
          const stat = fs.statSync(p);
          return { id: path.basename(f, '.json'), path: p, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, limit);
      return files;
    } catch {
      return [];
    }
  }
}
