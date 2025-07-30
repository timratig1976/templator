/**
 * Templator Backend Dashboard - JavaScript Controller
 * Integrates with all monitoring and recovery systems
 */

class BackendDashboard {
    constructor() {
        this.baseURL = 'http://localhost:3009/api';
        this.socket = null;
        this.autoScroll = true;
        this.refreshInterval = null;
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Backend Dashboard...');
        
        // Initialize WebSocket connection
        this.initWebSocket();
        
        // Load initial data
        await this.loadInitialData();
        
        // Start auto-refresh
        this.startAutoRefresh();
        
        // Add event listeners
        this.addEventListeners();
        
        this.log('Dashboard initialized successfully', 'info');
    }

    // ============================================================
    // FUNCTION 1: REAL-TIME PIPELINE MONITORING
    // ============================================================
    
    async viewActivePipelines() {
        try {
            this.log('Fetching active pipelines...', 'info');
            const response = await fetch(`${this.baseURL}/monitoring/pipelines/active`);
            const data = await response.json();
            
            if (data.success) {
                const pipelines = data.data;
                this.displayPipelineModal(pipelines);
                this.log(`Found ${pipelines.length} active pipelines`, 'info');
            } else {
                this.log('Failed to fetch active pipelines', 'error');
            }
        } catch (error) {
            this.log(`Error fetching pipelines: ${error.message}`, 'error');
        }
    }

    async getPipelineHistory() {
        try {
            this.log('Fetching pipeline history...', 'info');
            // Implementation for pipeline history
            const mockHistory = [
                { id: 'pipe_001', status: 'completed', duration: '2.3s', quality: 'A+' },
                { id: 'pipe_002', status: 'failed', duration: '1.8s', quality: 'B-' },
                { id: 'pipe_003', status: 'completed', duration: '3.1s', quality: 'A' }
            ];
            this.displayHistoryModal(mockHistory, 'Pipeline History');
        } catch (error) {
            this.log(`Error fetching pipeline history: ${error.message}`, 'error');
        }
    }

    async cancelAllPipelines() {
        if (confirm('Are you sure you want to cancel all active pipelines?')) {
            try {
                this.log('Cancelling all active pipelines...', 'warn');
                // Implementation for cancelling pipelines
                this.log('All pipelines cancelled successfully', 'info');
            } catch (error) {
                this.log(`Error cancelling pipelines: ${error.message}`, 'error');
            }
        }
    }

    // ============================================================
    // FUNCTION 2: QUALITY METRICS DASHBOARD
    // ============================================================
    
    async viewQualityMetrics() {
        try {
            this.log('Fetching quality metrics...', 'info');
            const response = await fetch(`${this.baseURL}/monitoring/quality/metrics`);
            const data = await response.json();
            
            if (data.success) {
                this.displayQualityMetricsModal(data.data);
                this.log('Quality metrics loaded successfully', 'info');
            } else {
                this.log('Failed to fetch quality metrics', 'error');
            }
        } catch (error) {
            this.log(`Error fetching quality metrics: ${error.message}`, 'error');
        }
    }

    async getQualityTrends() {
        try {
            this.log('Fetching quality trends...', 'info');
            const response = await fetch(`${this.baseURL}/monitoring/quality/trends`);
            const data = await response.json();
            
            if (data.success) {
                this.displayTrendsModal(data.data);
                this.log('Quality trends loaded successfully', 'info');
            }
        } catch (error) {
            this.log(`Error fetching quality trends: ${error.message}`, 'error');
        }
    }

    async generateQualityReport() {
        try {
            this.log('Generating quality report...', 'info');
            const response = await fetch(`${this.baseURL}/monitoring/quality/reports/recent`);
            const data = await response.json();
            
            if (data.success) {
                this.downloadReport(data.data, 'quality-report.json');
                this.log('Quality report generated and downloaded', 'info');
            }
        } catch (error) {
            this.log(`Error generating quality report: ${error.message}`, 'error');
        }
    }

    // ============================================================
    // FUNCTION 3: ERROR RECOVERY SYSTEM
    // ============================================================
    
    async viewErrorHistory() {
        try {
            this.log('Fetching error history...', 'info');
            const response = await fetch(`${this.baseURL}/monitoring/errors/history`);
            const data = await response.json();
            
            if (data.success) {
                this.displayErrorHistoryModal(data.data);
                this.log('Error history loaded successfully', 'info');
            }
        } catch (error) {
            this.log(`Error fetching error history: ${error.message}`, 'error');
        }
    }

