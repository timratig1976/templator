/**
 * Root Jest multi-project configuration
 * Delegates to per-package configs without moving test files.
 */
module.exports = {
  projects: [
    '<rootDir>/backend/jest.config.js',
    '<rootDir>/frontend/jest.config.js'
  ],
};
