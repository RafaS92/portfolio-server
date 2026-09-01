import dotenv from "dotenv";

dotenv.config();

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
  PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  PINECONE_INDEX: process.env.PINECONE_INDEX ?? "rafa-portfolio",
  PINECONE_NAMESPACE:
    process.env.PINECONE_NAMESPACE ?? "development-v1",
});

export function requireEnvironmentVariables(variableNames) {
  const missingVariables = variableNames.filter(
    (variableName) => !env[variableName],
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(", ")}`,
    );
  }
}
