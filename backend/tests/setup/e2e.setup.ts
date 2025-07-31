/**
 * End-to-end test setup
 * Sets up the environment for e2e tests
 */

// Extend Jest timeout for e2e tests
jest.setTimeout(120000);

// Global before/after hooks
beforeAll(() => {
  console.log('Setting up e2e test environment');
});

afterAll(() => {
  console.log('Tearing down e2e test environment');
});
