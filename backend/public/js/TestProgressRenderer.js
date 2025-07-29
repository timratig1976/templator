/**
 * TestProgressRenderer - Handles rendering of test progress UI components
 * Generates progress bars, metrics displays, and status indicators
 */
class TestProgressRenderer {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    /**
     * Render main progress bar with percentage
     */
    renderProgressBar(testState) {
        const progress = testState.progressPercentage || 0;
        
        return `
            <div style="margin-bottom: 15px;">
                <strong>🔄 Live Test Execution</strong>
                <div style="height: 20px; background: #e9ecef; border-radius: 4px; margin-top: 8px; overflow: hidden;">
                    <div style="height: 100%; width: ${progress}%; background-color: #007bff; transition: width 0.3s ease;"></div>
                </div>
                <div style="text-align: center; margin-top: 5px; font-weight: bold;">Progress: ${progress}%</div>
            </div>
        `;
    }

    /**
     * Render test metrics overview grid
     */
    renderMetricsGrid(testState) {
        const summary = this.stateManager.generateSummary(testState);
        if (!summary) return '';

        return `
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px;">
                <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #007bff;">${summary.totalTests}</div>
                    <div style="font-size: 0.9em; color: #6c757d;">Total</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #e8f5e9; border-radius: 4px;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #28a745;">${summary.passedTests}</div>
                    <div style="font-size: 0.9em; color: #6c757d;">Passed</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #ffebee; border-radius: 4px;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #dc3545;">${summary.failedTests}</div>
                    <div style="font-size: 0.9em; color: #6c757d;">Failed</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #fff3cd; border-radius: 4px;">
                    <div style="font-size: 1.5em; font-weight: bold; color: #856404;">${summary.pendingTests}</div>
                    <div style="font-size: 0.9em; color: #6c757d;">Pending</div>
                </div>
            </div>
        `;
    }

    /**
     * Render current test information
     */
    renderCurrentTest(testState) {
        if (!testState.currentTestName) return '';

        return `
            <div style="padding: 12px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 0 4px 4px 0; margin-bottom: 15px;">
                <div style="font-weight: bold; color: #856404;">⚡ Currently Running:</div>
                <div style="margin-top: 5px;">${testState.currentTestName}</div>
                ${testState.summary ? `<div style="margin-top: 5px; font-size: 0.9em; color: #6c757d;">${testState.summary}</div>` : ''}
            </div>
        `;
    }

    /**
     * Render execution summary
     */
    renderExecutionSummary(testState) {
        const summary = this.stateManager.generateSummary(testState);
        if (!summary) return '';

        return `
            <div style="padding: 12px; background: #f8f9fa; border-radius: 4px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>Execution Summary</strong>
                        <div style="font-size: 0.9em; color: #6c757d; margin-top: 2px;">
                            ${testState.startTime ? testState.startTime.toLocaleString() : 'Unknown start time'}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: #007bff;">${summary.formattedDuration}</div>
                        <div style="font-size: 0.9em; color: #6c757d;">Duration</div>
                    </div>
                </div>
                ${testState.id ? `<div style="margin-top: 8px; font-size: 0.9em; color: #6c757d;">ID: ${testState.id}</div>` : ''}
            </div>
        `;
    }

    /**
     * Render category breakdown
     */
    renderCategoryBreakdown(testState) {
        const summary = this.stateManager.generateSummary(testState);
        if (!summary || !summary.categoryCounts) return '';

        const categories = Object.keys(summary.categoryCounts).filter(cat => summary.categoryCounts[cat] > 0);
        if (categories.length === 0) return '';

        return `
            <div style="margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px; color: #495057;">📊 Test Categories</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${categories.map(category => {
                        const config = this.stateManager.getCategoryConfig(category);
                        const count = summary.categoryCounts[category];
                        return `
                            <div style="padding: 6px 12px; background: ${config.color}20; border: 1px solid ${config.color}40; border-radius: 16px; font-size: 0.9em;">
                                ${config.icon} ${config.label}: <strong>${count}</strong>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render complete running test display
     */
    renderRunningTestDisplay(testState) {
        if (!testState || testState.status !== 'running') return '';

        return `
            ${this.renderProgressBar(testState)}
            ${this.renderMetricsGrid(testState)}
            ${this.renderExecutionSummary(testState)}
            ${this.renderCurrentTest(testState)}
            ${this.renderCategoryBreakdown(testState)}
        `;
    }

    /**
     * Render completion summary
     */
    renderCompletionSummary(testState) {
        if (!testState || testState.status !== 'completed') return '';

        const summary = this.stateManager.generateSummary(testState);
        const passRate = summary ? summary.passRate : 0;
        const statusColor = passRate >= 80 ? '#28a745' : passRate >= 60 ? '#ffc107' : '#dc3545';
        const statusIcon = passRate >= 80 ? '✅' : passRate >= 60 ? '⚠️' : '❌';

        return `
            <div style="margin-bottom: 20px;">
                <div style="text-align: center; padding: 20px; background: ${statusColor}10; border: 2px solid ${statusColor}40; border-radius: 8px;">
                    <div style="font-size: 2em; margin-bottom: 10px;">${statusIcon}</div>
                    <h3 style="color: ${statusColor}; margin-bottom: 10px;">Tests Completed!</h3>
                    <div style="font-size: 1.2em; margin-bottom: 15px;">
                        <strong>${summary.passedTests}/${summary.totalTests}</strong> tests passed (${passRate}%)
                    </div>
                    <div style="color: #6c757d;">
                        Completed in ${summary.formattedDuration}
                    </div>
                </div>
            </div>
            ${this.renderMetricsGrid(testState)}
            ${this.renderCategoryBreakdown(testState)}
        `;
    }

    /**
     * Render error state
     */
    renderErrorState(message) {
        return `
            <div style="padding: 20px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; color: #721c24;">
                <div style="font-size: 1.5em; margin-bottom: 10px;">❌</div>
                <strong>Error</strong>
                <div style="margin-top: 8px;">${message}</div>
            </div>
        `;
    }

    /**
     * Render loading state
     */
    renderLoadingState(message = 'Loading...') {
        return `
            <div style="padding: 20px; text-align: center; color: #6c757d;">
                <div style="font-size: 1.5em; margin-bottom: 10px;">🔄</div>
                <div>${message}</div>
            </div>
        `;
    }

    /**
     * Render connection success state
     */
    renderConnectionSuccess() {
        return `
            <div style="padding: 20px; background: #d4edda; border-radius: 8px; border-left: 4px solid #28a745;">
                <h4 style="color: #28a745;">✅ Server Connected</h4>
                <p>👆 Click a button above to view test information</p>
                <ul style="text-align: left; margin-top: 15px;">
                    <li><strong>Run Full Test Suite</strong> - Start new test execution</li>
                    <li><strong>Check Test Status</strong> - View current/latest test status</li>
                    <li><strong>View Latest Results</strong> - See all test execution history</li>
                </ul>
            </div>
        `;
    }
}

// Export for use in other modules
window.TestProgressRenderer = TestProgressRenderer;
