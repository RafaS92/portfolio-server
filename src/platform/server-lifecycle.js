export function createGracefulShutdown(
  server,
  { timeoutMs, onComplete = () => {}, onForced = () => {} },
) {
  let shutdownPromise;

  return function shutdown() {
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = new Promise((resolve) => {
      const forceCloseTimer = setTimeout(() => {
        server.closeAllConnections?.();
        onForced();
        resolve({ forced: true });
      }, timeoutMs);
      forceCloseTimer.unref?.();

      server.close((error) => {
        clearTimeout(forceCloseTimer);
        onComplete(error);
        resolve({ forced: false, error });
      });
      server.closeIdleConnections?.();
    });

    return shutdownPromise;
  };
}
