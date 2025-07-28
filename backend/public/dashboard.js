// Bulletproof Dashboard JavaScript - Separate file to avoid TypeScript issues
let pollInterval = null;

// Bulletproof polling system with multiple resilience layers
let pollingState = {
    retries: 0,
    maxRetries: 10,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 1.5,
    circuitBreakerFailures: 0,
    circuitBreakerThreshold: 5,
    isCircuitOpen: false,
    lastSuccessTime: Date.now()
};

// Connection health check
async function checkConnection() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('/health', {
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.error('Connection check failed:', error);
        return false;
    }
}

async function runTests() {
    try {
        // Stop any existing polling and reset polling state
        stopPolling();
        resetPollingState();
        
        // First check if server is reachable
        showLiveFeedback('Checking server connection...', 'running');
        
        const isConnected = await checkConnection();
        if (!isConnected) {
            showLiveFeedback(
                'Server is not reachable. Please check if the backend is running.<br>' +
                '<button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>', 
                'error'
            );
            return;
        }
        
        showLiveFeedback('Starting fresh test execution...', 'running');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch('/health?action=run-tests', {
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        
        const data = await response.json();
        
        if (data.testExecution && data.testExecution.id) {
            showLiveFeedback('Test suite started! ID: ' + data.testExecution.id + '<br>Monitoring progress...', 'running');
            // Start fresh polling cycle
            startPolling();
        } else {
            showLiveFeedback(
                'Failed to start test execution. Server response: ' + JSON.stringify(data, null, 2), 
                'error'
            );
        }
    } catch (error) {
        let errorMessage = 'Failed to start tests';
        if (error.name === 'AbortError') {
            errorMessage = 'Request timeout - server took too long to respond';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Cannot connect to server';
        } else {
            errorMessage = 'Error: ' + error.message;
        }
        
        showLiveFeedback(
            errorMessage + '<br>' +
            '<button onclick="runTests()" style="margin-top: 10px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>', 
            'error'
        );
    }
}

function showLiveFeedback(message, status) {
    const resultsDiv = document.getElementById('test-results');
    const color = status === 'running' ? '#ffc107' : status === 'completed' ? '#28a745' : '#dc3545';
    const icon = status === 'running' ? '🔄' : status === 'completed' ? '✅' : '❌';
    
    resultsDiv.innerHTML = 
        '<div style="padding: 20px; background: white; border-radius: 12px; border-left: 4px solid ' + color + ';">' +
            '<h4 style="color: ' + color + ';">' + icon + ' Live Test Execution</h4>' +
            '<div id="live-status" style="padding: 15px; background: #f8f9fa; border-radius: 8px;">' +
                '<div><strong>Status:</strong> ' + status.toUpperCase() + '</div>' +
                '<div>' + message + '</div>' +
                (status === 'running' ? '<div style="margin-top: 10px;">🔄 Intelligent polling with exponential backoff...</div>' : '') +
            '</div>' +
        '</div>';
}

function startPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        clearTimeout(pollInterval);
    }
    resetPollingState();
    scheduleNextPoll();
}

function resetPollingState() {
    pollingState.retries = 0;
    pollingState.circuitBreakerFailures = 0;
    pollingState.isCircuitOpen = false;
    pollingState.lastSuccessTime = Date.now();
}

