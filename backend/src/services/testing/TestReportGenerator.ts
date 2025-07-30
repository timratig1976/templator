import { BaseService, FileOperationMixin } from '../../shared/BaseService';
import { TestSuiteResult } from './TestSuiteManager';
import path from 'path';

export interface TestReportGeneratorConfig {
  outputDir: string;
  generateHTML: boolean;
  generateJSON?: boolean;
  templatePath?: string;
}

/**
 * Generates test reports in various formats
 * Extracted from the monolithic test runner
 */
export class TestReportGenerator extends BaseService {
  private fileOps: FileOperationMixin;

  constructor(config: TestReportGeneratorConfig) {
    super('TestReportGenerator', config);
    this.fileOps = new FileOperationMixin();
  }

  protected async initialize(): Promise<void> {
    const fs = await import('fs/promises');
    await fs.mkdir(this.config.outputDir, { recursive: true });
  }

  /**
   * Generate comprehensive test report
   */
  async generateReport(result: TestSuiteResult): Promise<void> {
    await this.ensureInitialized();

    const reportPath = path.join(this.config.outputDir, `test-report-${Date.now()}.html`);
    
    try {
      if (this.config.generateHTML) {
        const htmlContent = this.generateHTMLReport(result);
        const fs = await import('fs/promises');
        await fs.writeFile(reportPath.replace('.html', '.json'), JSON.stringify(result, null, 2));
        await fs.writeFile(reportPath, htmlContent);
        
        this.logger.info('Test report generated', { reportPath });
      }

      if (this.config.generateJSON) {
        const jsonPath = path.join(this.config.outputDir, `test-results-${Date.now()}.json`);
        const fs = await import('fs/promises');
        await fs.writeFile(jsonPath, JSON.stringify(result, null, 2));
      }

    } catch (error) {
      throw this.handleError(error as Error, { reportPath, result: result.id });
    }
  }

