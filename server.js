import { createApp } from "./src/app.js";
import { env } from "./src/config/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`✅ Server running on port ${env.PORT}`);
});