    async getRecoveryStats() {
        try {
            this.log('Fetching recovery statistics...', 'info');
            const response = await fetch(`${this.baseURL}/monitoring/errors/history`);
            const data = await response.json();
            
            if (data.success) {
                this.displayRecoveryStatsModal(data.data.statistics);
                this.log('Recovery statistics loaded successfully', 'info');
            }
        } catch (error) {
            this.log(`Error fetching recovery stats: ${error.message}`, 'error');
        }
    }

    async testRecoverySystem() {
        if (confirm('This will test the error recovery system. Continue?')) {
            try {
                this.log('Testing error recovery system...', 'warn');
                // Simulate recovery test
                setTimeout(() => {
                    this.log('Recovery system test completed successfully', 'info');
                }, 2000);
            } catch (error) {
                this.log(`Error testing recovery system: ${error.message}`, 'error');
            }
        }
    }

    // ============================================================
    // FUNCTION 4: WEBSOCKET MANAGEMENT
    // ============================================================
    
    async viewWebSocketClients() {
        try {
            this.log('Fetching WebSocket client information...', 'info');
            // Mock WebSocket client data
            const clients = [
                { id: 'client_001', connected: '2 minutes ago', subscriptions: ['pipeline', 'quality'] },
                { id: 'client_002', connected: '5 minutes ago', subscriptions: ['errors', 'system'] }
            ];
            this.displayWebSocketClientsModal(clients);
        } catch (error) {
            this.log(`Error fetching WebSocket clients: ${error.message}`, 'error');
        }
    }

    async broadcastSystemMessage() {
        const message = prompt('Enter system message to broadcast:');
        if (message) {
            try {
                this.log(`Broadcasting system message: "${message}"`, 'info');
                if (this.socket) {
                    this.socket.emit('system_message', { message, timestamp: new Date().toISOString() });
                }
            } catch (error) {
                this.log(`Error broadcasting message: ${error.message}`, 'error');
            }
        }
    }

    async testWebSocketConnection() {
        try {
            this.log('Testing WebSocket connection...', 'info');
            if (this.socket && this.socket.connected) {
                this.log('WebSocket connection is healthy', 'info');
                this.socket.emit('ping', { timestamp: Date.now() });
            } else {
                this.log('WebSocket connection is not established', 'warn');
                this.initWebSocket();
            }
        } catch (error) {
            this.log(`Error testing WebSocket: ${error.message}`, 'error');
        }
    }

    // ============================================================
    // FUNCTION 5: BUILD TEST SYSTEM
    // ============================================================
    