function calculateDelay() {
    if (pollingState.retries === 0) return pollingState.baseDelay;
    
    // Exponential backoff with jitter
    let delay = pollingState.baseDelay * Math.pow(pollingState.backoffMultiplier, pollingState.retries - 1);
    delay = Math.min(delay, pollingState.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = delay * 0.1 * Math.random();
    return Math.floor(delay + jitter);
}

function scheduleNextPoll() {
    const delay = calculateDelay();
    pollInterval = setTimeout(pollTestStatus, delay);
}

async function pollTestStatus() {
    // Circuit breaker check
    if (pollingState.isCircuitOpen) {
        const timeSinceLastSuccess = Date.now() - pollingState.lastSuccessTime;
        if (timeSinceLastSuccess < 60000) { // 1 minute circuit breaker timeout
            showLiveFeedback('Connection circuit breaker active. Retrying in ' + Math.ceil((60000 - timeSinceLastSuccess) / 1000) + 's...', 'error');
            scheduleNextPoll();
            return;
        } else {
            // Reset circuit breaker after timeout
            pollingState.isCircuitOpen = false;
            pollingState.circuitBreakerFailures = 0;
        }
    }
    
    try {
        // Add timeout to fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('/health?action=test-status', {
            signal: controller.signal,
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        
        const data = await response.json();
        
        // Success - reset all error counters
        pollingState.retries = 0;
        pollingState.circuitBreakerFailures = 0;
        pollingState.isCircuitOpen = false;
        pollingState.lastSuccessTime = Date.now();
        
        console.log('📊 Polling response received:', {
            hasTestStatus: !!data.testStatus,
            testStatus: data.testStatus ? {
                id: data.testStatus.id,
                status: data.testStatus.status,
                totalTests: data.testStatus.totalTests,
                currentTest: data.testStatus.currentTest
            } : null
        });
        
        if (data.testStatus) {
            const status = data.testStatus;
            const progress = status.totalTests > 0 ? Math.round((status.passedTests + status.failedTests) / status.totalTests * 100) : 0;
            
            if (status.status === 'completed') {
                // Show detailed completion results
                let completedHtml = '<strong>✅ Tests Completed!</strong><br>';
                completedHtml += '<div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px;">';
                completedHtml += status.summary + '<br><br>';
                
                if (status.tests && status.tests.length > 0) {
                    // Categorize tests by type based on file path
                    const categorizeTest = (test) => {
                        if (test.file && test.file.includes('/__tests__/unit/')) return 'unit';
                        if (test.file && test.file.includes('/__tests__/e2e/')) return 'e2e';
                        if (test.file && test.file.includes('/tests/integration/')) return 'integration';
                        if (test.file && test.file.includes('/tests/performance/')) return 'performance';
                        if (test.file && test.file.includes('/tests/services/')) return 'services';
                        return 'other';
                    };
                    
                    const testsByCategory = {
                        unit: status.tests.filter(t => categorizeTest(t) === 'unit'),
                        e2e: status.tests.filter(t => categorizeTest(t) === 'e2e'),
                        integration: status.tests.filter(t => categorizeTest(t) === 'integration'),
                        performance: status.tests.filter(t => categorizeTest(t) === 'performance'),
                        services: status.tests.filter(t => categorizeTest(t) === 'services'),
                        other: status.tests.filter(t => categorizeTest(t) === 'other')
                    };
                    
                    // Summary stats at the top
                    const passCount = status.tests.filter(t => t.status === 'passed').length;
                    const failCount = status.tests.filter(t => t.status === 'failed').length;
                    const pendingCount = status.tests.filter(t => !['passed', 'failed'].includes(t.status)).length;
                    
                    completedHtml += `
                    <div style="display: flex; margin-bottom: 15px;">
                        <div style="flex: 1; text-align: center; background: #e8f5e9; padding: 10px; border-radius: 4px; margin-right: 5px;">
                            <span style="font-size: 1.5em;">✅</span><br>
                            <strong>${passCount}</strong> Passed
                        </div>
                        <div style="flex: 1; text-align: center; background: ${failCount > 0 ? '#ffebee' : '#f5f5f5'}; padding: 10px; border-radius: 4px; margin-left: 5px;">
                            <span style="font-size: 1.5em;">❌</span><br>
                            <strong>${failCount}</strong> Failed
                        </div>
                    </div>
                    
                    <!-- Test Categories Overview -->
                    <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;">
                        <h4 style="margin: 0 0 10px 0; color: #495057;">📊 Test Categories</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
                            ${testsByCategory.unit.length > 0 ? `
                            <div style="padding: 8px; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; text-align: center;">
                                <span style="font-size: 1.2em;">🟢</span> <strong>UNIT</strong><br>
                                <span style="font-size: 0.9em;">${testsByCategory.unit.length} tests</span>
                            </div>` : ''}
                            ${testsByCategory.e2e.length > 0 ? `
                            <div style="padding: 8px; background: #cce7ff; border: 1px solid #99d6ff; border-radius: 4px; text-align: center;">
                                <span style="font-size: 1.2em;">🔵</span> <strong>E2E</strong><br>
                                <span style="font-size: 0.9em;">${testsByCategory.e2e.length} tests</span>
                            </div>` : ''}
                            ${testsByCategory.integration.length > 0 ? `
                            <div style="padding: 8px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; text-align: center;">
                                <span style="font-size: 1.2em;">🟡</span> <strong>INTEGRATION</strong><br>
                                <span style="font-size: 0.9em;">${testsByCategory.integration.length} tests</span>
                            </div>` : ''}
                            ${testsByCategory.performance.length > 0 ? `
                            <div style="padding: 8px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; text-align: center;">
                                <span style="font-size: 1.2em;">🔴</span> <strong>PERFORMANCE</strong><br>
                                <span style="font-size: 0.9em;">${testsByCategory.performance.length} tests</span>
                            </div>` : ''}
                            ${testsByCategory.services.length > 0 ? `
                            <div style="padding: 8px; background: #e2e3e5; border: 1px solid #d6d8db; border-radius: 4px; text-align: center;">
                                <span style="font-size: 1.2em;">⚙️</span> <strong>SERVICES</strong><br>
                                <span style="font-size: 0.9em;">${testsByCategory.services.length} tests</span>
                            </div>` : ''}
                        </div>
                    </div>
                    `;
                    
                    completedHtml += '<strong>Test Results:</strong><br><div style="margin-top: 10px;">';
                    
                    // Group tests by status
                    const failedTests = status.tests.filter(t => t.status === 'failed');
                    const passedTests = status.tests.filter(t => t.status === 'passed');
                    
                    // Display failed tests first with expanded details
                    if (failedTests.length > 0) {
                        completedHtml += `<div style="margin-bottom: 10px; padding: 10px; border-left: 4px solid #dc3545; background: #ffebee; border-radius: 0 4px 4px 0;">`;
                        completedHtml += `<strong>Failed Tests (${failedTests.length})</strong><br>`;
                        
                        failedTests.forEach((test, index) => {
                            const testId = `failed-test-${index}`;
                            const duration = test.duration ? ` (${test.duration}ms)` : '';
                            
                            completedHtml += `
                            <div style="margin-top: 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="font-weight: bold;">❌ ${test.name}${duration}</div>
                                    ${test.subtests && test.subtests.length ? 
                                        `<button onclick="document.getElementById('${testId}').style.display = document.getElementById('${testId}').style.display === 'none' ? 'block' : 'none';" 
                                            style="background: none; border: none; cursor: pointer; font-size: 0.9em; color: #dc3545;">
                                            Details ▼
                                        </button>` : ''}
                                </div>
                                
                                ${test.error ? `
                                <div style="margin-left: 20px; margin-top: 5px; padding: 8px; border: 1px solid #f5c6cb; background: #fff; border-radius: 4px; font-family: monospace; font-size: 0.85em; white-space: pre-wrap; max-height: 200px; overflow-y: auto;">
                                    ${test.error.replace(/\n/g, '<br>').replace(/\s{2,}/g, ' &nbsp; ')}
                                </div>` : ''}
                                
                                ${test.subtests && test.subtests.length ? `
                                <div id="${testId}" style="margin-top: 8px; padding: 8px; background: #fff; border-radius: 4px; border: 1px solid #f8d7da;">
                                    <div style="font-weight: bold; margin-bottom: 5px; color: #721c24;">Detailed Test Results:</div>
                                    ${test.subtests.map(subtest => {
                                        const subtestIcon = subtest.status === 'passed' ? '✅' : subtest.status === 'failed' ? '❌' : '⏸️';
                                        const subtestClass = subtest.status === 'passed' ? 'text-success' : subtest.status === 'failed' ? 'text-danger' : 'text-muted';
                                        const subtestDuration = subtest.duration ? ` <span style="font-size: 0.8em; color: #666;">(${subtest.duration}ms)</span>` : '';
                                        
                                        return `<div style="margin: 5px 0;">
                                            <div style="display: flex; align-items: start;">
                                                <div style="color: ${subtest.status === 'passed' ? '#28a745' : subtest.status === 'failed' ? '#dc3545' : '#6c757d'};">${subtestIcon} ${subtest.name}${subtestDuration}</div>
                                            </div>
                                            ${subtest.error ? `
                                            <div style="margin-left: 25px; padding: 5px; background: #fff4f4; border-radius: 3px; font-size: 0.85em; font-family: monospace; white-space: pre-wrap;">
                                                ${subtest.error.replace(/\n/g, '<br>').replace(/\s{2,}/g, ' &nbsp; ')}
                                            </div>` : ''}
                                        </div>`;
                                    }).join('')}
                                </div>` : ''}
                            </div>
                            `;
                        });
                        completedHtml += '</div>';
                    }
                    
                    // Display passed tests with collapsible subtest details
                    if (passedTests.length > 0) {
                        completedHtml += `<div style="margin-bottom: 10px; padding: 10px; border-left: 4px solid #28a745; background: #f1f8e9; border-radius: 0 4px 4px 0;">`;
                        completedHtml += `<strong>Passed Tests (${passedTests.length})</strong><br>`;
                        
                        passedTests.forEach((test, index) => {
                            const testId = `passed-test-${index}`;
                            const duration = test.duration ? ` <span style="font-size: 0.8em; color: #666;">${test.duration}ms</span>` : '';
                            const hasSubtests = test.subtests && test.subtests.length > 0;
                            
                            completedHtml += `
                            <div style="margin-top: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>✅ <strong>${test.name}</strong>${duration}</div>
                                    ${hasSubtests ? 
                                        `<button onclick="document.getElementById('${testId}').style.display = document.getElementById('${testId}').style.display === 'none' ? 'block' : 'none';" 
                                            style="background: none; border: none; cursor: pointer; font-size: 0.9em; color: #28a745;">
                                            Details ▼
                                        </button>` : ''}
                                </div>
                            `;
                            
                            // Show subtests in a collapsible panel
                            if (hasSubtests) {
                                completedHtml += `
                                <div id="${testId}" style="margin-top: 8px; margin-left: 20px; padding: 8px; background: #fff; border-radius: 4px; border: 1px solid #c3e6cb; display: none;">
                                    <div style="font-weight: bold; margin-bottom: 5px; color: #155724;">Subtests:</div>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                    ${test.subtests.map(subtest => {
                                        const subtestDuration = subtest.duration ? ` <span style="font-size: 0.8em; color: #666;">(${subtest.duration}ms)</span>` : '';
                                        return `<div> ${subtest.name}${subtestDuration}</div>`;
                                    }).join('')}
                                    </div>
                                </div>
                                `;
                            }
                            
                            completedHtml += '</div>';
                        });
                        
                        completedHtml += '</div>';
                    }
                    
                    completedHtml += '</div>';
                }
                completedHtml += '</div>';
                
                showLiveFeedback(completedHtml, 'completed');
                stopPolling();
                return; // Don't schedule next poll
            } else {
                // Show running status with progress bar
                let runningHtml = '';
                
                runningHtml += '<div style="margin-bottom: 15px;">';
                runningHtml += '<strong>Progress: ' + progress + '%</strong>';
                runningHtml += '<div style="height: 20px; background: #e9ecef; border-radius: 4px; margin-top: 8px; overflow: hidden;">';
                runningHtml += '<div style="height: 100%; width: ' + progress + '%; background-color: #007bff; transition: width 0.3s ease;"></div>';
                runningHtml += '</div>';
                runningHtml += '</div>';
                
                runningHtml += '<div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">';
                runningHtml += '<span><strong>Total:</strong> ' + status.totalTests + '</span>';
                runningHtml += '<span><strong>Passed:</strong> <span style="color: #28a745; font-weight: bold;">' + status.passedTests + '</span></span>';
                runningHtml += '<span><strong>Failed:</strong> <span style="color: #dc3545; font-weight: bold;">' + status.failedTests + '</span></span>';
                runningHtml += '<span><strong>Pending:</strong> ' + (status.totalTests - status.passedTests - status.failedTests) + '</span>';
                runningHtml += '</div>';
                
                if (status.currentTestName) {
                    runningHtml += '<div style="padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 0 4px 4px 0; margin-bottom: 15px;">';
                    runningHtml += '<div style="font-weight: bold;">⚡ Currently Running: ' + status.currentTestName + '</div>';
                    
                    if (status.currentSubtest) {
                        runningHtml += '<div style="margin-left: 15px; margin-top: 5px; padding: 5px; background: rgba(255,255,255,0.5); border-radius: 4px;">🔍 Subtest: <span style="font-weight: bold;">' + status.currentSubtest + '</span></div>';
                    }
                    
                    runningHtml += '</div>';
                }
                
                // Show detailed info about all tests with expandable sections
                if (status.tests && status.tests.length > 0) {
                    runningHtml += '<div style="border: 1px solid #dee2e6; border-radius: 4px; margin-bottom: 15px;">';
                    runningHtml += '<div style="background: #f8f9fa; padding: 10px; border-bottom: 1px solid #dee2e6; font-weight: bold;">Detailed Test Progress</div>';
                    runningHtml += '<div style="max-height: 400px; overflow-y: auto; padding: 0 10px;">';
                    
                    // Group tests by status
                    const failedTests = status.tests.filter(t => t.status === 'failed');
                    const passedTests = status.tests.filter(t => t.status === 'passed');
                    const runningTests = status.tests.filter(t => t.status === 'running');
                    const pendingTests = status.tests.filter(t => t.status !== 'passed' && t.status !== 'failed' && t.status !== 'running');
                    
                    // Show running tests first
                    if (runningTests.length > 0) {
                        runningHtml += '<div style="margin: 10px 0; padding: 10px; background: #e3f2fd; border-radius: 4px;">';
                        runningHtml += '<div style="font-weight: bold; color: #0d6efd;">🔄 Running Tests (' + runningTests.length + ')</div>';
                        
                        runningTests.forEach((test, idx) => {
                            const testId = 'running-test-' + idx;
                            runningHtml += '<div style="margin-top: 8px; padding: 8px; border-left: 3px solid #0d6efd; background: rgba(255,255,255,0.7);">';
                            runningHtml += '<div style="display: flex; justify-content: space-between;">';
                            runningHtml += '<div><span style="color: #0d6efd;">🔄</span> <strong>' + test.name + '</strong></div>';
                            
                            if (test.subtests && test.subtests.length) {
                                runningHtml += '<button onclick="document.getElementById(\'' + testId + '\').style.display = document.getElementById(\'' + testId + '\').style.display === \'none\' ? \'block\' : \'none\'" style="background: none; border: none; color: #0d6efd; cursor: pointer;">Details ▼</button>';
                            }
                            
                            runningHtml += '</div>';
                            
                            // Show subtests if available
                            if (test.subtests && test.subtests.length) {
                                runningHtml += '<div id="' + testId + '" style="display: none; margin-top: 8px; margin-left: 15px;">';
                                
                                test.subtests.forEach(subtest => {
                                    const subtestIcon = subtest.status === 'passed' ? '✅' : 
                                                     subtest.status === 'failed' ? '❌' : 
                                                     subtest.status === 'running' ? '🔄' : '⏳';
                                    const subtestColor = subtest.status === 'passed' ? '#28a745' : 
                                                       subtest.status === 'failed' ? '#dc3545' : 
                                                       subtest.status === 'running' ? '#0d6efd' : '#6c757d';
                                    
                                    runningHtml += '<div style="padding: 5px; margin-top: 5px; border-left: 2px solid ' + subtestColor + '; background: #f8f9fa;">';
                                    runningHtml += '<span style="color: ' + subtestColor + ';">' + subtestIcon + '</span> ' + subtest.name;
                                    
                                    if (subtest.error) {
                                        runningHtml += '<div style="margin-top: 5px; padding: 5px; background: #ffebee; border-radius: 4px; font-family: monospace; font-size: 0.85em; overflow-x: auto;">' + subtest.error + '</div>';
                                    }
                                    
                                    runningHtml += '</div>';
                                });
                                
                                runningHtml += '</div>';
                            }
                            
                            runningHtml += '</div>';
                        });
                        
                        runningHtml += '</div>';
                    }
                    
                    // Show failed tests
                    if (failedTests.length > 0) {
                        runningHtml += '<div style="margin: 10px 0; padding: 10px; background: #fff5f5; border-radius: 4px;">';
                        runningHtml += '<div style="font-weight: bold; color: #dc3545;">❌ Failed Tests (' + failedTests.length + ')</div>';
                        
                        failedTests.forEach((test, idx) => {
                            const testId = 'failed-test-' + idx;
                            runningHtml += '<div style="margin-top: 8px; padding: 8px; border-left: 3px solid #dc3545; background: rgba(255,255,255,0.7);">';
                            runningHtml += '<div style="display: flex; justify-content: space-between;">';
                            runningHtml += '<div><span style="color: #dc3545;">❌</span> <strong>' + test.name + '</strong>' + (test.duration ? ' <small>(' + test.duration + 'ms)</small>' : '') + '</div>';
                            
                            if (test.subtests && test.subtests.length) {
                                runningHtml += '<button onclick="document.getElementById(\'' + testId + '\').style.display = document.getElementById(\'' + testId + '\').style.display === \'none\' ? \'block\' : \'none\'" style="background: none; border: none; color: #007bff; cursor: pointer;">Details ▼</button>';
                            }
                            
                            runningHtml += '</div>';
                            
                            // Show subtests if available
                            if (test.subtests && test.subtests.length) {
                                runningHtml += '<div id="' + testId + '" style="display: none; margin-top: 8px; margin-left: 15px;">';
                                
                                test.subtests.forEach(subtest => {
                                    const subtestIcon = subtest.status === 'passed' ? '✅' : subtest.status === 'failed' ? '❌' : '⏳';
                                    const subtestColor = subtest.status === 'passed' ? '#28a745' : subtest.status === 'failed' ? '#dc3545' : '#6c757d';
                                    
                                    runningHtml += '<div style="padding: 5px; margin-top: 5px; border-left: 2px solid ' + subtestColor + '; background: #f8f9fa;">';
                                    runningHtml += '<span style="color: ' + subtestColor + ';">' + subtestIcon + '</span> ' + subtest.name;
                                    
                                    if (subtest.error) {
                                        runningHtml += '<div style="margin-top: 5px; padding: 5px; background: #ffebee; border-radius: 4px; font-family: monospace; font-size: 0.85em; overflow-x: auto;">' + subtest.error + '</div>';
                                    }
                                    
                                    runningHtml += '</div>';
                                });
                                
                                runningHtml += '</div>';
                            }
                            
                            // Show error if available at test level
                            if (test.error) {
                                runningHtml += '<div style="margin-top: 5px; padding: 5px; background: #ffebee; border-radius: 4px; font-family: monospace; font-size: 0.85em; overflow-x: auto;">' + test.error + '</div>';
                            }
                            
                            runningHtml += '</div>';
                        });
                        
                        runningHtml += '</div>';
                    }
                    
                    // Show passed tests
                    if (passedTests.length > 0) {
                        runningHtml += '<div style="margin: 10px 0; padding: 10px; background: #f0fff4; border-radius: 4px;">';
                        runningHtml += '<div style="font-weight: bold; color: #28a745;">✅ Passed Tests (' + passedTests.length + ')</div>';
                        
                        passedTests.forEach((test, idx) => {
                            const testId = 'passed-test-' + idx;
                            runningHtml += '<div style="margin-top: 8px; padding: 8px; border-left: 3px solid #28a745; background: rgba(255,255,255,0.7);">';
                            runningHtml += '<div style="display: flex; justify-content: space-between;">';
                            runningHtml += '<div><span style="color: #28a745;">✅</span> <strong>' + test.name + '</strong>' + (test.duration ? ' <small>(' + test.duration + 'ms)</small>' : '') + '</div>';
                            
                            if (test.subtests && test.subtests.length) {
                                runningHtml += '<button onclick="document.getElementById(\'' + testId + '\').style.display = document.getElementById(\'' + testId + '\').style.display === \'none\' ? \'block\' : \'none\'" style="background: none; border: none; color: #007bff; cursor: pointer;">Details ▼</button>';
                            }
                            
                            runningHtml += '</div>';
                            
                            // Show subtests if available
                            if (test.subtests && test.subtests.length) {
                                runningHtml += '<div id="' + testId + '" style="display: none; margin-top: 8px; margin-left: 15px;">';
                                
                                test.subtests.forEach(subtest => {
                                    const subtestIcon = subtest.status === 'passed' ? '✅' : subtest.status === 'failed' ? '❌' : '⏳';
                                    const subtestColor = subtest.status === 'passed' ? '#28a745' : subtest.status === 'failed' ? '#dc3545' : '#6c757d';
                                    
                                    runningHtml += '<div style="padding: 5px; margin-top: 5px; border-left: 2px solid ' + subtestColor + '; background: #f8f9fa;">';
                                    runningHtml += '<span style="color: ' + subtestColor + ';">' + subtestIcon + '</span> ' + subtest.name;
                                    runningHtml += '</div>';
                                });
                                
                                runningHtml += '</div>';
                            }
                            
                            runningHtml += '</div>';
                        });
                        
                        runningHtml += '</div>';
                    }
                    
                    // Show pending tests
                    if (pendingTests.length > 0) {
                        runningHtml += '<div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px;">';
                        runningHtml += '<div style="font-weight: bold;">⏳ Pending Tests (' + pendingTests.length + ')</div>';
                        
                        pendingTests.forEach((test, idx) => {
                            const testId = 'pending-test-' + idx;
                            runningHtml += '<div style="margin-top: 8px; padding: 8px; border-left: 3px solid #6c757d; background: rgba(255,255,255,0.7); opacity: 0.8;">';
                            runningHtml += '<div style="display: flex; justify-content: space-between;">';
                            runningHtml += '<div>⏳ <strong>' + test.name + '</strong></div>';
                            
                            if (test.subtests && test.subtests.length) {
                                runningHtml += '<button onclick="document.getElementById(\'' + testId + '\').style.display = document.getElementById(\'' + testId + '\').style.display === \'none\' ? \'block\' : \'none\'" style="background: none; border: none; color: #007bff; cursor: pointer;">Details ▼</button>';
                            }
                            
                            runningHtml += '</div>';
                            
                            // Show subtests if available
                            if (test.subtests && test.subtests.length) {
                                runningHtml += '<div id="' + testId + '" style="display: none; margin-top: 8px; margin-left: 15px;">';
                                
                                test.subtests.forEach(subtest => {
                                    runningHtml += '<div style="padding: 5px; margin-top: 5px; border-left: 2px solid #6c757d; background: #f8f9fa;">';
                                    runningHtml += '⏳ ' + subtest.name;
                                    runningHtml += '</div>';
                                });
                                
                                runningHtml += '</div>';
                            }
                            
                            runningHtml += '</div>';
                        });
                        
                        runningHtml += '</div>';
                    }
                    
                    runningHtml += '</div></div>';
                }
                
                showLiveFeedback(runningHtml, 'running');
            }
        } else {
            console.log('🔍 No testStatus in response data:', data);
            showLiveFeedback('No active test execution found in response', 'error');
            stopPolling();
            return; // Don't schedule next poll
        }
        
        // Schedule next poll on success
        scheduleNextPoll();
        
    } catch (error) {
        console.error('Polling error:', error);
        handlePollingError(error);
    }
}

function handlePollingError(error) {
    pollingState.retries++;
    pollingState.circuitBreakerFailures++;
    
    console.log('Polling error handled:', {
        retries: pollingState.retries,
        maxRetries: pollingState.maxRetries,
        circuitBreakerFailures: pollingState.circuitBreakerFailures,
        error: error.message
    });
    
    // Open circuit breaker if too many failures
    if (pollingState.circuitBreakerFailures >= pollingState.circuitBreakerThreshold) {
        pollingState.isCircuitOpen = true;
        console.log('Circuit breaker opened');
    }
    
    let errorMessage = 'Connection error';
    if (error.name === 'AbortError') {
        errorMessage = 'Request timeout';
    } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Server unreachable';
    } else if (error.message.includes('HTTP')) {
        errorMessage = error.message;
    }
    
    // Stop polling immediately if too many retries or if server is clearly down
    if (pollingState.retries >= pollingState.maxRetries || 
        (pollingState.circuitBreakerFailures >= 3 && error.message.includes('Failed to fetch'))) {
        
        console.log('Stopping polling due to excessive failures');
        showLiveFeedback(
            'Connection permanently lost after ' + pollingState.retries + ' attempts.<br>' +
            'Last error: ' + errorMessage + '<br>' +
            '<button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Refresh Page</button>', 
            'error'
        );
        stopPolling();
        return;
    }
    
    const nextDelay = calculateDelay();
    console.log('Scheduling next poll in', nextDelay, 'ms');
    
    showLiveFeedback(
        errorMessage + ' (attempt ' + pollingState.retries + '/' + pollingState.maxRetries + ')<br>' +
        'Retrying in ' + Math.ceil(nextDelay / 1000) + ' seconds...<br>' +
        '<small>Using exponential backoff for connection recovery</small>', 
        'running'
    );
    
    // Schedule next poll with backoff
    scheduleNextPoll();
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        clearTimeout(pollInterval);
        pollInterval = null;
    }
    // Reset polling state when stopping
    resetPollingState();
}

