# 14 — Phase prompts

Después del plan inicial, usa una frase por fase.

## Fase 1

```text
APRUEBO FASE 1. Implementa únicamente foundation y design system según el plan aprobado. No implementes auth ni backend de negocio todavía. Al finalizar ejecuta todos los gates aplicables y entrega screenshots de la página interna de componentes.
```

## Fase 2

```text
APRUEBO FASE 2. Implementa auth y registro completo, incluyendo migración/trigger, SSR, RLS y la UI fiel al mockup. No avances a perfil. Ejecuta pruebas y muestra desktop/mobile.
```

## Fase 3

```text
APRUEBO FASE 3. Implementa el perfil con datos reales y estados completos. No uses balances mock. No avances a gift cards.
```

## Fase 4

```text
APRUEBO FASE 4. Implementa wallet, ledger y ajustes administrativos backend con invariantes e idempotencia. No avances a Stripe hasta que las pruebas de ledger pasen.
```

## Fase 5

```text
APRUEBO FASE 5. Implementa gift cards, Stripe Checkout, webhook firmado, emisión por email y canje atómico. Usa test mode y demuestra idempotencia.
```
