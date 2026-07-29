# 08 — Implementation Plan

## Fase 0 — Auditoría y baseline

- Auditar repo y assets.
- Confirmar rutas.
- Crear matriz de trazabilidad.
- Instalar/normalizar comandos de calidad.
- No implementar UI todavía.

## Fase 1 — Foundation y design system

- Next.js/TypeScript/Tailwind base.
- Tokens CSS desde JSON.
- Fuentes autorizadas/fallbacks.
- Asset registry.
- Header, footer, buttons, fields, cards, icons.
- Validator de diseño.
- Story/demo interna de componentes.

## Fase 2 — Auth y registro

- Supabase SSR.
- Registro, login, reset, verification.
- Trigger de profile/wallet/loyalty.
- UI fiel desktop/mobile.
- Tests auth y RLS.

## Fase 3 — Perfil

- Dashboard agregado.
- Nivel, puntos, wallet summary.
- Actividad, favoritos, eventos, QR.
- Estados loading/empty/error.

## Fase 4 — Wallet y ledger

- Tablas/functions.
- Saldo real e historial.
- Admin adjustment backend.
- Tests de invariantes.

## Fase 5 — Gift cards + Stripe

- Checkout.
- Webhook idempotente.
- Generación y email.
- Canje atómico.
- Stripe test mode E2E.

## Fase 6 — Admin

- User search.
- Balances/movimientos.
- Ajustes con audit.
- Gift card orders.

## Fase 7 — Home y contenido público

- Home final con assets.
- Menú/comunidad.
- Integración de CTAs.

## Fase 8 — Hardening y launch

- Visual baselines aprobados.
- Seguridad, rate limits y CSP.
- Performance y accesibilidad.
- Production env checklist.
- Backup/restore drill.
- Deploy Vercel y smoke tests.

Cada fase requiere aprobación antes de pasar a la siguiente.