  /**
   * Generate HTML report content
   */
  private generateHTMLReport(result: TestSuiteResult): string {
    const passRate = result.totalTests > 0 ? (result.passedTests / result.totalTests * 100).toFixed(1) : '0';
    const success = result.failedTests === 0;
    const statusColor = success ? '#10B981' : '#EF4444';
    const statusText = success ? 'PASSED' : 'FAILED';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report - ${result.name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { 
            background: white;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .status-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-weight: 600;
            color: white;
            background: ${statusColor};
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }
        .metric-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2rem;
            font-weight: 700;
            color: #0f172a;
        }
        .metric-label {
            color: #64748b;
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .test-results {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .test-item {
            padding: 1rem;
            border-left: 4px solid #e2e8f0;
            margin-bottom: 1rem;
            background: #f8fafc;
        }
        .test-passed { border-left-color: #10B981; }
        .test-failed { border-left-color: #EF4444; }
        .test-name { font-weight: 600; margin-bottom: 0.5rem; }
        .test-duration { color: #64748b; font-size: 0.875rem; }
        .test-error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            padding: 1rem;
            border-radius: 6px;
            margin-top: 0.5rem;
            font-family: monospace;
            font-size: 0.875rem;
            color: #991b1b;
        }
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
            margin: 1rem 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #10B981, #059669);
            width: ${passRate}%;
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Test Report</h1>
            <p>Execution ID: ${result.id}</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <div style="margin-top: 1rem;">
                <span class="status-badge">${statusText}</span>
            </div>
        </div>

        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value">${result.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color: #10B981;">${result.passedTests}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value" style="color: #EF4444;">${result.failedTests}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${passRate}%</div>
                <div class="metric-label">Pass Rate</div>
            </div>
        </div>

        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>

        <div class="test-results">
            <h2>Test Results</h2>
            ${this.generateTestResultsHTML(result)}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate test results section HTML
   */
  private generateTestResultsHTML(result: TestSuiteResult): string {
    if (!result.tests || result.tests.length === 0) {
      return '<p>No test results available</p>';
    }

    return result.tests.map((test: any) => {
      const statusClass = test.status === 'passed' ? 'test-passed' : 'test-failed';
      const duration = test.duration ? `${test.duration}ms` : 'N/A';
      
      let errorHTML = '';
      if (test.status === 'failed' && test.error) {
        errorHTML = `<div class="test-error">${this.escapeHtml(test.error)}</div>`;
      }

      return `
        <div class="test-item ${statusClass}">
            <div class="test-name">${this.escapeHtml(test.name)}</div>
            <div class="test-duration">Duration: ${duration}</div>
            ${errorHTML}
        </div>
      `;
    }).join('');
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Generate dashboard HTML for real-time viewing
   */
  generateDashboardHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Runner Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 2rem; }
        .status { 
            padding: 1rem 2rem;
            border-radius: 8px;
            margin: 1rem 0;
            font-weight: 600;
        }
        .status.idle { background: #374151; }
        .status.running { background: #1d4ed8; }
        .status.success { background: #059669; }
        .status.error { background: #dc2626; }
        .controls { 
            display: flex; 
            gap: 1rem; 
            justify-content: center; 
            margin: 2rem 0; 
        }
        button {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 6px;
            background: #3b82f6;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover { background: #2563eb; }
        button:disabled { background: #6b7280; cursor: not-allowed; }
        .log-container {
            background: #1e293b;
            border-radius: 8px;
            padding: 1rem;
            height: 400px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 0.875rem;
        }
        .log-entry {
            padding: 0.25rem 0;
            border-bottom: 1px solid #334155;
        }
        .log-info { color: #60a5fa; }
        .log-success { color: #34d399; }
        .log-warning { color: #fbbf24; }
        .log-error { color: #f87171; }
        .results-container {
            margin-top: 2rem;
            background: #1e293b;
            border-radius: 8px;
            padding: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Test Runner Dashboard</h1>
            <p>Real-time test execution monitoring</p>
        </div>

        <div id="status" class="status idle">
            Ready to run tests
        </div>

        <div class="controls">
            <button id="runTestsBtn">Run Tests</button>
            <button id="viewReportBtn" disabled>View Report</button>
            <button id="clearLogsBtn">Clear Logs</button>
        </div>

        <div class="log-container" id="logContainer">
            <div class="log-entry log-info">Dashboard ready - waiting for commands...</div>
        </div>

        <div class="results-container" id="resultsContainer" style="display: none;">
            <h3>Test Results</h3>
            <div id="resultsContent"></div>
        </div>
    </div>

    <script>
        const statusEl = document.getElementById('status');
        const runTestsBtn = document.getElementById('runTestsBtn');
        const viewReportBtn = document.getElementById('viewReportBtn');
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        const logContainer = document.getElementById('logContainer');
        const resultsContainer = document.getElementById('resultsContainer');
        const resultsContent = document.getElementById('resultsContent');

        function addLogEntry(type, message) {
            const entry = document.createElement('div');
            entry.className = \`log-entry log-\${type}\`;
            entry.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
            logContainer.appendChild(entry);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        function updateStatus(type, message) {
            statusEl.className = \`status \${type}\`;
            statusEl.textContent = message;
        }

        runTestsBtn.addEventListener('click', async () => {
            try {
                runTestsBtn.disabled = true;
                updateStatus('running', 'Starting tests...');
                addLogEntry('info', 'Initiating test run...');

                const response = await fetch('/api/run-tests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categories: ['api', 'pipeline', 'services'] })
                });

                const data = await response.json();
                
                if (data.success) {
                    addLogEntry('success', 'Tests started successfully');
                    pollTestStatus();
                } else {
                    addLogEntry('error', \`Failed to start tests: \${data.error}\`);
                    updateStatus('error', 'Failed to start tests');
                    runTestsBtn.disabled = false;
                }
            } catch (error) {
                addLogEntry('error', \`Error: \${error.message}\`);
                updateStatus('error', 'Error starting tests');
                runTestsBtn.disabled = false;
            }
        });

        clearLogsBtn.addEventListener('click', () => {
            logContainer.innerHTML = '<div class="log-entry log-info">Logs cleared</div>';
        });

        function pollTestStatus() {
            const poll = () => {
                fetch('/api/test-status')
                    .then(response => response.json())
                    .then(data => {
                        if (!data.isRunning) {
                            runTestsBtn.disabled = false;
                            
                            if (data.results) {
                                const success = data.results.success;
                                updateStatus(success ? 'success' : 'error', 
                                    success ? 'All tests passed!' : 'Some tests failed');
                                updateResults(data);
                                viewReportBtn.disabled = false;
                            }
                            
                            addLogEntry('info', 'Test suite completed');
                            return;
                        }
                        
                        addLogEntry('info', 'Tests still running...');
                        setTimeout(poll, 2000);
                    })
                    .catch(error => {
                        console.error('Polling error:', error);
                        addLogEntry('error', \`Error polling status: \${error.message}\`);
                        updateStatus('error', 'Error polling status');
                        runTestsBtn.disabled = false;
                    });
            };
            poll();
        }

        function updateResults(data) {
            if (data.results) {
                const results = data.results;
                resultsContent.innerHTML = \`
                    <p><strong>Total Tests:</strong> \${results.totalTests || 0}</p>
                    <p><strong>Passed:</strong> \${results.passedTests || 0}</p>
                    <p><strong>Failed:</strong> \${results.failedTests || 0}</p>
                    <p><strong>Success Rate:</strong> \${results.totalTests > 0 ? 
                        ((results.passedTests / results.totalTests) * 100).toFixed(1) : 0}%</p>
                \`;
                resultsContainer.style.display = 'block';
            }
        }

        // Load initial status
        fetch('/api/test-status')
            .then(response => response.json())
            .then(data => {
                if (data.results) {
                    updateResults(data);
                    viewReportBtn.disabled = false;
                }
                if (data.isRunning) {
                    updateStatus('running', 'Tests are currently running...');
                    pollTestStatus();
                }
            })
            .catch(error => {
                addLogEntry('error', \`Failed to load initial status: \${error.message}\`);
            });
    </script>
</body>
</html>`;
  }
}
