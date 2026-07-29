# 04 — Database and Ledger Rules

## Tablas principales

- `profiles`
- `wallets`
- `wallet_transactions`
- `loyalty_accounts`
- `loyalty_transactions`
- `gift_card_orders`
- `gift_cards`
- `stripe_webhook_events`
- `audit_logs`

La migración base está en `supabase/migrations/0001_siembra_core.sql`.

## Invariantes del wallet

1. `balance_cents >= 0`.
2. Cada cambio de balance tiene exactamente un movimiento de ledger.
3. `idempotency_key` es único.
4. Una operación no se considera completada si ledger y balance no se actualizan en la misma transacción.
5. El navegador no puede insertar o actualizar wallet/ledger.
6. Los montos son enteros.

## Invariantes de puntos

1. Puntos son enteros.
2. El balance no puede bajar de cero.
3. Cada movimiento se registra.
4. La regla de earning debe estar configurada, no hardcodeada en componentes.

## Invariantes de gift card

1. Código criptográficamente aleatorio.
2. Base de datos guarda `code_hash`, nunca el código completo.
3. `code_last4` es solo para soporte.
4. Solo puede canjearse una vez.
5. El canje y el crédito del wallet ocurren atómicamente.
6. Purchase fulfillment depende del webhook.
7. Cada Stripe Session y Stripe Event es único.

## Member ID

Formato visible: `SMB-` + secuencia o short ID estable. No usar el UUID completo en UI.

## QR

El QR contiene un token público revocable o member ID firmado; nunca contiene secretos, balances ni email.
