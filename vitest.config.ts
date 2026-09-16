import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // fileParallelism: false — the suite runs against one shared live Postgres,
  // and parallel files fight over the connection pool.
  test: { environment: "node", fileParallelism: false },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
