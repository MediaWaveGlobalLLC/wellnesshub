# 16 — Checklist de producción

Lo que hay que tener resuelto **antes** de anunciar la web. No es una lista de
buenas intenciones: cada punto dice quién lo hace y cómo se comprueba que quedó
hecho.

Estado a 30 de julio de 2026, cierre de la Fase 8.

---

## 1. Bloqueantes — la web no debe abrirse al público sin esto

| # | Qué | Quién | Estado |
|---|---|---|---|
| 1.1 | **Rotar la contraseña de la base de datos de Supabase.** Se compartió por chat el 2026-07-22 y debe considerarse comprometida. Supabase → Settings → Database → Reset database password. | Dueño | ⛔ Pendiente |
| 1.2 | `SUPABASE_SERVICE_ROLE_KEY` en Vercel. Sin ella el área de administración no funciona: no puede leer saldos ni registrar ajustes. | Dueño | ⛔ Pendiente |
| 1.3 | `ADMIN_EMAIL_ALLOWLIST` en Vercel, con los correos que de verdad deben entrar a `/admin`. | Dueño | ⛔ Pendiente |
| 1.4 | `GIFT_CARD_PEPPER` de producción: 32 bytes aleatorios, **distinto** del de desarrollo. Si cambia después de emitir tarjetas, ninguna se podrá canjear. | Dueño | ⛔ Pendiente |
| 1.5 | Claves de Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) y endpoint del webhook apuntando al dominio real. | Dueño | ⛔ Pendiente |
| 1.6 | `RESEND_API_KEY` y dominio verificado en Resend. Sin esto no salen ni la confirmación de cuenta ni el correo de la gift card. | Dueño | ⛔ Pendiente |
| 1.7 | **Revisión legal** de `/terminos` y `/privacidad`. El texto describe con exactitud lo que el sistema hace, pero no lo ha revisado un abogado. | Dueño | ⛔ Pendiente |
| 1.8 | Correo de contacto legal. Hoy la política remite a teléfono, Instagram y local, porque no había buzón y no se inventó uno. Cuando exista, añadirlo a `SITE`. | Dueño | ⛔ Pendiente |
| 1.9 | Aplicar la migración `0010_rate_limits.sql` en producción. Hasta entonces el límite de intentos falla abierto: no bloquea a nadie. | Dueño / equipo | ⛔ Pendiente |

---

## 2. Verificaciones antes de cada despliegue

Los siete gates de `CLAUDE.md` §7 más las dos comprobaciones que se añadieron en
la Fase 8, y que existen porque los gates no ven lo que ellas ven.

```bash
npm run lint && npm run typecheck && npm run test && npm run validate:design && npm run build
```

Y contra un servidor de producción levantado (`npm run build && npm start`):

```bash
npm run verify:csp http://localhost:3000 && npm run audit:a11y http://localhost:3000
```

**Por qué estas dos aparte.** En la Fase 8 la CSP bloqueó todos los chunks de
Next y la web se pintaba sin hidratar: ningún formulario respondía. Lint,
typecheck, tests, validate:design y build pasaron los cinco en verde. Un gate que
no abre un navegador no puede ver una página muerta.

| Comprobación | Qué detecta |
|---|---|
| `verify:csp` | Violaciones de CSP, contenido invisible, enlaces rotos —incluidos los prefetch de `<Link>`— y que la aplicación sea interactiva de verdad. |
| `audit:a11y` | Incidencias WCAG 2.1 AA con axe-core en 9 páginas públicas. |

---

## 3. Seguridad — estado real

