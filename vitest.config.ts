import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      /*
       * `server-only` es un centinela que Next resuelve en el build para hacer
       * fallar la compilación si un componente cliente importa código de
       * servidor. Fuera de Next no existe, así que se apunta a un módulo vacío:
       * la protección sigue actuando donde importa —al construir— y aquí no
       * impide probar la lógica.
       */
      "server-only": path.resolve(import.meta.dirname, "./tests/stubs/server-only.ts"),
    },
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
