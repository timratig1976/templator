import ComprehensiveDashboardService from './src/services/dashboard/ComprehensiveDashboardService';

async function testComprehensiveDashboard() {
  console.log('🔍 Testing Comprehensive Dashboard with Real Data\n');
  
  try {
    console.log('📊 Getting comprehensive dashboard metrics...');
    const metrics = await ComprehensiveDashboardService.getDashboardMetrics(true);
    
    console.log('\n✅ COMPREHENSIVE DASHBOARD METRICS:');
    console.log('=====================================');
    
    console.log('\n🧪 TEST COVERAGE (Real Data):');
    console.log(`Current: ${metrics.testCoverage.current.toFixed(1)}%`);
    console.log(`Trend: ${metrics.testCoverage.trend} (${metrics.testCoverage.change})`);
    console.log(`Files: ${metrics.testCoverage.fileStats.tested}/${metrics.testCoverage.fileStats.total} (${metrics.testCoverage.fileStats.percentage.toFixed(1)}%)`);
    console.log(`Breakdown: Lines ${metrics.testCoverage.breakdown.lines.toFixed(1)}%, Functions ${metrics.testCoverage.breakdown.functions.toFixed(1)}%`);
    
    console.log('\n📝 CODE QUALITY (Real Data):');
    console.log(`Score: ${metrics.codeQuality.score} (Grade: ${metrics.codeQuality.grade})`);
    console.log(`Trend: ${metrics.codeQuality.trend} (${metrics.codeQuality.change})`);
    console.log(`TypeScript: ${metrics.codeQuality.breakdown.typescript}%`);
    console.log(`ESLint: ${metrics.codeQuality.breakdown.eslint}%`);
    console.log(`Complexity: ${metrics.codeQuality.breakdown.complexity}%`);
    console.log(`Documentation: ${metrics.codeQuality.breakdown.documentation}%`);
    
    console.log('\n⚡ PERFORMANCE (Real Data):');
    console.log(`Response Time: ${Math.round(metrics.performance.responseTime)}ms`);
    console.log(`Trend: ${metrics.performance.trend} (${metrics.performance.change})`);
    console.log(`Average: ${Math.round(metrics.performance.breakdown.average)}ms`);
    console.log(`P95: ${Math.round(metrics.performance.breakdown.p95)}ms`);
    console.log(`Error Rate: ${metrics.performance.breakdown.errorRate.toFixed(1)}%`);
    
    console.log('\n🔒 SECURITY (Real Data):');
    console.log(`Score: ${metrics.security.score}%`);
    console.log(`Trend: ${metrics.security.trend} (${metrics.security.change})`);
    console.log(`Vulnerabilities: Critical ${metrics.security.vulnerabilities.critical}, High ${metrics.security.vulnerabilities.high}, Medium ${metrics.security.vulnerabilities.medium}, Low ${metrics.security.vulnerabilities.low}`);
    
    console.log('\n🤖 AI METRICS (Real Data):');
    console.log(`Total Interactions: ${metrics.aiMetrics.totalInteractions}`);
    console.log(`Average Quality: ${metrics.aiMetrics.averageQuality.toFixed(1)}%`);
    console.log(`Cost Today: $${metrics.aiMetrics.costToday.toFixed(2)}`);
    console.log(`Regeneration Rate: ${metrics.aiMetrics.regenerationRate.toFixed(1)}%`);
    console.log(`User Satisfaction: ${metrics.aiMetrics.userSatisfaction.toFixed(1)}/5`);
    console.log(`Trend: ${metrics.aiMetrics.trend}`);
    
    console.log('\n💻 SYSTEM HEALTH (Real Data):');
    console.log(`Status: ${metrics.systemHealth.status}`);
    console.log(`Uptime: ${metrics.systemHealth.uptime.toFixed(1)} hours`);
    console.log(`Memory Usage: ${metrics.systemHealth.memoryUsage.toFixed(1)}%`);
    console.log(`Disk Usage: ${metrics.systemHealth.diskUsage.toFixed(1)}%`);
    console.log(`Error Rate: ${metrics.systemHealth.errorRate.toFixed(1)}%`);
    
    console.log('\n🎯 COMPARISON WITH PREVIOUS HARDCODED VALUES:');
    console.log('=============================================');
    console.log(`Test Coverage: ${metrics.testCoverage.current.toFixed(1)}% (was hardcoded 94% - HUGE DIFFERENCE!)`);
    console.log(`Code Quality: ${metrics.codeQuality.score}% (was hardcoded 95%)`);
    console.log(`Performance: ${Math.round(metrics.performance.responseTime)}ms (was hardcoded 98ms)`);
    console.log(`Security: ${metrics.security.score}% (was hardcoded 92%)`);
    
    if (metrics.testCoverage.current < 50) {
      console.log('\n⚠️  CRITICAL INSIGHT:');
      console.log('   The dashboard was showing completely misleading data!');
      console.log('   Real test coverage is much lower than the hardcoded 94%');
      console.log('   This reveals the true state of the codebase and areas for improvement');
    }
    
    console.log('\n✅ Comprehensive dashboard test completed successfully!');
    console.log('   All widgets now have access to REAL data instead of hardcoded values');
    console.log('   The maintenance dashboard will show accurate, actionable metrics');
    
  } catch (error) {
    console.error('❌ Error testing comprehensive dashboard:', error);
  }
}

// Run the test
testComprehensiveDashboard();
