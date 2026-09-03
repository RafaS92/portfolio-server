const SECRET_KEY_PATTERN = /api[-_]?key|authorization|cookie|password|secret|token/i;
const ANSI_GREEN = "\u001B[32m";
const ANSI_RESET = "\u001B[0m";

export function formatStartupBanner({
  host,
  port,
  environment,
  color = true,
}) {
  const browserHost = host === "0.0.0.0" || host === "::" ? "localhost" : host;
  const message = [
    "",
    "  🟢 RafaBot API is running",
    `  ➜  Local: http://${browserHost}:${port}`,
    `  ➜  Mode:  ${environment}`,
    "",
  ].join("\n");

  return color ? `${ANSI_GREEN}${message}${ANSI_RESET}` : message;
}

function sanitizeString(value, secrets) {
  return secrets.reduce(
    (result, secret) => result.replaceAll(secret, "[REDACTED]"),
    value,
  );
}

export function sanitizeLogValue(value, { key = "", secrets = [] } = {}) {
  if (SECRET_KEY_PATTERN.test(key)) return "[REDACTED]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message, secrets),
    };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeLogValue(entry, { secrets }));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeLogValue(entryValue, { key: entryKey, secrets }),
      ]),
    );
  }
  return typeof value === "string" ? sanitizeString(value, secrets) : value;
}

export function createLogger({
  secrets = [],
  writeInfo = console.log,
  writeError = console.error,
  clock = () => new Date(),
} = {}) {
  function write(level, event, fields = {}) {
    const record = sanitizeLogValue(
      {
        timestamp: clock().toISOString(),
        level,
        event,
        ...fields,
      },
      { secrets },
    );
    const output = JSON.stringify(record);
    if (level === "error") writeError(output);
    else writeInfo(output);
  }

  return Object.freeze({
    info(event, fields) {
      write("info", event, fields);
    },
    error(event, fields) {
      write("error", event, fields);
    },
  });
}
