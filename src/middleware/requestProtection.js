import { randomUUID } from "node:crypto";

export function requestId(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}

export function createRequestLogger(appLogger, now = performance.now.bind(performance)) {
  return function requestLogger(req, res, next) {
    const startedAt = now();

    res.on("finish", () => {
      appLogger.info("http_request", {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Math.max(0, Math.round(now() - startedAt)),
      });
    });
    next();
  };
}

export function createRateLimiter({ windowMs, maxRequests, now = Date.now }) {
  const clients = new Map();

  return function rateLimit(req, res, next) {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const currentTime = now();
    let entry = clients.get(key);

    if (!entry || currentTime >= entry.resetAt) {
      entry = { count: 0, resetAt: currentTime + windowMs };
      clients.set(key, entry);
    }

    entry.count += 1;
    res.setHeader("ratelimit-limit", maxRequests);
    res.setHeader(
      "ratelimit-remaining",
      Math.max(0, maxRequests - entry.count),
    );
    res.setHeader("ratelimit-reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      res.setHeader(
        "retry-after",
        Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000)),
      );
      return res.status(429).json({
        error: "Too many chat requests. Please try again shortly.",
        requestId: req.requestId,
      });
    }

    if (clients.size > 10_000) {
      for (const [clientKey, clientEntry] of clients) {
        if (currentTime >= clientEntry.resetAt) clients.delete(clientKey);
      }
    }

    return next();
  };
}
