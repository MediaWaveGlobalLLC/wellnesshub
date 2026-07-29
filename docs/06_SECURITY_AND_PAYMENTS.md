# 06 — Security and Payments

## Secretos

Server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `GIFT_CARD_PEPPER`

Nunca usar prefijo `NEXT_PUBLIC_` para secretos.

## RLS

- `profiles`: usuario lee/actualiza su perfil permitido.
- `wallets`: usuario solo lee el propio.
- `wallet_transactions`: usuario solo lee las propias.
- `loyalty_*`: usuario solo lee lo propio.
- `gift_card_orders`: comprador lee sus pedidos sin información sensible.
- `gift_cards`: sin acceso directo del cliente.
- `audit_logs`: solo admin vía backend.

## Autorización administrativa

Rol en `app_metadata`, tabla privada o sistema equivalente no editable por el usuario. Nunca confiar en `user_metadata` para permisos.

## Stripe

- Crear Checkout Session server-side.
- Verificar firma del webhook.
- No acreditar desde `success_url`.
- Fulfillment idempotente.
- Guardar IDs de Stripe, no datos de tarjeta.
- No construir un formulario propio de tarjeta.

## Gift card code

- Generar con al menos 128 bits de entropía.
- Formato amigable por bloques.
- Guardar hash HMAC/SHA-256 con pepper server-only.
- Comparación constante cuando aplique.
- Nunca loggear código completo.
- Rate limit en canje.

## Protecciones adicionales

- CSRF según patrón de framework.
- SameSite y secure cookies.
- Validación Zod server-side.
- Content Security Policy.
- Protección de open redirects.
- Límites de payload.
- Sanitización de mensajes de gift card.
- CAPTCHA/bot protection en registro si hay abuso.
- Backups y migraciones probadas.
