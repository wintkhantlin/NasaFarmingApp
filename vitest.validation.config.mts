import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Runs the validation harnesses in scripts/validation. Network-bound; not part of `npm test`. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["scripts/validation/**/*.run.ts"],
    testTimeout: 10 * 60 * 1000,
  },
});
