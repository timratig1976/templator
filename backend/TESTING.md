# Templator Test Structure Documentation

## 📁 Test Organization Overview

The Templator project uses a **refined hybrid test structure** that organizes tests by purpose and execution context, providing clear separation between different types of testing strategies.

## 🏗️ Folder Structure

```
backend/
├── src/
│   └── __tests__/              # Development-focused tests (co-located with source)
│       ├── unit/               # Unit tests for individual components
│       ├── e2e/               # End-to-end workflow tests
│       └── integration/       # Component integration tests
└── tests/                     # System-level tests (organized by testing strategy)
    ├── integration/           # System integration tests
    ├── performance/           # Performance and load tests
    ├── services/             # Service-layer testing
    ├── security/             # Security and penetration tests (future)
    └── acceptance/           # User acceptance tests (future)
```

## 🎯 Test Categories

### 🟢 Unit Tests (`src/__tests__/unit/`)
- **Purpose**: Test individual functions, classes, and components in isolation
- **Scope**: Single responsibility, fast execution
- **Examples**: `designController.test.ts`, `openaiService.test.ts`
- **Timeout**: 5 seconds (default)
- **Execution**: Parallel

### 🔵 End-to-End Tests (`src/__tests__/e2e/`)
- **Purpose**: Test complete user workflows and system behavior
- **Scope**: Full application stack, realistic scenarios
- **Examples**: `comprehensive-e2e.test.ts`, `e2e.test.ts`
- **Timeout**: 30 seconds
- **Execution**: Sequential (maxWorkers: 1)

### 🟡 Integration Tests (`tests/integration/`)
- **Purpose**: Test interactions between multiple system components
- **Scope**: Cross-service communication, data flow
- **Examples**: `AIModuleGeneration.test.ts`
- **Timeout**: 60 seconds
- **Execution**: Sequential

### 🔴 Performance Tests (`tests/performance/`)
- **Purpose**: Benchmark performance, load testing, resource usage
- **Scope**: System performance under various conditions
- **Examples**: `AIPerformance.test.ts`
- **Timeout**: 60 seconds
- **Execution**: Sequential

### ⚙️ Service Tests (`tests/services/`)
- **Purpose**: Test service-layer business logic and external integrations
- **Scope**: Service contracts, API integrations
- **Examples**: `HubSpotValidationService.test.ts`, `IterativeRefinementService.test.ts`
- **Timeout**: 60 seconds
- **Execution**: Sequential

## 🚀 Running Tests

### Run All Tests
```bash
npm test
```

### Run by Category
```bash
# Unit tests only (fast, for development)
npm test -- --selectProjects=UNIT

# E2E tests only
npm test -- --selectProjects=E2E

# Integration tests only
npm test -- --selectProjects=INTEGRATION
```

### Run Specific Test Files
```bash
# Run a specific unit test
npm test -- src/__tests__/unit/designController.test.ts

# Run a specific E2E test
npm test -- src/__tests__/e2e/comprehensive-e2e.test.ts
```

### Development Workflow
```bash
# Fast feedback during development
npm test -- --selectProjects=UNIT --watch

# Full validation before commit
npm test -- --selectProjects=UNIT,E2E

# Complete test suite (CI/CD)
npm test
```

## 📊 Test Dashboard Integration

The enhanced test dashboard automatically categorizes and displays tests with color-coded indicators:

- 🟢 **UNIT** - Green background, fast execution
- 🔵 **E2E** - Blue background, comprehensive workflows  
- 🟡 **INTEGRATION** - Yellow background, system interactions
- 🔴 **PERFORMANCE** - Red background, benchmarking
- ⚙️ **SERVICES** - Gray background, service testing

### Dashboard Features
- **Live Progress Tracking**: Real-time updates during test execution
- **Category Overview**: Visual breakdown of test types and counts
- **Expandable Details**: Click to view individual test and subtest results
- **Error Reporting**: Detailed error messages and stack traces
- **Performance Metrics**: Execution times and progress percentages

## ⚙️ Jest Configuration

The project uses Jest's **multi-project configuration** for organized test execution:

```javascript
// jest.config.js
module.exports = {
  projects: [
    {
      displayName: { name: 'UNIT', color: 'green' },
      testMatch: ['<rootDir>/src/__tests__/unit/**/*.test.ts'],
      testTimeout: 5000
    },
    {
      displayName: { name: 'E2E', color: 'blue' },
      testMatch: ['<rootDir>/src/__tests__/e2e/**/*.test.ts'],
      maxWorkers: 1
    },
    {
      displayName: { name: 'INTEGRATION', color: 'yellow' },
      testMatch: ['<rootDir>/tests/**/*.test.ts'],
      maxWorkers: 1
    }
  ]
};
```

## 🔧 Best Practices

### File Naming
- Use descriptive names: `serviceName.test.ts`
- Include test type in path, not filename
- Keep setup files in appropriate directories

### Import Paths
- Unit tests: `import { service } from '../../services/serviceName';`
- E2E tests: `import { createApp } from '../../app';`
- Integration tests: `import { service } from '@/services/serviceName';`

### Test Organization
- **Unit tests**: Focus on single responsibility, mock dependencies
- **E2E tests**: Test realistic user scenarios, minimal mocking
- **Integration tests**: Test component interactions, selective mocking
- **Performance tests**: Measure and benchmark, establish baselines

### Mocking Strategy
- **Unit**: Mock all external dependencies
- **E2E**: Mock only external APIs (OpenAI, etc.)
- **Integration**: Mock only slow/unreliable external services
- **Performance**: Minimal mocking for realistic measurements

## 📈 Benefits of This Structure

### For Developers
- ✅ **Fast Feedback**: Unit tests run quickly during development
- ✅ **Clear Purpose**: Easy to find the right place for new tests
- ✅ **Parallel Development**: Different teams can work on different test types

### For CI/CD
- ✅ **Selective Execution**: Run only necessary test categories
- ✅ **Optimized Performance**: Parallel unit tests, sequential integration tests
- ✅ **Clear Reporting**: Color-coded results by category

### For Quality Assurance
- ✅ **Comprehensive Coverage**: Multiple testing strategies
- ✅ **Risk Management**: Critical paths covered by multiple test types
- ✅ **Performance Monitoring**: Dedicated performance test suite

## 🎯 Future Enhancements

### Planned Additions
- **Security Tests**: Penetration testing, vulnerability scanning
- **Acceptance Tests**: User story validation, BDD scenarios
- **Contract Tests**: API contract validation with external services
- **Visual Regression Tests**: UI consistency validation

### Dashboard Improvements
- **Test History**: Track test results over time
- **Performance Trends**: Monitor test execution performance
- **Coverage Reports**: Visual coverage reporting by category
- **Failure Analysis**: Automated failure pattern detection

## 📝 Migration Notes

### From Previous Structure
- All existing tests have been moved to appropriate categories
- Import paths have been updated to reflect new structure
- Jest configuration supports both old and new patterns during transition

### Breaking Changes
- Test file locations have changed
- Some import paths require updates
- Jest project selection syntax has changed

---

*This documentation reflects the current test structure as of the latest refactoring. For questions or suggestions, please refer to the project maintainers.*
