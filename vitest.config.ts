import { defineConfig } from "vitest/config";

// unit tests only — pure functions, run in plain node (no workers runtime needed)
export default defineConfig({
  test: { include: ["{worker,src,shared}/**/*.test.ts"], environment: "node" },
});
