import ComprehensiveDashboardService from './src/services/dashboard/ComprehensiveDashboardService';

async function auditDashboardData() {
  console.log('🔍 COMPREHENSIVE DASHBOARD DATA AUDIT');
  console.log('=====================================\n');
  
  try {
    const metrics = await ComprehensiveDashboardService.getDashboardMetrics(true);
    
    console.log('📊 CHECKING DATA AUTHENTICITY:\n');
    
    // Test Coverage Audit
    console.log('🧪 TEST COVERAGE WIDGET:');
    console.log(`✓ Percentage: ${metrics.testCoverage.current.toFixed(1)}%`);
    console.log(`✓ Lines: ${metrics.testCoverage.realCounts?.linesCovered || 'MISSING'} / ${metrics.testCoverage.realCounts?.linesTotal || 'MISSING'}`);
    console.log(`✓ Functions: ${metrics.testCoverage.realCounts?.functionsCovered || 'MISSING'} / ${metrics.testCoverage.realCounts?.functionsTotal || 'MISSING'}`);
    
    // Check for consistency
    if (metrics.testCoverage.realCounts) {
      const calculatedPercentage = (metrics.testCoverage.realCounts.linesCovered / metrics.testCoverage.realCounts.linesTotal) * 100;
      const difference = Math.abs(calculatedPercentage - metrics.testCoverage.current);
      console.log(`✓ Consistency Check: ${calculatedPercentage.toFixed(1)}% vs ${metrics.testCoverage.current.toFixed(1)}% (diff: ${difference.toFixed(1)}%)`);
      if (difference > 1) {
        console.log('❌ INCONSISTENCY DETECTED in test coverage!');
      } else {
        console.log('✅ Test coverage data is consistent');
      }
    } else {
      console.log('❌ MISSING realCounts data!');
    }
    
    console.log('\n📝 CODE QUALITY WIDGET:');
    console.log(`✓ Score: ${metrics.codeQuality.score}% (Grade: ${metrics.codeQuality.grade})`);
    console.log(`✓ Trend: ${metrics.codeQuality.trend} (${metrics.codeQuality.change})`);
    console.log(`✓ TypeScript: ${metrics.codeQuality.breakdown.typescript}%`);
    console.log(`✓ ESLint: ${metrics.codeQuality.breakdown.eslint}%`);
    
    // Check if these look like real or fake values
    const qualityValues = [
      metrics.codeQuality.breakdown.typescript,
      metrics.codeQuality.breakdown.eslint,
      metrics.codeQuality.breakdown.complexity,
      metrics.codeQuality.breakdown.documentation
    ];
    const hasRoundNumbers = qualityValues.every(v => v % 5 === 0);
    if (hasRoundNumbers) {
      console.log('⚠️  WARNING: All quality values are round numbers (likely estimated/fake)');
    } else {
      console.log('✅ Quality values appear to be real measurements');
    }
    
    console.log('\n⚡ PERFORMANCE WIDGET:');
    console.log(`✓ Response Time: ${Math.round(metrics.performance.responseTime)}ms`);
    console.log(`✓ Average: ${Math.round(metrics.performance.breakdown.average)}ms`);
    console.log(`✓ P95: ${Math.round(metrics.performance.breakdown.p95)}ms`);
    console.log(`✓ Error Rate: ${metrics.performance.breakdown.errorRate.toFixed(1)}%`);
    
    if (metrics.performance.responseTime === 0) {
      console.log('⚠️  WARNING: Performance data shows 0ms (likely no real data available)');
    } else {
      console.log('✅ Performance data appears to have real measurements');
    }
    
    console.log('\n🔒 SECURITY WIDGET:');
    console.log(`✓ Score: ${metrics.security.score}%`);
    console.log(`✓ Vulnerabilities: Critical ${metrics.security.vulnerabilities.critical}, High ${metrics.security.vulnerabilities.high}`);
    
    if (metrics.security.score % 5 === 0) {
      console.log('⚠️  WARNING: Security score is a round number (likely estimated)');
    } else {
      console.log('✅ Security score appears to be a real measurement');
    }
    
    console.log('\n🤖 AI METRICS WIDGET:');
    console.log(`✓ Total Interactions: ${metrics.aiMetrics.totalInteractions}`);
    console.log(`✓ Average Quality: ${metrics.aiMetrics.averageQuality.toFixed(1)}%`);
    console.log(`✓ Cost Today: $${metrics.aiMetrics.costToday.toFixed(2)}`);
    console.log(`✓ User Satisfaction: ${metrics.aiMetrics.userSatisfaction.toFixed(1)}/5`);
    
    if (metrics.aiMetrics.totalInteractions === 0) {
      console.log('⚠️  WARNING: No AI interactions logged yet (expected for new system)');
    } else {
      console.log('✅ AI metrics show real interaction data');
    }
    
    console.log('\n💻 SYSTEM HEALTH WIDGET:');
    console.log(`✓ Status: ${metrics.systemHealth.status}`);
    console.log(`✓ Memory Usage: ${metrics.systemHealth.memoryUsage.toFixed(1)}%`);
    console.log(`✓ Uptime: ${metrics.systemHealth.uptime.toFixed(1)} hours`);
    
    if (metrics.systemHealth.memoryUsage > 0) {
      console.log('✅ System health shows real process data');
    } else {
      console.log('⚠️  WARNING: System health may be using default values');
    }
    
    console.log('\n🎯 OVERALL AUDIT RESULTS:');
    console.log('=========================');
    
    let realDataCount = 0;
    let totalWidgets = 6;
    
    // Count widgets with real data
    if (metrics.testCoverage.realCounts && Math.abs((metrics.testCoverage.realCounts.linesCovered / metrics.testCoverage.realCounts.linesTotal) * 100 - metrics.testCoverage.current) < 1) {
      realDataCount++;
      console.log('✅ Test Coverage: REAL DATA');
    } else {
      console.log('❌ Test Coverage: INCONSISTENT/FAKE DATA');
    }
    
    if (!qualityValues.every(v => v % 5 === 0)) {
      realDataCount++;
      console.log('✅ Code Quality: REAL DATA');
    } else {
      console.log('❌ Code Quality: LIKELY ESTIMATED DATA');
    }
    
    if (metrics.performance.responseTime > 0) {
      realDataCount++;
      console.log('✅ Performance: REAL DATA');
    } else {
      console.log('❌ Performance: NO REAL DATA');
    }
    
    if (metrics.security.score % 5 !== 0) {
      realDataCount++;
      console.log('✅ Security: REAL DATA');
    } else {
      console.log('❌ Security: LIKELY ESTIMATED DATA');
    }
    
    if (metrics.aiMetrics.totalInteractions > 0) {
      realDataCount++;
      console.log('✅ AI Metrics: REAL DATA');
    } else {
      console.log('⚠️  AI Metrics: NO DATA (expected for new system)');
    }
    
    if (metrics.systemHealth.memoryUsage > 0) {
      realDataCount++;
      console.log('✅ System Health: REAL DATA');
    } else {
      console.log('❌ System Health: DEFAULT VALUES');
    }
    
    console.log(`\n📊 FINAL SCORE: ${realDataCount}/${totalWidgets} widgets showing REAL data`);
    
    if (realDataCount < totalWidgets / 2) {
      console.log('❌ MAJOR ISSUE: Most widgets still showing fake/estimated data!');
    } else if (realDataCount < totalWidgets) {
      console.log('⚠️  PARTIAL SUCCESS: Some widgets need real data implementation');
    } else {
      console.log('✅ SUCCESS: All widgets showing real data');
    }
    
  } catch (error) {
    console.error('❌ Error during dashboard audit:', error);
  }
}

// Run the audit
auditDashboardData();
