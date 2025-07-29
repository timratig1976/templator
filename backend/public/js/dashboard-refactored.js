/**
 * Main Dashboard Controller - Orchestrates all services and components
 * Lightweight controller that coordinates API, polling, state management, and UI rendering
 */
class DashboardController {
    constructor() {
        // Initialize services
        this.apiService = new TestApiService();
        this.stateManager = new TestStateManager();
        this.pollingService = new TestPollingService(this.apiService);
        
        // Initialize renderers
        this.progressRenderer = new TestProgressRenderer(this.stateManager);
        this.resultsRenderer = new TestResultsRenderer(this.stateManager);
        this.feedbackRenderer = new FeedbackRenderer();
        
        // Initialize feedback renderer
        this.feedbackRenderer.init('test-results');
        
        // Setup polling callbacks
        this.setupPollingCallbacks();
        
        // Initialize dashboard
        this.initialize();
    }

    /**
     * Setup polling event callbacks
     */
    setupPollingCallbacks() {
        this.pollingService
            .onStatusUpdate((testStatus) => {
                const processedState = this.stateManager.processTestStatus(testStatus);
                this.renderTestStatus(processedState);
            })
            .onComplete((testStatus) => {
                const processedState = this.stateManager.processTestStatus(testStatus);
                this.stateManager.addToHistory(processedState);
                this.renderTestCompletion(processedState);
            })
            .onError((errorMessage) => {
                this.feedbackRenderer.showPollingStatus(errorMessage, true);
            });
    }

    /**
     * Initialize dashboard on page load
     */
    async initialize() {
        this.feedbackRenderer.showLoading('Checking server connection...');
        
        const isConnected = await this.apiService.checkConnection();
        this.feedbackRenderer.showConnectionStatus(isConnected);
        
        // Check for existing test execution
        if (isConnected) {
            await this.pollingService.checkAndStopUnnecessaryPolling();
        }
    }

    /**
     * Start test execution
     */
    async runTests() {
        try {
            // Stop any existing polling
            this.pollingService.stopPolling();
            this.stateManager.clearState();
            
            // Check server connection first
            this.feedbackRenderer.showLoading('Checking server connection...');
            
            const isConnected = await this.apiService.checkConnection();
            if (!isConnected) {
                this.feedbackRenderer.showError(
                    'Server is not reachable. Please check if the backend is running.',
                    () => location.reload()
                );
                return;
            }
            
            // Start test execution
            this.feedbackRenderer.showLoading('Starting fresh test execution...');
            
            const result = await this.apiService.startTestExecution();
            
            if (result.success && result.executionId) {
                this.feedbackRenderer.showTestStarted(result.executionId);
                this.pollingService.startPolling();
            } else {
                this.feedbackRenderer.showError(
                    `Failed to start test execution. ${result.error || 'Unknown error'}`,
                    () => this.runTests()
                );
            }
            
        } catch (error) {
            console.error('Error starting tests:', error);
            this.feedbackRenderer.showError(
                `Error starting tests: ${error.message}`,
                () => this.runTests()
            );
        }
    }

    /**
     * Check current test status
     */
    async checkTestStatus() {
        try {
            this.feedbackRenderer.showLoading('Checking test status...');
            
            const result = await this.apiService.getTestStatus();
            
            if (result.success && result.testStatus) {
                const processedState = this.stateManager.processTestStatus(result.testStatus);
                
                if (processedState.status === 'running') {
                    this.renderTestStatus(processedState);
                    // Start polling if not already active
                    if (!this.pollingService.getState().isPolling) {
                        this.pollingService.startPolling();
                    }
                } else if (processedState.status === 'completed') {
                    this.renderTestCompletion(processedState);
                } else {
                    this.feedbackRenderer.showLiveFeedback(
                        `Test status: ${processedState.status}<br>` +
                        `Started: ${processedState.startTime ? processedState.startTime.toLocaleString() : 'Unknown'}`,
                        'info'
                    );
                }
            } else {
                this.feedbackRenderer.showLiveFeedback('No test execution found', 'info');
            }
            
        } catch (error) {
            console.error('Error checking test status:', error);
            this.feedbackRenderer.showError(`Error checking test status: ${error.message}`);
        }
    }

