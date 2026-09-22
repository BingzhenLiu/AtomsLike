import { defineConfig } from "vitest/config";
import path from "node:path";

/** Unit tests stay isolated from the preview/app Vite config. */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    reporters: ["default"],
  },
});
