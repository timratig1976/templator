/**
 * TestPollingService - Handles intelligent polling with circuit breaker and retry logic
 * Manages polling state, error recovery, and adaptive delays
 */
class TestPollingService {
    constructor(apiService) {
        this.apiService = apiService;
        this.pollInterval = null;
        this.callbacks = {
            onStatusUpdate: null,
            onError: null,
            onComplete: null
        };
        
        // Polling state with resilience features
        this.state = {
            retries: 0,
            maxRetries: 10,
            baseDelay: 2000,
            maxDelay: 30000,
            backoffMultiplier: 1.5,
            circuitBreakerFailures: 0,
            circuitBreakerThreshold: 5,
            isCircuitOpen: false,
            lastSuccessTime: Date.now(),
            isPolling: false
        };
        
        this.setupVisibilityHandling();
    }

    /**
     * Register callbacks for polling events
     */
    onStatusUpdate(callback) {
        this.callbacks.onStatusUpdate = callback;
        return this;
    }

    onError(callback) {
        this.callbacks.onError = callback;
        return this;
    }

    onComplete(callback) {
        this.callbacks.onComplete = callback;
        return this;
    }

    /**
     * Start polling for test status
     */
    startPolling() {
        if (this.state.isPolling) {
            console.log('Polling already active');
            return;
        }
        
        console.log('🔄 Starting test status polling');
        this.state.isPolling = true;
        this.resetPollingState();
        this.scheduleNextPoll();
    }

    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollInterval) {
            clearTimeout(this.pollInterval);
            this.pollInterval = null;
        }
        this.state.isPolling = false;
        this.resetPollingState();
        console.log('⏹️ Polling stopped');
    }

    /**
     * Reset polling state to initial values
     */
    resetPollingState() {
        this.state.retries = 0;
        this.state.circuitBreakerFailures = 0;
        this.state.isCircuitOpen = false;
        this.state.lastSuccessTime = Date.now();
    }

    /**
     * Calculate adaptive delay based on current state
     */
    calculateDelay() {
        const baseDelay = this.state.baseDelay;
        const retryMultiplier = Math.pow(this.state.backoffMultiplier, this.state.retries);
        const calculatedDelay = Math.min(baseDelay * retryMultiplier, this.state.maxDelay);
        
        // Add some jitter to prevent thundering herd
        const jitter = Math.random() * 1000;
        return Math.floor(calculatedDelay + jitter);
    }

    /**
     * Schedule the next poll with adaptive delay
     */
    scheduleNextPoll() {
        if (!this.state.isPolling) return;
        
        const delay = this.calculateDelay();
        console.log(`⏰ Scheduling next poll in ${delay}ms (retry: ${this.state.retries})`);
        
        this.pollInterval = setTimeout(() => {
            this.pollTestStatus();
        }, delay);
    }

    /**
     * Main polling function with circuit breaker logic
     */
    async pollTestStatus() {
        // Circuit breaker check
        if (this.state.isCircuitOpen) {
            const timeSinceLastSuccess = Date.now() - this.state.lastSuccessTime;
            if (timeSinceLastSuccess < 60000) { // 1 minute circuit breaker timeout
                const remainingTime = Math.ceil((60000 - timeSinceLastSuccess) / 1000);
                this.handleError(`Connection circuit breaker active. Retrying in ${remainingTime}s...`);
                this.scheduleNextPoll();
                return;
            } else {
                // Reset circuit breaker after timeout
                this.state.isCircuitOpen = false;
                this.state.circuitBreakerFailures = 0;
                console.log('🔄 Circuit breaker reset');
            }
        }

        try {
            const result = await this.apiService.getTestStatus();
            
            if (!result.success) {
                throw new Error(result.error);
            }

            // Success - reset all error counters
            this.state.retries = 0;
            this.state.circuitBreakerFailures = 0;
            this.state.isCircuitOpen = false;
            this.state.lastSuccessTime = Date.now();

            console.log('📊 Polling response received:', {
                hasTestStatus: !!result.testStatus,
                status: result.testStatus?.status
            });

            // Handle the response
            if (result.testStatus) {
                if (result.testStatus.status === 'completed') {
                    // Test completed - stop polling and notify
                    this.stopPolling();
                    if (this.callbacks.onComplete) {
                        this.callbacks.onComplete(result.testStatus);
                    }
                    return;
                } else {
                    // Test still running - update status
                    if (this.callbacks.onStatusUpdate) {
                        this.callbacks.onStatusUpdate(result.testStatus);
                    }
                }
            } else {
                // No test status - stop polling
                this.stopPolling();
                if (this.callbacks.onError) {
                    this.callbacks.onError('No test execution found');
                }
                return;
            }

            // Schedule next poll on success
            this.scheduleNextPoll();

        } catch (error) {
            console.error('Polling error:', error);
            this.handlePollingError(error);
        }
    }

    /**
     * Handle polling errors with exponential backoff and circuit breaker
     */
    handlePollingError(error) {
        this.state.retries++;
        this.state.circuitBreakerFailures++;

        console.error(`❌ Polling error (attempt ${this.state.retries}/${this.state.maxRetries}):`, error);

        // Check if circuit breaker should open
        if (this.state.circuitBreakerFailures >= this.state.circuitBreakerThreshold) {
            this.state.isCircuitOpen = true;
            console.warn('🚨 Circuit breaker opened due to repeated failures');
        }

        // Check if max retries exceeded
        if (this.state.retries >= this.state.maxRetries) {
            this.stopPolling();
            const errorMessage = `Max polling retries (${this.state.maxRetries}) exceeded. Stopping polling.`;
            console.error(errorMessage);
            
            if (this.callbacks.onError) {
                this.callbacks.onError(errorMessage);
            }
            return;
        }

        // Continue with exponential backoff
        const delay = this.calculateDelay();
        const errorMessage = `Polling failed (${this.state.retries}/${this.state.maxRetries}). Retrying in ${Math.round(delay/1000)}s...`;
        
        if (this.callbacks.onError) {
            this.callbacks.onError(errorMessage);
        }

        this.scheduleNextPoll();
    }

    /**
     * Handle browser visibility changes to optimize polling
     */
    setupVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state.isPolling) {
                // Tab is hidden, slow down polling
                console.log('📱 Tab hidden, slowing down polling');
                this.state.baseDelay = 10000; // 10 seconds when hidden
            } else if (!document.hidden && this.state.isPolling) {
                // Tab is visible again, resume normal polling
                console.log('📱 Tab visible, resuming normal polling');
                this.state.baseDelay = 2000; // Back to 2 seconds
            }
        });
    }

    /**
     * Check if polling should be active and stop if not needed
     */
    async checkAndStopUnnecessaryPolling() {
        try {
            const isActive = await this.apiService.isTestExecutionActive();
            
            if (!isActive && this.state.isPolling) {
                console.log('No active test execution, stopping polling');
                this.stopPolling();
            }
            
            return isActive;
        } catch (error) {
            console.log('Could not check test status, stopping polling as precaution');
            this.stopPolling();
            return false;
        }
    }

    /**
     * Get current polling state
     */
    getState() {
        return { ...this.state };
    }
}

// Export for use in other modules
window.TestPollingService = TestPollingService;
