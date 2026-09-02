import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const filePath = path.resolve(process.argv[2] ?? ".env.production");

if (!fs.existsSync(filePath)) {
  console.error(`Production environment file not found: ${filePath}`);
  process.exit(1);
}

const source = dotenv.parse(fs.readFileSync(filePath));
const { parseEnvironment, validateProductionEnvironment } = await import(
  "../src/config/env.js"
);

try {
  const environment = parseEnvironment(source);
  validateProductionEnvironment(environment);
  console.log(
    `Production configuration is valid for ${environment.CORS_ALLOWED_ORIGINS.join(", ")} ` +
      `using Pinecone namespace ${environment.PINECONE_NAMESPACE}.`,
  );
} catch (error) {
  console.error(`Production configuration is invalid: ${error.message}`);
  process.exitCode = 1;
}
