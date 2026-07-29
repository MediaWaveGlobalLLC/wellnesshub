# 02 — Screen and Route Specs

## Rutas públicas

| Ruta | Objetivo | Referencia |
|---|---|---|
| `/` | Home SIEMBRA | `04-home-brand-direction-reference.png` |
| `/registro` | Crear cuenta | `01-registro-reference.png` |
| `/iniciar-sesion` | Login consistente con registro | Derivar de registro sin rediseñar |
| `/recuperar` | Solicitar reset | Derivar de registro |
| `/menu` | Menú público | Sistema visual home |
| `/comunidad` | Eventos/talleres | Sistema visual home/perfil |
| `/gift-cards` | Compra de gift card | `03-wallet-giftcards-reference.png` |

## Rutas protegidas

| Ruta | Objetivo | Referencia |
|---|---|---|
| `/perfil` | Dashboard personal | `02-perfil-reference.png` |
| `/perfil/editar` | Datos y preferencias | Misma familia visual |
| `/perfil/pedidos` | Historial de pedidos | Módulos de perfil |
| `/perfil/favoritos` | Productos favoritos | Módulos de perfil |
| `/perfil/eventos` | Reservas de talleres | Módulos de perfil |
| `/wallet` | Saldo, ledger y canje | `03-wallet-giftcards-reference.png` |
| `/wallet/canjear` | Canje enfocado | Misma pantalla/modal |
| `/gift-cards/confirmacion` | Resultado de checkout | Sistema gift cards |

## Rutas administrativas

| Ruta | Objetivo |
|---|---|
| `/admin` | Resumen mínimo |
| `/admin/usuarios` | Buscar y abrir usuario |
| `/admin/usuarios/[id]` | Ver balances, movimientos y ajustes |
| `/admin/gift-cards` | Pedidos y estados |
| `/admin/auditoria` | Audit log |

## Registro

Desktop:

- Header horizontal con logo, navegación y CTA terracota.
- Izquierda: título editorial, texto y cuatro beneficios.
- Derecha: card de formulario.
- Fondo inferior con assets de producto y naturaleza.
- Footer Forest.

Mobile:

- Logo centrado, menú hamburguesa y perfil.
- Hero reducido.
- Beneficios en grid 2x2.
- Formulario en una columna.
- Validación inline, accesible y sin desplazar violentamente el layout.

## Perfil

- Encabezado con avatar, saludo y descripción.
- Dos módulos prioritarios: nivel/progreso y créditos/puntos.
- Acciones de cuenta en grid.
- Actividad, favoritos, próximos eventos y QR.
- Mobile usa cards apiladas y navegación inferior.

## Wallet y gift cards

- Hero editorial con gift card de SIEMBRA.
- Columna de compra con monto, formato, destinatario y mensaje.
- Módulo de saldo con ledger y canje.
- Mobile prioriza wallet, selector de monto, card preview, canje e historial.

## Estados obligatorios

Cada pantalla debe contemplar:

- Loading/skeleton acorde a la marca.
- Empty state útil.
- Error recuperable.
- Success confirmation.
- Disabled/processing state.
- Session expired.
- Offline/retry cuando aplique.

No usar spinners genéricos si un skeleton editorial resuelve mejor.
