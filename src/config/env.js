import dotenv from "dotenv";

dotenv.config();

const ENVIRONMENTS = new Set(["development", "test", "production"]);
const SIZE_PATTERN = /^\d+(?:b|kb|mb)$/i;

function parseInteger(source, name, fallback, { min = 1, max } = {}) {
  const rawValue = source[name] ?? String(fallback);
  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${name} must be an integer.`);
  }

  const value = Number.parseInt(rawValue, 10);
  if (value < min || (max !== undefined && value > max)) {
    throw new Error(
      `${name} must be between ${min} and ${max ?? "Infinity"}.`,
    );
  }
  return value;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("Boolean environment values must be true or false.");
}

function parseOrigins(value) {
  const origins = (value ??
    "https://www.rafaelsvaldez.com,http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS must contain at least one origin.");
  }

  for (const origin of origins) {
    let url;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS_ALLOWED_ORIGINS contains an invalid URL: ${origin}`);
    }
    if (!new Set(["http:", "https:"]).has(url.protocol) || url.origin !== origin) {
      throw new Error(`CORS_ALLOWED_ORIGINS contains an invalid origin: ${origin}`);
    }
  }

  return Object.freeze(origins);
}

export function parseEnvironment(source = process.env) {
  const nodeEnvironment = source.NODE_ENV ?? "development";
  if (!ENVIRONMENTS.has(nodeEnvironment)) {
    throw new Error("NODE_ENV must be development, test, or production.");
  }

  const jsonBodyLimit = source.JSON_BODY_LIMIT ?? "32kb";
  if (!SIZE_PATTERN.test(jsonBodyLimit)) {
    throw new Error("JSON_BODY_LIMIT must use a value such as 32kb or 1mb.");
  }

  return Object.freeze({
    NODE_ENV: nodeEnvironment,
    PORT: parseInteger(source, "PORT", 3001, { max: 65535 }),
    HOST: source.HOST ?? "0.0.0.0",
    TRUST_PROXY: parseBoolean(source.TRUST_PROXY),
    CORS_ALLOWED_ORIGINS: parseOrigins(source.CORS_ALLOWED_ORIGINS),
    JSON_BODY_LIMIT: jsonBodyLimit,
    RATE_LIMIT_WINDOW_MS: parseInteger(source, "RATE_LIMIT_WINDOW_MS", 60_000),
    RATE_LIMIT_MAX_REQUESTS: parseInteger(
      source,
      "RATE_LIMIT_MAX_REQUESTS",
      20,
    ),
    CHAT_REQUEST_TIMEOUT_MS: parseInteger(
      source,
      "CHAT_REQUEST_TIMEOUT_MS",
      25_000,
    ),
    READINESS_TIMEOUT_MS: parseInteger(
      source,
      "READINESS_TIMEOUT_MS",
      3_000,
    ),
    SHUTDOWN_TIMEOUT_MS: parseInteger(
      source,
      "SHUTDOWN_TIMEOUT_MS",
      10_000,
    ),
    OPENAI_API_KEY: source.OPENAI_API_KEY,
    OPENAI_MODEL: source.OPENAI_MODEL ?? "gpt-4o-mini",
    OPENAI_EVAL_MODEL:
      source.OPENAI_EVAL_MODEL ?? source.OPENAI_MODEL ?? "gpt-4o-mini",
    SUPABASE_URL: source.SUPABASE_URL,
    SUPABASE_API_KEY: source.SUPABASE_API_KEY,
    PINECONE_API_KEY: source.PINECONE_API_KEY,
    PINECONE_INDEX: source.PINECONE_INDEX ?? "rafa-portfolio",
    PINECONE_NAMESPACE:
      source.PINECONE_NAMESPACE ?? `${nodeEnvironment}-v1`,
  });
}

export const env = parseEnvironment();

export function requireEnvironmentVariables(variableNames, values = env) {
  const missingVariables = variableNames.filter(
    (variableName) => !values[variableName],
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(", ")}`,
    );
  }
}

export function validateProductionEnvironment(values = env) {
  requireEnvironmentVariables(["OPENAI_API_KEY", "PINECONE_API_KEY"], values);

  if (values.NODE_ENV !== "production") {
    throw new Error("NODE_ENV must be production for a production release.");
  }
  if (values.PINECONE_NAMESPACE.startsWith("development")) {
    throw new Error("Production cannot use a development Pinecone namespace.");
  }
  if (values.CORS_ALLOWED_ORIGINS.some((origin) => origin.includes("localhost"))) {
    throw new Error("Production CORS origins cannot include localhost.");
  }

  return values;
}
