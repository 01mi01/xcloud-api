type Level = 'info' | 'warn' | 'error' | 'debug';

const emit = (level: Level, scope: string, msg: string, ...args: unknown[]): void => {
  const fn = level === 'debug' ? console.log : console[level];
  fn(`[${scope}] ${msg}`, ...args);
};

/** Returns a tiny scoped logger, e.g. `const log = createLogger('tweet-service')`. */
export const createLogger = (scope: string) => ({
  info: (msg: string, ...args: unknown[]) => emit('info', scope, msg, ...args),
  warn: (msg: string, ...args: unknown[]) => emit('warn', scope, msg, ...args),
  error: (msg: string, ...args: unknown[]) => emit('error', scope, msg, ...args),
  debug: (msg: string, ...args: unknown[]) => emit('debug', scope, msg, ...args),
});

export type Logger = ReturnType<typeof createLogger>;
