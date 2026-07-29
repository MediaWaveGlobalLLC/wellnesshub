# 03 — Backend Architecture

## Capas

### UI

Next.js Server Components por defecto. Client Components solo cuando exista interacción real.

### Validación

Schemas Zod compartidos en `src/lib/validation/`.

### Servicios de dominio

- `auth-service`
- `profile-service`
- `wallet-service`
- `loyalty-service`
- `gift-card-service`
- `stripe-service`
- `email-service`
- `admin-service`

La UI no contiene lógica financiera.

### Persistencia

Supabase PostgreSQL. Migraciones versionadas en `supabase/migrations/`.

### Pagos

Stripe Checkout para cobrar gift cards. Webhook firmado para fulfillment.

### Email

Resend envía confirmaciones, gift card al destinatario y avisos de canje.

## Flujos

### Registro

1. Validar formulario.
2. Crear usuario con Supabase Auth.
3. Trigger crea `profiles`, `wallets` y `loyalty_accounts` con balance cero.
4. Enviar verificación.
5. Redirigir a confirmación, no asumir sesión verificada.

### Compra de gift card

1. Usuario envía monto/formato/destinatario.
2. Server valida sesión y monto.
3. Crea `gift_card_orders` en `pending`.
4. Crea Stripe Checkout Session con metadata mínima y `client_reference_id`.
5. Retorna URL de Checkout.
6. Stripe llama webhook.
7. Webhook verifica firma y deduplica `stripe_event_id`.
8. En transacción: marca order `paid`, crea gift card, genera código aleatorio, guarda hash + last4, registra audit.
9. Envía email al destinatario.

### Canje

1. Usuario autenticado envía código.
2. Endpoint normaliza y hashea el código.
3. Rate limit por usuario/IP.
4. Transacción bloquea gift card.
5. Rechaza inexistente, cancelada, expirada o ya canjeada.
6. Marca `redeemed` y `redeemed_by`.
7. Llama función ledger idempotente para acreditar wallet.
8. Devuelve saldo nuevo y receipt.

### Ajuste administrativo

1. Verificar rol admin server-side.
2. Validar cantidad y motivo.
3. Escribir ledger mediante función atómica.
4. Crear `audit_logs` con actor, usuario afectado, before/after, motivo e IP/request ID.

## Observabilidad

- Request ID en endpoints.
- Logs estructurados sin secretos ni códigos completos.
- Registro de webhooks procesados/fallidos.
- Alertas de webhook repetidamente fallido.
- Sentry opcional, sin PII innecesaria.
