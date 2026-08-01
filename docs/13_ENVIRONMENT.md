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
- **`NEXT_PUBLIC_APP_URL` va con esquema**: `https://thewellnesshubpr.com`, no
  `thewellnesshubpr.com`. Sin esquema no es una URL absoluta y rompe dos cosas
  distintas: Stripe la rechaza con `url_invalid` y Supabase Auth la descarta en
  silencio. El código la normaliza (`src/lib/url-base.ts`), pero se escribe
  bien de todas formas.

## Supabase Auth — URL Configuration

**No basta con el código.** Las server actions mandan `emailRedirectTo` y
`redirectTo` apuntando a `/auth/callback`, pero Supabase solo respeta esa URL si
además está en la lista blanca del proyecto. Si no está, **no da error**: manda
el correo con la Site URL, que de fábrica es `http://localhost:3000`.

Eso pasó en producción. El enlace de verificación abría localhost en el móvil de
quien se registraba, la página no cargaba, y ahí se quedaban: sin cuenta
verificada y sin ninguna pista de qué había fallado.

En **Authentication → URL Configuration** del panel de Supabase:

| Ajuste | Valor |
|---|---|
| Site URL | `https://thewellnesshubpr.com` |
| Redirect URLs | `https://thewellnesshubpr.com/**` |
| Redirect URLs (desarrollo) | `http://localhost:3000/**` |
| Redirect URLs (previews de Vercel) | `https://*-mediawavegloballlc.vercel.app/**` |

La Site URL es la que se usa cuando todo lo demás falla, así que es la que tiene
que apuntar al dominio de verdad. Los `/**` son necesarios porque el reset de
contraseña añade query string (`?siguiente=/recuperar/nueva`).

Se comprueba de una sola forma fiable: registrando una cuenta con un correo real
y mirando a dónde apunta el enlace del mensaje.

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

