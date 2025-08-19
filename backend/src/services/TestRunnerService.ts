import { spawn } from 'child_process';
import { TestStateStore, TestExecutionState } from './TestStateStore';

export class TestRunnerService {
  private static instance: TestRunnerService;
  private store: TestStateStore;
  private isRunning = false;
  private currentExecutionId: string | null = null;

  private constructor() {
    this.store = new TestStateStore();
  }

  static getInstance() {
    if (!TestRunnerService.instance) {
      TestRunnerService.instance = new TestRunnerService();
    }
    return TestRunnerService.instance;
  }

  getStatus() {
    return this.store.readState();
  }

  getResults() {
    return this.store.readResults();
  }

  async start(): Promise<{ executionId: string } | { error: string }> {
    if (this.isRunning) {
      return { error: 'A test execution is already running' };
    }

    const executionId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.currentExecutionId = executionId;
    this.isRunning = true;

    const initial: TestExecutionState = {
      currentExecution: executionId,
      status: 'running',
      startTime: new Date().toISOString(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      currentTest: 0,
      currentTestName: 'Initializing test suite...',
      currentSubtest: null,
      tests: [],
      summary: 'Starting test execution...'
    };
    this.store.writeState(initial);

    // Kick off Jest
    const jestProcess = spawn('npm', ['test', '--', '--verbose', '--json'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    jestProcess.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    jestProcess.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
      // Optional: could update state with stderr lines if desired
    });

    // Lightweight simulated progress to keep UI responsive
    let progressTimer: NodeJS.Timeout | null = null;
    if (!(process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test')) {
      progressTimer = setInterval(() => {
        try {
          const s = this.store.readState();
          if (s.status !== 'running') {
            if (progressTimer) clearInterval(progressTimer);
            return;
          }
          const started = s.startTime ? new Date(s.startTime).getTime() : Date.now();
          const elapsed = Date.now() - started;
          const total = 25;
          const rate = Math.min(elapsed / 30000, 1);
          s.totalTests = total;
          s.passedTests = Math.floor(rate * total * 0.8);
          s.failedTests = Math.floor(rate * total * 0.1);
          s.skippedTests = Math.floor(rate * total * 0.1);
          s.currentTest = Math.min(Math.floor(rate * total) + 1, total);
          s.currentTestName = `Running tests - ${s.currentTest}/${total}`;
          s.summary = `Running tests: ${s.passedTests + s.failedTests}/${total} completed`;
          this.store.writeState(s);
        } catch {}
      }, 3000);
    }

    jestProcess.on('close', (code: number) => {
      if (progressTimer) clearInterval(progressTimer);
      const finalState: TestExecutionState = {
        currentExecution: executionId,
        status: 'completed',
        startTime: initial.startTime,
        endTime: new Date().toISOString(),
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        currentTest: 0,
        tests: [],
        summary: 'Test execution completed'
      };

      try {
        const line = stdout.split('\n').find(l => l.trim().startsWith('{') && l.includes('testResults'));
        if (line) {
          const res = JSON.parse(line);
          finalState.totalTests = res.numTotalTests || 0;
          finalState.passedTests = res.numPassedTests || 0;
          finalState.failedTests = res.numFailedTests || 0;
          finalState.skippedTests = res.numPendingTests || 0;
          if (Array.isArray(res.testResults)) {
            finalState.tests = res.testResults.map((tf: any) => ({
              name: tf.name,
              status: tf.status === 'passed' ? 'passed' : 'failed',
              duration: tf.perfStats?.end - tf.perfStats?.start || 0,
              error: tf.failureMessage || null
            }));
          }
          this.store.writeResults(executionId, res);
          finalState.summary = `Tests completed: ${finalState.passedTests} passed, ${finalState.failedTests} failed`;
        } else {
          finalState.summary = 'Completed, but could not parse Jest JSON output';
        }
      } catch (e: any) {
        finalState.summary = `Completed with parsing error: ${e?.message || 'unknown'}`;
      }

      this.store.writeState(finalState);
      this.isRunning = false;
      this.currentExecutionId = null;
    });

    return { executionId };
  }
}
