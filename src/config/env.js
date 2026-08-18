import dotenv from "dotenv";

dotenv.config();

const requiredVariables = [
  "OPENAI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_API_KEY",
];

const missingVariables = requiredVariables.filter(
  (variableName) => !process.env[variableName],
);

if (missingVariables.length > 0) {
  console.error(
    `⚠️ Missing required environment variables: ${missingVariables.join(", ")}`,
  );
  process.exit(1);
}

const parsedPort = Number.parseInt(process.env.PORT ?? "3001", 10);

if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
  console.error("⚠️ PORT must be an integer between 1 and 65535.");
  process.exit(1);
}

export const env = Object.freeze({
  PORT: parsedPort,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_API_KEY: process.env.SUPABASE_API_KEY,
});
