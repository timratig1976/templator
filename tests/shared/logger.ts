export type LogMethod = (message: string, meta?: any) => void;

export interface Logger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
}

export function createLogger(prefix: string = 'TestHarness'): Logger {
  const fmt = (level: string, message: string, meta?: any) => {
    const time = new Date().toISOString();
    const base = `[${time}] [${prefix}] ${message}`;
    if (meta !== undefined) {
      // eslint-disable-next-line no-console
      console.log(`${base}`, meta);
    } else {
      // eslint-disable-next-line no-console
      console.log(`${base}`);
    }
  };

  return {
    debug: (m, meta) => fmt('debug', m, meta),
    info: (m, meta) => fmt('info', m, meta),
    warn: (m, meta) => fmt('warn', m, meta),
    error: (m, meta) => fmt('error', m, meta),
  };
}
