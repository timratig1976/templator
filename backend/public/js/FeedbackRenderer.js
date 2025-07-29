/**
 * FeedbackRenderer - Handles rendering of status messages and user feedback
 * Generates status displays, error messages, and interactive feedback
 */
class FeedbackRenderer {
    constructor() {
        this.feedbackElement = null;
    }

    /**
     * Initialize with target element
     */
    init(elementId = 'test-results') {
        this.feedbackElement = document.getElementById(elementId);
        if (!this.feedbackElement) {
            console.error(`Feedback element with ID '${elementId}' not found`);
        }
        return this;
    }

    /**
     * Show live feedback with status styling
     */
    showLiveFeedback(message, status = 'info') {
        if (!this.feedbackElement) return;

        const config = this.getStatusConfig(status);
        
        this.feedbackElement.innerHTML = `
            <div style="padding: 20px; background: ${config.background}; border-left: 4px solid ${config.color}; border-radius: 0 8px 8px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 1.5em; margin-right: 10px;">${config.icon}</span>
                    <strong style="color: ${config.color};">${config.title}</strong>
                </div>
                <div style="color: ${config.textColor};">${message}</div>
            </div>
        `;
    }

    /**
     * Show error message with retry button
     */
    showError(message, retryCallback = null) {
        const retryButton = retryCallback ? `
            <button onclick="${retryCallback.name}()" 
                    style="margin-top: 10px; padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Retry
            </button>
        ` : '';

        this.showLiveFeedback(message + retryButton, 'error');
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        this.showLiveFeedback(message, 'success');
    }

    /**
     * Show loading state
     */
    showLoading(message = 'Loading...') {
        this.showLiveFeedback(message, 'loading');
    }

    /**
     * Show connection status
     */
    showConnectionStatus(isConnected, retryCallback = null) {
        if (isConnected) {
            this.showLiveFeedback(`
                <h4 style="color: #28a745; margin-bottom: 10px;">✅ Server Connected</h4>
                <p>👆 Click a button above to view test information</p>
                <ul style="text-align: left; margin-top: 15px;">
                    <li><strong>Run Full Test Suite</strong> - Start new test execution</li>
                    <li><strong>Check Test Status</strong> - View current/latest test status</li>
                    <li><strong>View Latest Results</strong> - See all test execution history</li>
                </ul>
            `, 'success');
        } else {
            const retryButton = retryCallback ? `
                <button onclick="location.reload()" 
                        style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Retry Connection
                </button>
            ` : '';

            this.showLiveFeedback(
                'Server connection failed. The backend may not be running.' + retryButton,
                'error'
            );
        }
    }

    /**
     * Show test execution started message
     */
    showTestStarted(executionId) {
        this.showLiveFeedback(
            `Test suite started! ID: ${executionId}<br>Monitoring progress...`,
            'running'
        );
    }

    /**
     * Show polling status
     */
    showPollingStatus(message, isError = false) {
        const status = isError ? 'warning' : 'info';
        this.showLiveFeedback(`🔄 ${message}`, status);
    }

    /**
     * Get status configuration for styling
     */
    getStatusConfig(status) {
        const configs = {
            success: {
                icon: '✅',
                title: 'Success',
                color: '#28a745',
                background: '#d4edda',
                textColor: '#155724'
            },
            error: {
                icon: '❌',
                title: 'Error',
                color: '#dc3545',
                background: '#f8d7da',
                textColor: '#721c24'
            },
            warning: {
                icon: '⚠️',
                title: 'Warning',
                color: '#ffc107',
                background: '#fff3cd',
                textColor: '#856404'
            },
            info: {
                icon: 'ℹ️',
                title: 'Information',
                color: '#007bff',
                background: '#d1ecf1',
                textColor: '#0c5460'
            },
            running: {
                icon: '🔄',
                title: 'Running',
                color: '#007bff',
                background: '#e3f2fd',
                textColor: '#0d6efd'
            },
            loading: {
                icon: '🔄',
                title: 'Loading',
                color: '#6c757d',
                background: '#f8f9fa',
                textColor: '#495057'
            },
            completed: {
                icon: '✅',
                title: 'Completed',
                color: '#28a745',
                background: '#d4edda',
                textColor: '#155724'
            }
        };

        return configs[status] || configs.info;
    }

    /**
     * Clear feedback display
     */
    clear() {
        if (this.feedbackElement) {
            this.feedbackElement.innerHTML = '';
        }
    }

    /**
     * Show custom HTML content
     */
    showCustom(htmlContent) {
        if (this.feedbackElement) {
            this.feedbackElement.innerHTML = htmlContent;
        }
    }

    /**
     * Append content to existing display
     */
    append(htmlContent) {
        if (this.feedbackElement) {
            this.feedbackElement.innerHTML += htmlContent;
        }
    }

    /**
     * Show notification toast (if supported)
     */
    showToast(message, status = 'info', duration = 3000) {
        // Create toast element
        const toast = document.createElement('div');
        const config = this.getStatusConfig(status);
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${config.background};
            border-left: 4px solid ${config.color};
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
        `;
        
        toast.innerHTML = `
            <div style="display: flex; align-items: center;">
                <span style="margin-right: 8px;">${config.icon}</span>
                <span style="color: ${config.textColor};">${message}</span>
            </div>
        `;

        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(toast);

        // Auto remove after duration
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 300);
        }, duration);
    }
}

// Export for use in other modules
window.FeedbackRenderer = FeedbackRenderer;
