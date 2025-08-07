/**
 * Mock logger for testing purposes
 */
export const createMockLogger = () => {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  };
};