// Other functions for dashboard
async function checkTestStatus() {
    try {
        showLiveFeedback('Checking test status...', 'running');
        
        const response = await fetch('/health?action=test-status');
        const data = await response.json();
        
        if (data.testStatus) {
            const status = data.testStatus;
            const progress = status.totalTests > 0 ? Math.round((status.passedTests + status.failedTests) / status.totalTests * 100) : 0;
            
            if (status.status === 'running') {
                // Categorize running tests
                const categorizeTest = (test) => {
                    if (test.file && test.file.includes('/__tests__/unit/')) return { type: 'unit', icon: '', color: '#28a745' };
                    if (test.file && test.file.includes('/__tests__/e2e/')) return { type: 'e2e', icon: '', color: '#007bff' };
                    if (test.file && test.file.includes('/tests/integration/')) return { type: 'integration', icon: '', color: '#ffc107' };
                    if (test.file && test.file.includes('/tests/performance/')) return { type: 'performance', icon: '', color: '#dc3545' };
                    if (test.file && test.file.includes('/tests/services/')) return { type: 'services', icon: '', color: '#6c757d' };
                    return { type: 'other', icon: '', color: '#6c757d' };
                };
                
                let runningHtml = `
                <strong> Live Test Execution</strong><br>
                Status: <span style="color: #007bff; font-weight: bold;">${status.status.toUpperCase()}</span><br>
                Progress: <span style="color: #28a745; font-weight: bold;">${progress}% complete</span><br>
                Tests: Total: ${status.totalTests}, Passed: ${status.passedTests}, Failed: ${status.failedTests}, Skipped: ${status.skippedTests || 0}<br>
                Started: ${new Date(status.startTime).toLocaleString()}<br><br>
                `;
                
                // Show current test with category
                if (status.currentTestName) {
                    const currentTest = status.tests ? status.tests.find(t => t.name === status.currentTestName) : null;
                    if (currentTest) {
                        const category = categorizeTest(currentTest);
                        runningHtml += `
                        <div style="padding: 12px; margin: 10px 0; border-left: 4px solid ${category.color}; background: #f8f9fa; border-radius: 0 4px 4px 0;">
                            <strong>Currently Running:</strong><br>
                            ${category.icon} <span style="color: ${category.color}; font-weight: bold;">[${category.type.toUpperCase()}]</span> ${status.currentTestName}
                            ${status.currentSubtest ? `<br><span style="margin-left: 20px; color: #6c757d;"> ${status.currentSubtest}</span>` : ''}
                        </div>
                        `;
                    }
                }
                
                runningHtml += '<em> Intelligent polling with exponential backoff...</em>';
                
                showLiveFeedback(runningHtml, 'info');
                
                scheduleNextPoll();
                return;
            } else {
                showLiveFeedback(
                    '<strong>Current Status:</strong> ' + status.status.toUpperCase() + '<br>' +
                    '<strong>Progress:</strong> ' + progress + '% complete<br>' +
                    '<strong>Tests:</strong> Total: ' + status.totalTests + ', Passed: ' + status.passedTests + ', Failed: ' + status.failedTests + ', Skipped: ' + status.skippedTests + '<br>' +
                    '<strong>Started:</strong> ' + (status.startTime ? new Date(status.startTime).toLocaleString() : 'Unknown'),
                    status.status === 'completed' ? 'completed' : 'running'
                );
            }
        } else {
            showLiveFeedback('No test execution found', 'error');
        }
    } catch (error) {
        showLiveFeedback('Error checking test status: ' + error.message, 'error');
    }
}

