# 05 — API Contracts

Todos los endpoints responden JSON consistente:

```ts
type ApiSuccess<T> = { ok: true; data: T; requestId: string };
type ApiError = {
  ok: false;
  error: { code: string; message: string; fieldErrors?: Record<string, string[]> };
  requestId: string;
};
```

## Auth

Preferir Supabase Auth SSR. Server Actions pueden envolver flujos de UI, pero deben mantener schemas y errores tipados.

## `POST /api/gift-cards/checkout`

Auth: requerida.

Input:

```json
{
  "amountCents": 5000,
  "format": "digital",
  "recipientName": "Isa",
  "recipientEmail": "isa@example.com",
  "message": "Un detalle para ti"
}
```

Reglas:

- Montos preset: 2500, 5000, 7500, 10000.
- Personalizado: límites configurables server-side.
- Email requerido para digital.
- No aceptar precio desde producto oculto sin validarlo.

Output: `{ checkoutUrl, orderId }`.

## `POST /api/stripe/webhook`

- Raw body.
- Verificación de firma.
- Maneja `checkout.session.completed` y eventos relevantes de async payment.
- Idempotencia por event ID y session ID.
- Responde rápido; email puede ir a cola/retry.

## `POST /api/gift-cards/redeem`

Auth: requerida.

Input: `{ code: string }`.

Output:

```json
{
  "creditedCents": 5000,
  "newBalanceCents": 6840,
  "receiptId": "uuid"
}
```

Errores: invalid, already_redeemed, expired, rate_limited.

## `GET /api/wallet`

Auth: requerida.

Output: balance + transacciones paginadas. Nunca retorna datos de otros usuarios.

## `GET /api/profile/dashboard`

Auth: requerida.

Output agregado para perfil: profile, membership, points, wallet summary, recent activity, favorites y next event.

## `POST /api/admin/users/:id/wallet-adjustment`

Auth: admin.

Input:

```json
{
  "amountCents": 1000,
  "reason": "Crédito de servicio al cliente",
  "reference": "TICKET-123"
}
```

No permitir `reason` vacío. Reautenticación/MFA recomendada para producción.

## `POST /api/admin/users/:id/points-adjustment`

Mismo patrón, usando puntos enteros.
