/**
 * TestApiService - Handles all API communication for the test dashboard
 * Centralizes fetch calls, error handling, and response processing
 */
class TestApiService {
    constructor() {
        // Use relative URLs to work with proxy contexts
        this.baseUrl = '';
        this.defaultTimeout = 10000; // 10 seconds
    }

    /**
     * Generic fetch wrapper with timeout and error handling
     */
    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.defaultTimeout);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    ...options.headers
                },
                ...options
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Check server connection health
     */
    async checkConnection() {
        try {
            const response = await this.fetchWithTimeout('/health', { timeout: 5000 });
            return response.ok;
        } catch (error) {
            console.error('Connection check failed:', error);
            return false;
        }
    }

    /**
     * Start test execution
     */
    async startTestExecution() {
        try {
            const response = await this.fetchWithTimeout('/health?action=run-tests', {
                timeout: 15000
            });
            
            const data = await response.json();
            return {
                success: true,
                data: data,
                executionId: data.executionId || (data.testExecution && data.testExecution.id)
            };
        } catch (error) {
            return {
                success: false,
                error: this.formatError(error)
            };
        }
    }

    /**
     * Get current test status
     */
    async getTestStatus() {
        try {
            const response = await this.fetchWithTimeout('/health?action=test-status');
            const data = await response.json();
            
            return {
                success: true,
                data: data,
                testStatus: data.testStatus
            };
        } catch (error) {
            return {
                success: false,
                error: this.formatError(error)
            };
        }
    }

    /**
     * Get test results
     */
    async getTestResults() {
        try {
            const response = await this.fetchWithTimeout('/health?action=test-results');
            const data = await response.json();
            
            return {
                success: true,
                data: data,
                testResults: data.testResults
            };
        } catch (error) {
            return {
                success: false,
                error: this.formatError(error)
            };
        }
    }

    /**
     * Format error messages for consistent display
     */
    formatError(error) {
        if (error.name === 'AbortError') {
            return 'Request timeout - server took too long to respond';
        } else if (error.message.includes('Failed to fetch')) {
            return 'Cannot connect to server';
        } else {
            return `Error: ${error.message}`;
        }
    }

    /**
     * Check if test execution is active
     */
    async isTestExecutionActive() {
        const result = await this.getTestStatus();
        if (!result.success || !result.testStatus) {
            return false;
        }
        
        return result.testStatus.status === 'running';
    }
}

// Export for use in other modules
window.TestApiService = TestApiService;