async function viewTestResults() {
    try {
        showLiveFeedback('Loading test results...', 'running');
        
        const response = await fetch('/health?action=test-results');
        const data = await response.json();
        
        if (data.testResults && data.testResults.length > 0) {
            let resultsHtml = '<strong>Test Results History:</strong><br><br>';
            data.testResults.forEach((result, index) => {
                const status = result.success ? 'PASSED' : 'FAILED';
                const color = result.success ? '#28a745' : '#dc3545';
                resultsHtml += 
                    '<div style="margin-bottom: 10px; padding: 10px; border-left: 3px solid ' + color + '; background: #f8f9fa;">' +
                    '<strong style="color: ' + color + ';">' + status + '</strong> - ' + 
                    'Tests: ' + (result.totalTests || 0) + ', ' +
                    'Passed: ' + (result.passedTests || 0) + ', ' +
                    'Failed: ' + (result.failedTests || 0) + '<br>' +
                    '<small>Executed: ' + (result.timestamp ? new Date(result.timestamp).toLocaleString() : 'Unknown') + '</small>' +
                    '</div>';
            });
            
            showLiveFeedback(resultsHtml, 'completed');
        } else {
            showLiveFeedback('No test results found', 'error');
        }
    } catch (error) {
        showLiveFeedback('Error loading test results: ' + error.message, 'error');
    }
}

