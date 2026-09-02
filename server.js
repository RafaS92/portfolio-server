import { createApp } from "./src/app.js";
import { env, requireEnvironmentVariables } from "./src/config/env.js";

requireEnvironmentVariables([
  "OPENAI_API_KEY",
  "PINECONE_API_KEY",
]);

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`✅ Server running on port ${env.PORT}`);
});
