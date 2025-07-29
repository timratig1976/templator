/**
 * TestResultsRenderer - Handles rendering of detailed test results and breakdowns
 * Generates test lists, categorized views, and individual test details
 */
class TestResultsRenderer {
    constructor(stateManager) {
        this.stateManager = stateManager;
    }

    /**
     * Render detailed test results breakdown
     */
    renderTestResultsBreakdown(testState) {
        if (!testState || !testState.tests || testState.tests.length === 0) {
            return '';
        }

        return `
            <div style="margin-top: 20px;">
                <h4 style="margin-bottom: 15px; color: #495057;">📋 Test Results Breakdown</h4>
                ${this.renderTestsByCategory(testState.testsByCategory)}
            </div>
        `;
    }

    /**
     * Render tests grouped by category
     */
    renderTestsByCategory(testsByCategory) {
        const categories = Object.keys(testsByCategory).filter(cat => testsByCategory[cat].length > 0);
        
        if (categories.length === 0) {
            return '<div style="color: #6c757d; font-style: italic;">No test results available</div>';
        }

        return categories.map(category => {
            const tests = testsByCategory[category];
            const config = this.stateManager.getCategoryConfig(category);
            const passedCount = tests.filter(t => t.status === 'passed').length;
            const failedCount = tests.filter(t => t.status === 'failed').length;

            return `
                <div style="margin-bottom: 15px; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden;">
                    <div style="background: #f8f9fa; padding: 12px; border-bottom: 1px solid #dee2e6;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${config.icon} ${config.label}</strong>
                                <span style="margin-left: 10px; font-size: 0.9em; color: #6c757d;">(${tests.length} tests)</span>
                            </div>
                            <div>
                                <span style="color: #28a745; margin-right: 10px;">✅ ${passedCount}</span>
                                <span style="color: #dc3545;">❌ ${failedCount}</span>
                            </div>
                        </div>
                    </div>
                    ${this.renderTestList(tests)}
                </div>
            `;
        }).join('');
    }