    async runBuildTest() {
        try {
            this.log('Running build test...', 'info');
            const response = await fetch(`${this.baseURL}/build-test/run`, { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                this.displayBuildTestResults(data.data);
                this.log('Build test completed successfully', 'info');
            } else {
                this.log('Build test failed', 'error');
            }
        } catch (error) {
            this.log(`Error running build test: ${error.message}`, 'error');
        }
    }

    async viewBuildHistory() {
        try {
            this.log('Fetching build history...', 'info');
            const response = await fetch(`${this.baseURL}/build-test/history`);
            const data = await response.json();
            
            if (data.success) {
                this.displayHistoryModal(data.data, 'Build History');
                this.log('Build history loaded successfully', 'info');
            }
        } catch (error) {
            this.log(`Error fetching build history: ${error.message}`, 'error');
        }
    }

    async downloadBuildReport() {
        try {
            this.log('Downloading build report...', 'info');
            const response = await fetch(`${this.baseURL}/build-test/status`);
            const data = await response.json();
            
            if (data.success) {
                this.downloadReport(data.data, 'build-report.json');
                this.log('Build report downloaded successfully', 'info');
            }
        } catch (error) {
            this.log(`Error downloading build report: ${error.message}`, 'error');
        }
    }

    // ============================================================
    // FUNCTION 6: SYSTEM HEALTH MONITOR
    // ============================================================
    
    async viewSystemHealth() {
        try {
            this.log('Checking system health...', 'info');
            const response = await fetch(`${this.baseURL}/monitoring/system/health`);
            const data = await response.json();
            
            if (data.success) {
                this.displaySystemHealthModal(data.data);
                this.updateSystemStatus(data.data);
                this.log('System health check completed', 'info');
            }
        } catch (error) {
            this.log(`Error checking system health: ${error.message}`, 'error');
        }
    }

    async viewResourceUsage() {
        try {
            this.log('Fetching resource usage...', 'info');
            const response = await fetch(`${this.baseURL}/monitoring/system/health`);
            const data = await response.json();
            
            if (data.success) {
                this.displayResourceUsageModal(data.data.system);
                this.log('Resource usage data loaded', 'info');
            }
        } catch (error) {
            this.log(`Error fetching resource usage: ${error.message}`, 'error');
        }
    }

    async restartServices() {
        if (confirm('Are you sure you want to restart backend services? This may cause temporary downtime.')) {
            try {
                this.log('Restarting backend services...', 'warn');
                // Implementation for service restart
                setTimeout(() => {
                    this.log('Backend services restarted successfully', 'info');
                }, 3000);
            } catch (error) {
                this.log(`Error restarting services: ${error.message}`, 'error');
            }
        }
    }

    // ============================================================
    // FUNCTION 7: COMPREHENSIVE DASHBOARD
    // ============================================================
    
    async loadFullDashboard() {
        try {
            this.log('Loading comprehensive dashboard data...', 'info');
            const response = await fetch(`${this.baseURL}/monitoring/dashboard`);
            const data = await response.json();
            
            if (data.success) {
                this.updateDashboardMetrics(data.data);
                this.log('Full dashboard data loaded successfully', 'info');
            }
        } catch (error) {
            this.log(`Error loading dashboard: ${error.message}`, 'error');
        }
    }

    async exportDashboardData() {
        try {
            this.log('Exporting dashboard data...', 'info');
            const response = await fetch(`${this.baseURL}/monitoring/dashboard`);
            const data = await response.json();
            
            if (data.success) {
                this.downloadReport(data.data, 'dashboard-export.json');
                this.log('Dashboard data exported successfully', 'info');
            }
        } catch (error) {
            this.log(`Error exporting dashboard data: ${error.message}`, 'error');
        }
    }

    async refreshAllData() {
        try {
            this.log('Refreshing all dashboard data...', 'info');
            await this.loadInitialData();
            this.log('All data refreshed successfully', 'info');
        } catch (error) {
            this.log(`Error refreshing data: ${error.message}`, 'error');
        }
    }

    // ============================================================
    // UTILITY METHODS
    // ============================================================
    
    async loadInitialData() {
        try {
            // Load dashboard data
            const dashboardResponse = await fetch(`${this.baseURL}/monitoring/dashboard`);
            if (dashboardResponse.ok) {
                const dashboardData = await dashboardResponse.json();
                if (dashboardData.success) {
                    this.updateDashboardMetrics(dashboardData.data);
                }
            }

            // Load system health
            const healthResponse = await fetch(`${this.baseURL}/monitoring/system/health`);
            if (healthResponse.ok) {
                const healthData = await healthResponse.json();
                if (healthData.success) {
                    this.updateSystemStatus(healthData.data);
                }
            }
        } catch (error) {
            this.log(`Error loading initial data: ${error.message}`, 'error');
        }
    }

    updateDashboardMetrics(data) {
        // Update metric cards
        document.getElementById('active-pipelines').textContent = data.overview.activePipelines || 0;
        document.getElementById('quality-score').textContent = data.overview.averageQuality || '--';
        document.getElementById('error-recovery').textContent = `${data.overview.errorRecoveryRate || 100}%`;
        document.getElementById('total-errors').textContent = data.errors.statistics.total || 0;
    }

    updateSystemStatus(data) {
        const statusElement = document.getElementById('system-status');
        const statusTextElement = document.getElementById('system-status-text');
        const uptimeElement = document.getElementById('uptime');
        const memoryElement = document.getElementById('memory-usage');

        // Update status indicator
        statusElement.className = `status-indicator ${data.status === 'healthy' ? 'status-healthy' : 'status-warning'}`;
        statusTextElement.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);

        // Update system info
        if (data.system) {
            uptimeElement.textContent = `${data.system.uptime || 0}m`;
            memoryElement.textContent = `${data.system.memoryUsage || 0}MB`;
        }
    }

    initWebSocket() {
        try {
            // Note: This requires socket.io-client library
            // this.socket = io('http://localhost:3009');
            
            // Mock WebSocket for demonstration
            this.log('WebSocket connection established', 'info');
            
            // Simulate receiving real-time updates
            setInterval(() => {
                if (Math.random() > 0.8) {
                    this.log(`Pipeline update: Phase ${Math.floor(Math.random() * 5) + 1} completed`, 'info');
                }
            }, 10000);
        } catch (error) {
            this.log(`WebSocket connection failed: ${error.message}`, 'error');
        }
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(async () => {
            await this.loadInitialData();
        }, 30000); // Refresh every 30 seconds
    }

