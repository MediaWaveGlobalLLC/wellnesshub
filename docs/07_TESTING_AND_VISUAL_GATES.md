# 07 — Testing and Visual Gates

## Gate 1: estático

- ESLint sin errores.
- TypeScript strict sin errores.
- `validate:design` sin infracciones.
- No imports de assets remotos.

## Gate 2: unit/domain

Probar:

- Suma y resta atómica de wallet.
- Rechazo de saldo negativo.
- Idempotencia.
- Cálculo de niveles/puntos.
- Normalización y hash de gift card.
- Canje único.
- Estados de order.

## Gate 3: integración

- Registro crea profile/wallet/loyalty.
- RLS bloquea lectura cruzada.
- Webhook procesa pago válido.
- Webhook duplicado no duplica crédito/gift card.
- Código canjeado no puede reusarse.
- Admin adjustment crea audit log.

## Gate 4: E2E

- Registro completo.
- Login/logout/reset.
- Perfil carga datos reales.
- Compra gift card en Stripe test mode.
- Webhook acredita/crea card.
- Canje actualiza wallet.
- Mobile flows.

## Gate 5: visual

Los mockups son referencias de intención, no capturas directas del browser. El proceso correcto:

1. Implementar ruta según referencia.
2. Generar screenshot desktop 1440×1000 y mobile 390×844.
3. Comparar lado a lado con `design-references/`.
4. Corregir jerarquía, proporciones, color, espaciado y assets.
5. Obtener aprobación humana.
6. Guardar la captura aprobada como baseline Playwright.
7. Desde ese momento `toHaveScreenshot` bloquea regresiones.

Máximo recomendado tras aprobación: `maxDiffPixelRatio: 0.01`.

## Breakpoints mínimos

- 390×844
- 768×1024
- 1024×768
- 1440×1000

## Accesibilidad

- Navegación completa por teclado.
- Focus visible con colores de marca y contraste.
- Labels reales.
- Mensajes de error asociados.
- Reduced motion.
- Contraste WCAG AA.