    /**
     * Render list of individual tests
     */
    renderTestList(tests) {
        return tests.map((test, index) => {
            // Properly format test properties to avoid undefined values
            const statusIcon = test.status === 'passed' ? '✅' : 
                             test.status === 'failed' ? '❌' : 
                             test.status === 'skipped' ? '⏭️' : '⚪';
            
            const statusColor = test.status === 'passed' ? '#28a745' : 
                              test.status === 'failed' ? '#dc3545' : 
                              test.status === 'skipped' ? '#6c757d' : '#6c757d';
            
            const bgColor = test.status === 'passed' ? '#f8fff9' : 
                           test.status === 'failed' ? '#fff5f5' : '#f8f9fa';
            
            const formattedDuration = test.duration ? `${test.duration}ms` : 'N/A';
            const testName = test.name || 'Unknown Test';
            const testDescription = test.description || test.details || '';

            return `
                <div style="border-bottom: ${index < tests.length - 1 ? '1px solid #f1f3f4' : 'none'}; background: ${bgColor}; margin-bottom: 8px; border-radius: 4px;">
                    <div style="padding: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                                    <span style="color: ${statusColor}; margin-right: 8px; font-size: 1.1em;">
                                        ${statusIcon}
                                    </span>
                                    <strong style="color: #333;">${testName}</strong>
                                </div>
                                ${testDescription ? `<div style="font-size: 0.85em; color: #6c757d; margin-left: 20px; margin-bottom: 4px;">${testDescription}</div>` : ''}
                                <div style="font-size: 0.8em; color: #6c757d; margin-left: 20px;">
                                    <span style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; margin-right: 8px;">${test.category || 'general'}</span>
                                    <span>Duration: ${formattedDuration}</span>
                                </div>
                            </div>
                        </div>
                        
                        ${test.error ? this.renderTestError(test.error) : ''}
                        ${test.subtests && test.subtests.length > 0 ? this.renderSubtests(test.subtests) : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render test error details
     */
    renderTestError(error) {
        return `
            <div style="margin-top: 8px; padding: 8px; background: #f8d7da; border-radius: 4px; border-left: 3px solid #dc3545;">
                <div style="font-weight: bold; color: #721c24; margin-bottom: 4px;">Error Details:</div>
                <div style="font-family: monospace; font-size: 0.85em; color: #721c24; white-space: pre-wrap;">${error}</div>
            </div>
        `;
    }

    /**
     * Render subtests
     */
    renderSubtests(subtests) {
        return `
            <div style="margin-top: 8px; margin-left: 20px; padding-left: 12px; border-left: 2px solid #e9ecef;">
                <div style="font-weight: bold; color: #495057; margin-bottom: 6px; font-size: 0.9em;">Subtests:</div>
                ${subtests.map(subtest => `
                    <div style="margin-bottom: 4px; font-size: 0.9em;">
                        <span style="color: ${subtest.statusColor}; margin-right: 6px;">${subtest.statusIcon}</span>
                        ${subtest.name}
                        <span style="color: #6c757d; margin-left: 8px;">(${subtest.formattedDuration})</span>
                        ${subtest.error ? `<div style="margin-top: 4px; margin-left: 16px; font-size: 0.85em; color: #dc3545;">${subtest.error}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render test results by status (for running tests)
     */
    renderTestsByStatus(testsByStatus) {
        const sections = [];

        // Running tests
        if (testsByStatus.running && testsByStatus.running.length > 0) {
            sections.push(`
                <div style="margin-bottom: 15px; padding: 12px; background: #e3f2fd; border-radius: 4px; border-left: 4px solid #007bff;">
                    <div style="font-weight: bold; color: #0d6efd; margin-bottom: 8px;">🔄 Running Tests (${testsByStatus.running.length})</div>
                    ${this.renderSimpleTestList(testsByStatus.running)}
                </div>
            `);
        }

        // Failed tests
        if (testsByStatus.failed && testsByStatus.failed.length > 0) {
            sections.push(`
                <div style="margin-bottom: 15px; padding: 12px; background: #fff5f5; border-radius: 4px; border-left: 4px solid #dc3545;">
                    <div style="font-weight: bold; color: #dc3545; margin-bottom: 8px;">❌ Failed Tests (${testsByStatus.failed.length})</div>
                    ${this.renderSimpleTestList(testsByStatus.failed, true)}
                </div>
            `);
        }

        // Passed tests (collapsed by default)
        if (testsByStatus.passed && testsByStatus.passed.length > 0) {
            sections.push(`
                <div style="margin-bottom: 15px; padding: 12px; background: #f8fff9; border-radius: 4px; border-left: 4px solid #28a745;">
                    <div style="font-weight: bold; color: #28a745; margin-bottom: 8px;">✅ Passed Tests (${testsByStatus.passed.length})</div>
                    <details style="margin-top: 8px;">
                        <summary style="cursor: pointer; color: #6c757d; font-size: 0.9em;">Show passed tests</summary>
                        <div style="margin-top: 8px;">
                            ${this.renderSimpleTestList(testsByStatus.passed)}
                        </div>
                    </details>
                </div>
            `);
        }

        return sections.join('');
    }

    /**
     * Render simple test list (for status grouping)
     */
    renderSimpleTestList(tests, showErrors = false) {
        return tests.map(test => {
            // Properly format test properties to avoid undefined values
            const statusIcon = test.status === 'passed' ? '✅' : 
                             test.status === 'failed' ? '❌' : 
                             test.status === 'skipped' ? '⏭️' : '⚪';
            
            const statusColor = test.status === 'passed' ? '#28a745' : 
                              test.status === 'failed' ? '#dc3545' : 
                              test.status === 'skipped' ? '#6c757d' : '#6c757d';
            
            const formattedDuration = test.duration ? `${test.duration}ms` : 'N/A';
            const testName = test.name || 'Unknown Test';
            
            return `
                <div style="margin-bottom: 6px; padding: 8px; background: rgba(255,255,255,0.7); border-radius: 4px; border-left: 3px solid ${statusColor};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="color: ${statusColor}; margin-right: 6px;">${statusIcon}</span>
                            <span style="font-weight: 500; color: #333;">${testName}</span>
                        </div>
                        <span style="font-size: 0.85em; color: #6c757d;">${formattedDuration}</span>
                    </div>
                    ${test.description ? `
                        <div style="margin-top: 4px; font-size: 0.8em; color: #6c757d;">
                            ${test.description}
                        </div>
                    ` : ''}
                    ${showErrors && test.error ? `
                        <div style="margin-top: 6px; font-size: 0.85em; color: #dc3545; font-family: monospace; background: #fff5f5; padding: 4px; border-radius: 3px;">
                            ${test.error}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * Render test execution history
     */
    renderTestHistory(history) {
        if (!history || history.length === 0) {
            return `
                <div style="padding: 20px; text-align: center; color: #6c757d;">
                    <div style="font-size: 1.5em; margin-bottom: 10px;">📋</div>
                    <div>No test execution history available</div>
                </div>
            `;
        }

        return `
            <div style="margin-top: 20px;">
                <h4 style="margin-bottom: 15px; color: #495057;">📚 Test Execution History</h4>
                ${history.map((execution, index) => {
                    const summary = this.stateManager.generateSummary(execution);
                    const passRate = summary ? summary.passRate : 0;
                    const statusColor = passRate >= 80 ? '#28a745' : passRate >= 60 ? '#ffc107' : '#dc3545';
                    
                    return `
                        <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #dee2e6; border-radius: 6px; background: #f8f9fa;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong style="color: ${statusColor};">
                                        ${summary.passedTests}/${summary.totalTests} passed (${passRate}%)
                                    </strong>
                                    <div style="font-size: 0.9em; color: #6c757d; margin-top: 2px;">
                                        ${execution.timestamp ? execution.timestamp.toLocaleString() : 'Unknown time'}
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: bold;">${summary.formattedDuration}</div>
                                    <div style="font-size: 0.85em; color: #6c757d;">Duration</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
}

// Export for use in other modules
window.TestResultsRenderer = TestResultsRenderer;