    /**
     * View latest test results
     */
    async viewLatestResults() {
        try {
            this.feedbackRenderer.showLoading('Loading test results...');
            
            const result = await this.apiService.getTestResults();
            
            if (result.success && result.testResults) {
                const history = this.stateManager.getHistory();
                const historyHtml = this.resultsRenderer.renderTestHistory(history);
                
                const resultsHtml = `
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #495057;">📋 Latest Test Results</h3>
                        <div style="padding: 15px; background: #f8f9fa; border-radius: 6px;">
                            Tests: ${result.testResults.totalTests || 0}, 
                            Passed: ${result.testResults.passedTests || 0}, 
                            Failed: ${result.testResults.failedTests || 0}<br>
                            <small>Executed: ${result.testResults.timestamp ? new Date(result.testResults.timestamp).toLocaleString() : 'Unknown'}</small>
                        </div>
                    </div>
                    ${historyHtml}
                `;
                
                this.feedbackRenderer.showCustom(resultsHtml);
            } else {
                this.feedbackRenderer.showLiveFeedback('No test results found', 'info');
            }
            
        } catch (error) {
            console.error('Error loading test results:', error);
            this.feedbackRenderer.showError(`Error loading test results: ${error.message}`);
        }
    }

    /**
     * Render running test status
     */
    renderTestStatus(testState) {
        if (!testState) return;
        
        const progressHtml = this.progressRenderer.renderRunningTestDisplay(testState);
        const resultsHtml = this.resultsRenderer.renderTestResultsBreakdown(testState);
        const statusHtml = testState.testsByStatus ? 
            this.resultsRenderer.renderTestsByStatus(testState.testsByStatus) : '';
        
        const combinedHtml = `
            ${progressHtml}
            ${statusHtml}
            ${resultsHtml}
            <div style="margin-top: 20px; padding: 10px; background: #e3f2fd; border-radius: 4px; font-size: 0.9em; color: #0d6efd;">
                🔄 Intelligent polling with exponential backoff...
            </div>
        `;
        
        this.feedbackRenderer.showCustom(combinedHtml);
    }

    /**
     * Render test completion
     */
    renderTestCompletion(testState) {
        if (!testState) return;
        
        const completionHtml = this.progressRenderer.renderCompletionSummary(testState);
        const resultsHtml = this.resultsRenderer.renderTestResultsBreakdown(testState);
        
        const combinedHtml = `
            ${completionHtml}
            ${resultsHtml}
        `;
        
        this.feedbackRenderer.showCustom(combinedHtml);
        this.feedbackRenderer.showToast('Tests completed!', 'success');
    }

    /**
     * Get current dashboard state
     */
    getState() {
        return {
            testState: this.stateManager.getCurrentState(),
            pollingState: this.pollingService.getState(),
            history: this.stateManager.getHistory()
        };
    }

    /**
     * Stop all activities and cleanup
     */
    cleanup() {
        this.pollingService.stopPolling();
        this.stateManager.clearState();
        this.feedbackRenderer.clear();
    }
}

// Global functions for button callbacks (maintain compatibility)
let dashboardController;

async function runTests() {
    if (dashboardController) {
        await dashboardController.runTests();
    }
}

async function checkTestStatus() {
    if (dashboardController) {
        await dashboardController.checkTestStatus();
    }
}

async function viewLatestResults() {
    if (dashboardController) {
        await dashboardController.viewLatestResults();
    }
}

// Initialize dashboard when page loads
window.addEventListener('load', function() {
    console.log('🚀 Initializing refactored dashboard...');
    dashboardController = new DashboardController();
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (dashboardController) {
        dashboardController.cleanup();
    }
});

// Export for debugging
window.DashboardController = DashboardController;
window.dashboardController = dashboardController;
