/**
 * TestStateManager - Handles test data transformation and state management
 * Processes raw API responses into structured data for UI components
 */
class TestStateManager {
    constructor() {
        this.currentTestState = null;
        this.testHistory = [];
    }

    /**
     * Process raw test status data into structured format
     */
    processTestStatus(rawStatus) {
        if (!rawStatus) {
            return null;
        }

        const processed = {
            id: rawStatus.id || null,
            status: rawStatus.status || 'unknown',
            startTime: rawStatus.startTime ? new Date(rawStatus.startTime) : null,
            endTime: rawStatus.endTime ? new Date(rawStatus.endTime) : null,
            summary: rawStatus.summary || '',
            currentTestName: rawStatus.currentTestName || null,
            
            // Test metrics
            totalTests: rawStatus.totalTests || 0,
            passedTests: rawStatus.passedTests || 0,
            failedTests: rawStatus.failedTests || 0,
            skippedTests: rawStatus.skippedTests || 0,
            currentTest: rawStatus.currentTest || 0,
            
            // Individual test results
            tests: this.processTestResults(rawStatus.tests || []),
            
            // Calculated fields
            completedTests: (rawStatus.passedTests || 0) + (rawStatus.failedTests || 0),
            pendingTests: Math.max(0, (rawStatus.totalTests || 0) - ((rawStatus.passedTests || 0) + (rawStatus.failedTests || 0))),
            progressPercentage: this.calculateProgress(rawStatus),
            duration: this.calculateDuration(rawStatus.startTime, rawStatus.endTime),
            
            // Categorized results
            testsByCategory: this.categorizeTests(rawStatus.tests || []),
            testsByStatus: this.groupTestsByStatus(rawStatus.tests || [])
        };

        this.currentTestState = processed;
        return processed;
    }

    /**
     * Process individual test results
     */
    processTestResults(tests) {
        return tests.map(test => ({
            name: test.name || 'Unknown Test',
            status: test.status || 'unknown',
            file: test.file || '',
            duration: test.duration || 0,
            error: test.error || null,
            category: this.categorizeTest(test),
            subtests: this.processSubtests(test.subtests || []),
            
            // Formatted fields
            formattedDuration: this.formatDuration(test.duration || 0),
            statusIcon: this.getStatusIcon(test.status),
            statusColor: this.getStatusColor(test.status)
        }));
    }

    /**
     * Process subtest results
     */
    processSubtests(subtests) {
        return subtests.map(subtest => ({
            name: subtest.name || 'Unknown Subtest',
            status: subtest.status || 'unknown',
            duration: subtest.duration || 0,
            error: subtest.error || null,
            
            // Formatted fields
            formattedDuration: this.formatDuration(subtest.duration || 0),
            statusIcon: this.getStatusIcon(subtest.status),
            statusColor: this.getStatusColor(subtest.status)
        }));
    }

    /**
     * Categorize a test based on its file path
     */
    categorizeTest(test) {
        const file = test.file || test.name || '';
        
        if (file.includes('/__tests__/unit/') || file.includes('/unit/')) return 'unit';
        if (file.includes('/__tests__/e2e/') || file.includes('/e2e/')) return 'e2e';
        if (file.includes('/tests/integration/') || file.includes('/integration/')) return 'integration';
        if (file.includes('/tests/performance/') || file.includes('/performance/')) return 'performance';
        if (file.includes('/tests/services/') || file.includes('/services/')) return 'services';
        
        return 'other';
    }

    /**
     * Group tests by category
     */
    categorizeTests(tests) {
        const categories = {
            unit: [],
            integration: [],
            e2e: [],
            performance: [],
            services: [],
            other: []
        };

        tests.forEach(test => {
            const category = this.categorizeTest(test);
            if (categories[category]) {
                categories[category].push(test);
            }
        });

        return categories;
    }

    /**
     * Group tests by status
     */
    groupTestsByStatus(tests) {
        return {
            passed: tests.filter(t => t.status === 'passed'),
            failed: tests.filter(t => t.status === 'failed'),
            running: tests.filter(t => t.status === 'running'),
            pending: tests.filter(t => !['passed', 'failed', 'running'].includes(t.status)),
            skipped: tests.filter(t => t.status === 'skipped')
        };
    }

    /**
     * Calculate test progress percentage
     */
    calculateProgress(rawStatus) {
        const total = rawStatus.totalTests || 0;
        const completed = (rawStatus.passedTests || 0) + (rawStatus.failedTests || 0);
        
        if (total === 0) return 0;
        return Math.round((completed / total) * 100);
    }

    /**
     * Calculate test execution duration
     */
    calculateDuration(startTime, endTime) {
        if (!startTime) return null;
        
        const start = new Date(startTime);
        const end = endTime ? new Date(endTime) : new Date();
        
        return end.getTime() - start.getTime();
    }

    /**
     * Format duration in milliseconds to human readable format
     */
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    /**
     * Get status icon for display
     */
    getStatusIcon(status) {
        const icons = {
            passed: '✅',
            failed: '❌',
            running: '🔄',
            pending: '⏳',
            skipped: '⏭️',
            unknown: '❓'
        };
        
        return icons[status] || icons.unknown;
    }

    /**
     * Get status color for display
     */
    getStatusColor(status) {
        const colors = {
            passed: '#28a745',
            failed: '#dc3545',
            running: '#007bff',
            pending: '#ffc107',
            skipped: '#6c757d',
            unknown: '#6c757d'
        };
        
        return colors[status] || colors.unknown;
    }

    /**
     * Get category configuration for display
     */
    getCategoryConfig(category) {
        const configs = {
            unit: { icon: '🧪', color: '#28a745', label: 'Unit Tests' },
            integration: { icon: '🔗', color: '#ffc107', label: 'Integration Tests' },
            e2e: { icon: '🌐', color: '#007bff', label: 'E2E Tests' },
            performance: { icon: '⚡', color: '#dc3545', label: 'Performance Tests' },
            services: { icon: '⚙️', color: '#6c757d', label: 'Service Tests' },
            other: { icon: '📝', color: '#6c757d', label: 'Other Tests' }
        };
        
        return configs[category] || configs.other;
    }

    /**
     * Get current test state
     */
    getCurrentState() {
        return this.currentTestState;
    }

    /**
     * Add test execution to history
     */
    addToHistory(testState) {
        if (testState && testState.status === 'completed') {
            this.testHistory.unshift({
                ...testState,
                timestamp: new Date()
            });
            
            // Keep only last 10 executions
            this.testHistory = this.testHistory.slice(0, 10);
        }
    }

    /**
     * Get test execution history
     */
    getHistory() {
        return [...this.testHistory];
    }

    /**
     * Clear current state
     */
    clearState() {
        this.currentTestState = null;
    }

    /**
     * Generate summary statistics
     */
    generateSummary(testState = this.currentTestState) {
        if (!testState) return null;

        return {
            totalTests: testState.totalTests,
            completedTests: testState.completedTests,
            passedTests: testState.passedTests,
            failedTests: testState.failedTests,
            skippedTests: testState.skippedTests,
            pendingTests: testState.pendingTests,
            progressPercentage: testState.progressPercentage,
            duration: testState.duration,
            formattedDuration: this.formatDuration(testState.duration || 0),
            passRate: testState.totalTests > 0 ? Math.round((testState.passedTests / testState.totalTests) * 100) : 0,
            categoryCounts: Object.keys(testState.testsByCategory).reduce((acc, category) => {
                acc[category] = testState.testsByCategory[category].length;
                return acc;
            }, {})
        };
    }
}

// Export for use in other modules
window.TestStateManager = TestStateManager;