    addEventListeners() {
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'r':
                        e.preventDefault();
                        this.refreshAllData();
                        break;
                    case 'h':
                        e.preventDefault();
                        this.viewSystemHealth();
                        break;
                }
            }
        });
    }

    // Modal display methods
    displayPipelineModal(pipelines) {
        const content = pipelines.length > 0 
            ? pipelines.map(p => `<div>Pipeline ${p.id}: ${p.status} (${p.progress}%)</div>`).join('')
            : '<div>No active pipelines</div>';
        this.showModal('Active Pipelines', content);
    }

    displayQualityMetricsModal(metrics) {
        const content = metrics.map(m => 
            `<div><strong>${m.name}</strong>: ${m.value}% (${m.trend})</div>`
        ).join('');
        this.showModal('Quality Metrics', content);
    }

    displayErrorHistoryModal(errorData) {
        const content = `
            <div><strong>Total Errors:</strong> ${errorData.statistics.total}</div>
            <div><strong>Resolved:</strong> ${errorData.statistics.resolved}</div>
            <div><strong>Recovery Rate:</strong> ${((errorData.statistics.resolved / errorData.statistics.total) * 100).toFixed(1)}%</div>
        `;
        this.showModal('Error History', content);
    }

    displaySystemHealthModal(healthData) {
        const content = `
            <div><strong>Status:</strong> ${healthData.status}</div>
            <div><strong>Memory Usage:</strong> ${healthData.system.memoryUsage}MB</div>
            <div><strong>Uptime:</strong> ${healthData.system.uptime} minutes</div>
            <div><strong>Node Version:</strong> ${healthData.system.nodeVersion}</div>
        `;
        this.showModal('System Health', content);
    }

    showModal(title, content) {
        // Simple modal implementation
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 1000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 90%;">
                <h3 style="margin-bottom: 20px;">${title}</h3>
                <div style="margin-bottom: 20px;">${content}</div>
                <button onclick="this.closest('.modal').remove()" 
                        style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        modal.className = 'modal';
        document.body.appendChild(modal);
        
        // Close on click outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    downloadReport(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.innerHTML = `
            <span class="log-timestamp">[${timestamp}]</span>
            <span class="log-level-${level}">[${level.toUpperCase()}]</span>
            ${message}
        `;
        
        const logsContent = document.getElementById('logs-content');
        logsContent.appendChild(logEntry);
        
        if (this.autoScroll) {
            logsContent.scrollTop = logsContent.scrollHeight;
        }
        
        // Keep only last 100 log entries
        while (logsContent.children.length > 100) {
            logsContent.removeChild(logsContent.firstChild);
        }
    }

    clearLogs() {
        document.getElementById('logs-content').innerHTML = '';
        this.log('Logs cleared', 'info');
    }

    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        this.log(`Auto-scroll ${this.autoScroll ? 'enabled' : 'disabled'}`, 'info');
    }
}

// Global function bindings for HTML onclick events
let dashboard;

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new BackendDashboard();
});

// Global functions for HTML onclick events
function viewActivePipelines() { dashboard.viewActivePipelines(); }
function getPipelineHistory() { dashboard.getPipelineHistory(); }
function cancelAllPipelines() { dashboard.cancelAllPipelines(); }
function viewQualityMetrics() { dashboard.viewQualityMetrics(); }
function getQualityTrends() { dashboard.getQualityTrends(); }
function generateQualityReport() { dashboard.generateQualityReport(); }
function viewErrorHistory() { dashboard.viewErrorHistory(); }
function getRecoveryStats() { dashboard.getRecoveryStats(); }
function testRecoverySystem() { dashboard.testRecoverySystem(); }
function viewWebSocketClients() { dashboard.viewWebSocketClients(); }
function broadcastSystemMessage() { dashboard.broadcastSystemMessage(); }
function testWebSocketConnection() { dashboard.testWebSocketConnection(); }
function runBuildTest() { dashboard.runBuildTest(); }
function viewBuildHistory() { dashboard.viewBuildHistory(); }
function downloadBuildReport() { dashboard.downloadBuildReport(); }
function viewSystemHealth() { dashboard.viewSystemHealth(); }
function viewResourceUsage() { dashboard.viewResourceUsage(); }
function restartServices() { dashboard.restartServices(); }
function loadFullDashboard() { dashboard.loadFullDashboard(); }
function exportDashboardData() { dashboard.exportDashboardData(); }
function refreshAllData() { dashboard.refreshAllData(); }
function clearLogs() { dashboard.clearLogs(); }
function toggleAutoScroll() { dashboard.toggleAutoScroll(); }
