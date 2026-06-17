const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.INFO;

function timestamp() {
  return new Date().toISOString();
}

function pad(n) {
  return String(n).padEnd(5, ' ');
}

function log(level, message, { module, stack } = {}) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const parts = [`[${timestamp()}]`, `[${pad(level)}]`];
  if (module) parts.push(`[${module}]`);
  parts.push(message);
  if (stack) parts.push('\n' + stack);
  const output = parts.join(' ');
  if (level === 'ERROR') {
    console.error(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message, ctx) => log('DEBUG', message, ctx),
  info: (message, ctx) => log('INFO', message, ctx),
  warn: (message, ctx) => log('WARN', message, ctx),
  error: (message, ctx) => log('ERROR', message, ctx),
};
