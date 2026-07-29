import { defineConfig, devices } from "@playwright/test";

/**
 * docs/07 — Gate 4 (E2E) y Gate 5 (visual).
 *
 * Los baselines de `toHaveScreenshot` dependen del SO y del rasterizado de fuentes:
 * un baseline hecho en Windows no coincide con uno de CI en Linux. Por eso el nombre
 * del snapshot NO incluye la plataforma y los baselines se generan únicamente desde
 * el contenedor oficial de Playwright (ver README de la fase).
 */
const PORT = 3000;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  snapshotPathTemplate: "{testDir}/{testFileDir}/__screenshots__/{arg}{ext}",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Comparación visual determinista: sin animaciones en vuelo (docs/07 Gate 5).
    contextOptions: { reducedMotion: "reduce" },
  },

  // docs/07 — breakpoints mínimos.
  projects: [
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
