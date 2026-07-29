# 12 — Required package scripts

Agregar al `package.json` del proyecto:

```json
{
  "scripts": {
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test --grep-invert visual",
    "test:visual": "playwright test tests/visual",
    "validate:design": "node scripts/verify-protected-assets.mjs && node scripts/validate-design-system.mjs",
    "build": "next build"
  }
}
```

Ajustar `lint` a la configuración actual de Next/ESLint si el comando cambia, pero conservar el nombre público `npm run lint`.