| Punto | Estado | Nota |
|---|---|---|
| Cabeceras de seguridad en toda respuesta | ✅ | `src/proxy.ts` + `src/lib/seguridad/cabeceras.ts`. |
| CSP | ⚠️ Parcial | `script-src 'self' 'unsafe-inline'`. La versión con nonce y `strict-dynamic` obliga a renderizar dinámicamente TODAS las páginas, incluidas las de contenido puro. Es una decisión de arquitectura que corresponde al dueño; ver la nota en `cabeceras.ts`. |
| Límite de intentos en auth | ✅ Código / ⛔ Producción | `0010_rate_limits.sql`. Contador en Postgres, no en memoria: en serverless un contador en memoria no limita nada. Falla abierto ante un fallo de base de datos, a propósito. |
| RLS en todas las tablas | ✅ | Verificado con Postgres real en PGlite, no con dobles. |
| Sesión verificada en servidor | ✅ | `getUser()`, nunca `getSession()`. El proxy es solo UX; cada página protegida revalida. |
| Open redirect | ✅ | El parámetro `siguiente` solo admite rutas internas. |
| Enumeración de usuarios | ✅ | Registro, login y recuperación devuelven el mismo mensaje exista o no la cuenta. |
| Códigos de gift card | ✅ | 128 bits de entropía, guardados con HMAC-SHA256 y pepper de servidor. Irrecuperables una vez emitidos, también para nosotros. |
| Webhook de Stripe | ✅ | Firma verificada sobre el cuerpo crudo e idempotente por `stripe_event_id`. |
| Doble canje de gift card | ✅ | `for update` en `canjear_gift_card`. |
| Secretos fuera del bundle | ✅ | Ningún secreto lleva prefijo `NEXT_PUBLIC_`. El repo es público: esto se revisa en cada cambio de variables. |

---

## 4. Accesibilidad

`npm run audit:a11y` da **0 incidencias en 9 páginas** con los tags `wcag2a`,
`wcag2aa`, `wcag21a` y `wcag21aa`.

Dicho sin adornos: **axe detecta alrededor de un tercio de los problemas reales.**
Cero incidencias automáticas no significa accesible. Queda pendiente, y necesita
una persona:

- Recorrer cada formulario solo con el teclado y comprobar que el orden de foco
  tiene sentido y que nada queda atrapado.
- Probar `/perfil`, `/wallet` y `/gift-cards` con un lector de pantalla.
- Verificar que los textos alternativos describen las fotos, no que existan.
- Revisar las páginas privadas, que la auditoría no cubre porque requieren sesión.

Correcciones de contraste aplicadas en la Fase 8, todas dentro de la paleta
oficial y sin tocar ningún color de marca:

| Antes | Ratio | Ahora | Ratio |
|---|---|---|---|
| `leche` sobre `terracota` | 4.39 | `surface` sobre `terracota` | 4.92 |
| `leche/80` y `/90` sobre `terracota` | 3.30 / 3.81 | `surface` sin opacidad | 4.92 |
| `mustard` como texto | 2.13 | `espresso`; mustard sigue como fondo e icono | 12.26 |
| `terracota` como enlace sobre `leche` | 4.39 | `primary-hover` | 5.83 |

---

## 5. Pendientes conocidos, sin maquillar

- **Baselines visuales.** `docs/07` exige aprobación humana y el contenedor
  oficial de Playwright. Windows no renderiza igual que el Linux de CI, así que
  generarlos aquí produciría baselines que fallan en cuanto se ejecuten en CI.
  No se han congelado.
- **Simulacro de backup y restauración.** Requiere acceso al panel de Supabase.
  Sin hacer.
- **Selector EN.** D15 fijó español. El selector solo afecta ya a `/nosotros` y
  `/visitanos`; falta decidir si se retira.
- **Copia de la barra de anuncio.** Dice «Café gratis 1 vez al mes» en lugar del
  «envío gratis +$25» del mockup, porque no existe tienda en línea. Falta
  confirmarla.
- **Cuenta de prueba** `siembra.fase2.…@mailinator.com` en producción. El SQL de
  limpieza está en `scripts/seed-dev.mjs`.
- **Hora del evento sembrado**, ya visible en `/comunidad`:

  ```sql
  update public.events
     set starts_at = date_trunc('day', starts_at) + interval '15 hours',
         ends_at   = date_trunc('day', starts_at) + interval '17 hours'
   where slug = 'ceremonia-de-matcha';
  ```

---

## 6. Después de desplegar

1. Cargar `/`, `/menu` y `/gift-cards` y confirmar que se ven y responden.
2. Registrar una cuenta real y comprobar que llega el correo de confirmación.
3. Comprar una gift card en modo test y verificar que el webhook la emite **una
   sola vez** aunque Stripe reenvíe el evento.
4. Canjear esa tarjeta y comprobar que el saldo sube y que el segundo intento
   falla.
5. Entrar en `/admin` con un correo de la allowlist y con uno que no esté.
6. Repetir `verify:csp` y `audit:a11y` contra el dominio real.
