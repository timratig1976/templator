import fs from 'fs';
import path from 'path';

// Provide a robust resolver that prefers a project-specific custom file if present
// but falls back to a sensible default for local/dev/test environments.
export function getBuildTestConfig(): { interval: number; enabled: boolean; notifyOnError: boolean } {
  try {
    const base = path.resolve(__dirname, '..', 'custom', 'build', 'config');
    const tsPath = path.join(base, 'build-test-config.ts');
    const jsPath = path.join(base, 'build-test-config.js');

    if (fs.existsSync(tsPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(tsPath);
      if (mod?.getBuildTestConfig) return mod.getBuildTestConfig();
    }
    if (fs.existsSync(jsPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(jsPath);
      if (mod?.getBuildTestConfig) return mod.getBuildTestConfig();
    }
  } catch (_) {
    // ignore and use default
  }

  // Default fallback config
  return {
    interval: 5,        // minutes
    enabled: false,     // disabled by default in CI/local unless customized
    notifyOnError: false
  };
}