// Initialize dashboard on page load
window.addEventListener('load', async function() {
    const resultsDiv = document.getElementById('test-results');
    resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center;">🔄 Checking server connection...</div>';
    
    const isConnected = await checkConnection();
    if (!isConnected) {
        showLiveFeedback(
            'Server connection failed. The backend may not be running.<br>' +
            '<button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry Connection</button>', 
            'error'
        );
    } else {
        resultsDiv.innerHTML = 
            '<div style="padding: 20px; background: #d4edda; border-radius: 8px; border-left: 4px solid #28a745;">' +
                '<h4 style="color: #28a745;">✅ Server Connected</h4>' +
                '<p>👆 Click a button above to view test information</p>' +
                '<ul style="text-align: left; margin-top: 15px;">' +
                    '<li><strong>Run Full Test Suite</strong> - Start new test execution</li>' +
                    '<li><strong>Check Test Status</strong> - View current/latest test status</li>' +
                    '<li><strong>View Latest Results</strong> - See all test execution history</li>' +
                '</ul>' +
            '</div>';
    }
});

// Function to check if polling should be active and stop it if not needed
async function checkAndStopUnnecessaryPolling() {
    try {
        const response = await fetch('/health?action=test-status', {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // If no test is running, stop any polling
            if (!data.testStatus) {
                console.log('No testStatus in response, stopping any polling');
                stopPolling();
            } else if (data.testStatus.status === 'running') {
                console.log('✅ Active test execution detected:', data.testStatus.id, 'Status:', data.testStatus.status);
                // Test is running, don't stop polling
            } else if (data.testStatus.status === 'completed') {
                console.log('Test execution completed, stopping polling');
                stopPolling();
            } else {
                console.log('Unknown test status:', data.testStatus.status, 'stopping polling as precaution');
                stopPolling();
            }
        }
    } catch (error) {
        console.log('Could not check test status, stopping polling as precaution');
        stopPolling();
    }
}

// Add visibility change handler to pause/resume polling when tab is not visible
document.addEventListener('visibilitychange', function() {
    if (document.hidden && pollInterval) {
        // Tab is hidden, slow down polling
        stopPolling();
        if (pollingState.retries === 0) { // Only if not in error state
            pollingState.baseDelay = 10000; // 10 seconds when hidden
            scheduleNextPoll();
        }
    } else if (!document.hidden && pollInterval) {
        // Tab is visible again, resume normal polling
        pollingState.baseDelay = 2000; // Back to 2 seconds
    }
});

// Check and stop unnecessary polling on page load
checkAndStopUnnecessaryPolling();
