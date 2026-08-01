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

## Almacenamiento — bucket `avatares`

No lo crea ninguna migración, **a propósito**: una migración que toque
`storage.*` rompe las suites de integración con PGlite (DEC-009). Se crea a mano
en el panel de Supabase y hay que repetirlo en cualquier proyecto nuevo.

| Ajuste | Valor |
|---|---|
| Nombre | `avatares` |
| Público | sí (lectura) |
| Límite por archivo | 2 MB |
| Tipos permitidos | `image/jpeg, image/png, image/webp` |
| Políticas de escritura | **ninguna** |

Cero políticas es la decisión, no un olvido: ni `anon` ni `authenticated` pueden
escribir. Las fotos entran solo por la server action `subirAvatar`, que
comprueba sesión, cupo, tamaño y los bytes del archivo antes de subir nada con
`service_role`. Añadir una política de escritura abriría el bucket a subidas
directas desde el navegador y dejaría esa validación en un adorno.

El host del bucket va en `images.remotePatterns` de `next.config.ts`, atado a
`/storage/v1/object/public/avatares/**`. Sin eso `next/image` rechaza la URL y
la foto no se ve.

