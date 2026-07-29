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
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
});
