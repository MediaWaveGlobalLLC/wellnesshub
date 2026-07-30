# 13 — Environment Variables

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
GIFT_CARD_PEPPER=
ADMIN_EMAIL_ALLOWLIST=
```

- `.env.example` contiene nombres, nunca valores.
- Vercel Preview y Production deben usar proyectos/keys separados cuando sea posible.
- Stripe debe iniciar en test mode.
- Rotar secretos si aparecen en logs, commits o screenshots.
