export class OperationTimeoutError extends Error {
  constructor(label, timeoutMs) {
    super(`${label} exceeded ${timeoutMs}ms.`);
    this.name = "OperationTimeoutError";
  }
}

export async function withTimeout(operation, timeoutMs, label = "Operation") {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new OperationTimeoutError(label, timeoutMs));
      controller.abort();
    }, timeoutMs);
    timer.unref?.();
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
