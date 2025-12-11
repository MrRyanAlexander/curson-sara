export function logInfo(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.log(`[Sara][info] ${message}`, meta);
  } else {
    console.log(`[Sara][info] ${message}`);
  }
}

export function logError(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.error(`[Sara][error] ${message}`, meta);
  } else {
    console.error(`[Sara][error] ${message}`);
  }
}


