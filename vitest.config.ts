import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // tests/visual pertenece a Playwright (npm run test:visual), no a Vitest.
    // tests/integration levanta Postgres en WASM y declara `environment: node`
    // por archivo, con su propio timeout: arrancar la base tarda unos segundos.
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
