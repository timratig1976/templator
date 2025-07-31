import TestCoverageService from './src/services/testing/TestCoverageService';

async function testCoverageCalculation() {
  console.log('🔍 Testing Real Test Coverage Calculation\n');
  
  try {
    // Get current coverage with fresh calculation
    console.log('📊 Calculating current test coverage...');
    const coverage = await TestCoverageService.getCurrentCoverage(true);
    
    console.log('\n✅ CURRENT TEST COVERAGE RESULTS:');
    console.log('=====================================');
    console.log(`Overall Coverage: ${coverage.metrics.overall.toFixed(1)}%`);
    console.log(`Trend: ${coverage.trend} (${coverage.change})`);
    console.log(`Timestamp: ${coverage.timestamp}`);
    
    console.log('\n📈 DETAILED METRICS:');
    console.log(`Lines: ${coverage.metrics.lines.covered}/${coverage.metrics.lines.total} (${coverage.metrics.lines.percentage.toFixed(1)}%)`);
    console.log(`Functions: ${coverage.metrics.functions.covered}/${coverage.metrics.functions.total} (${coverage.metrics.functions.percentage.toFixed(1)}%)`);
    console.log(`Branches: ${coverage.metrics.branches.covered}/${coverage.metrics.branches.total} (${coverage.metrics.branches.percentage.toFixed(1)}%)`);
    console.log(`Statements: ${coverage.metrics.statements.covered}/${coverage.metrics.statements.total} (${coverage.metrics.statements.percentage.toFixed(1)}%)`);
    
    console.log('\n📁 FILE STATISTICS:');
    console.log(`Total Source Files: ${coverage.sourceFiles}`);
    console.log(`Files with Tests: ${coverage.fileCount.tested}/${coverage.fileCount.total} (${coverage.fileCount.percentage.toFixed(1)}%)`);
    console.log(`Test Files: ${coverage.testFiles}`);
    
    // Get detailed breakdown
    console.log('\n🔍 Getting detailed coverage breakdown...');
    const detailed = await TestCoverageService.getDetailedCoverage();
    
    console.log('\n📊 COVERAGE BREAKDOWN BY CATEGORY:');
    console.log(`Controllers: ${detailed.breakdown.controllers} files`);
    console.log(`Services: ${detailed.breakdown.services} files`);
    console.log(`Routes: ${detailed.breakdown.routes} files`);
    console.log(`Pipeline: ${detailed.breakdown.pipeline} files`);
    console.log(`Logging: ${detailed.breakdown.logging} files ⭐ (NEW!)`);
    console.log(`Middleware: ${detailed.breakdown.middleware} files`);
    
    console.log('\n🧪 TEST BREAKDOWN:');
    console.log(`Unit Tests: ${detailed.testBreakdown.unit} files`);
    console.log(`Integration Tests: ${detailed.testBreakdown.integration} files`);
    console.log(`E2E Tests: ${detailed.testBreakdown.e2e} files`);
    
    // Compare with old hardcoded value
    const oldCoverage = 85.6;
    const improvement = coverage.metrics.overall - oldCoverage;
    
    console.log('\n📈 COMPARISON WITH PREVIOUS:');
    console.log(`Previous (Hardcoded): ${oldCoverage}%`);
    console.log(`Current (Real): ${coverage.metrics.overall.toFixed(1)}%`);
    console.log(`Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
    
    if (improvement > 0) {
      console.log('\n🎉 COVERAGE IMPROVED! This is likely due to:');
      console.log('   • New comprehensive logging system with extensive tests');
      console.log('   • Additional test files for AI metrics and quality tracking');
      console.log('   • Better test coverage calculation methodology');
    }
    
    // Save coverage history for trend tracking
    await TestCoverageService.saveCoverageHistory(coverage.metrics.overall);
    console.log('\n💾 Coverage history saved for trend tracking');
    
    console.log('\n✅ Test coverage calculation completed successfully!');
    console.log('   The maintenance dashboard will now show REAL coverage data instead of hardcoded 85.6%');
    
  } catch (error) {
    console.error('❌ Error testing coverage calculation:', error);
  }
}

// Run the test
testCoverageCalculation();
