# 09 — Decision Log

Toda desviación del contrato debe documentarse aquí antes de implementarse.

| Fecha | ID | Decisión | Razón | Impacto visual | Impacto backend | Aprobado por |
|---|---|---|---|---|---|---|
| 2026-07-29 | DEC-001 | Stack Next.js + Supabase + Stripe + Resend | Vercel, auth/RLS y pagos robustos | Ninguno | Base arquitectónica | Dueño del proyecto |
| 2026-07-29 | DEC-002 | Conservar `framer-motion` | Ya estaba en uso; removerlo sería un cambio de stack no aprobado | Ninguno | Ninguno | Dueño del proyecto |
| 2026-07-29 | DEC-003 | Generar la iconografía de línea con Higgsfield | No existe set de iconos en el material entregado | Alto (iconografía nueva) | Ninguno | Dueño del proyecto |
| 2026-07-29 | DEC-004 | Corregir falsos positivos de `scripts/validate-design-system.mjs` | El validador es inejecutable tal cual | Ninguno | Ninguno | Dueño del proyecto |
| 2026-07-29 | DEC-005 | Resolver las contradicciones mockup ↔ Brand Book a favor del Brand Book | `CLAUDE.md` §1 asigna la identidad al Brand Book | Medio | Ninguno | Dueño del proyecto |

---

### DEC-002 — Conservar framer-motion

- **Estado:** aprobada
- **Contexto:** el stack obligatorio del prompt maestro no lista `framer-motion`, pero el repo ya lo usa en `Header`, `Reveal`, `TiltCard`, `Marquee` y `RotatingBadge`.
- **Decisión:** conservarlo, pinneado en `12.42.2`.
- **Alternativas:** reescribir las animaciones con CSS puro — sería un cambio de stack no solicitado y un refactor fuera del alcance de la fase (`CLAUDE.md` §4).
- **Consecuencias:** una dependencia adicional. Debe respetar `prefers-reduced-motion` (gate de accesibilidad, `docs/07`).

### DEC-003 — Iconografía generada con Higgsfield

- **Estado:** aprobada
- **Contexto:** los 4 mockups apoyan buena parte de la jerarquía visual en ~16 iconos de línea. No existe ningún archivo de iconos en `Siembra_Claude_Code_Design_Lock_Kit/` ni en `Siembra Branding Oficial/`. `docs/01` prohíbe emojis como iconografía de UI y el prompt maestro prohíbe sustituir assets SIEMBRA por iconos genéricos de librería.
- **Decisión:** generar el set con Higgsfield siguiendo el trazo de los mockups y vectorizarlo a componentes SVG en `src/components/icons/`, con `currentColor` para heredar color sobre fondos Leche, Terracota y Forest.
- **Desviación explícita:** el prompt maestro dice *"No generes imágenes nuevas"*. El dueño del proyecto autorizó esta excepción de forma expresa, limitada a iconografía de UI.
- **Límites:** no aplica a fotografía, logo, empaques ni arte de producto — todo eso sigue saliendo exclusivamente de los assets oficiales.
- **Aprobación:** los iconos se presentan en `/_design` y no pasan a producción sin aprobación visual.

### DEC-004 — Corrección de falsos positivos del validador de diseño

- **Estado:** aprobada
- **Contexto:** `scripts/validate-design-system.mjs` no puede pasar nunca en su forma original. Tres bugs de expresión regular, ninguno relacionado con una regla real de marca:

  | Bug | Regex original | Falso positivo real detectado |
  |---|---|---|
  | Fuentes sin límite de palabra | `new RegExp(font, 'i')` con `font = "Inter"` | `pointer-events: none` · `páginas internas` · `micro-interacción` · `interacción constante` — la subcadena `inter` dispara la regla en 9 archivos |
  | `data:` URI tratado como remoto | `/https?:\/\//` + `/url\(/` | La textura de grano inline de `globals.css:77`, cuyo SVG lleva `xmlns='http://www.w3.org/2000/svg'` — es un asset **local** |
  | `new URL(...)` tratado como `url(` | `/url\(/i` (case-insensitive) | `metadataBase: new URL(...)` en `layout.tsx:15` — no es un asset visual |

- **Decisión:** tres correcciones quirúrgicas:
  1. Anclar los nombres de fuente con `\b…\b`.
  2. Excluir `data:image/` de la detección de assets remotos.
  3. Excluir `new URL(` de la detección de `url(`.
- **Lo que NO se toca:** ninguna prohibición se relaja. Siguen activas al 100% las reglas de hex fuera de paleta, funciones de color crudas, hosts remotos (`unsplash`, `placehold`, `picsum`), gradientes, `backdrop-filter`, radios excesivos, familias Tailwind prohibidas y verificación de referencias protegidas.
- **Verificación:** tras el fix el validador sigue marcando las infracciones reales (`backdrop-blur`, `bg-gradient-*`, `radial-gradient`, `rounded-3xl`, `rgb()` sin anotar). Se comprueba ejecutándolo antes y después de las correcciones de código.

### DEC-005 — Contradicciones entre los mockups y el Brand Book

- **Estado:** aprobada
- **Contexto:** los paneles laterales de los 4 mockups son metadatos del generador, no arte aprobado, y contradicen al Brand Book oficial.
- **Decisión** (orden de autoridad de `CLAUDE.md` §1 — mockups mandan en composición y flow; Brand Book en identidad; `docs/` en producto y backend):

  | Conflicto | Mockups dicen | Fuente que gana | Resultado |
  |---|---|---|---|
  | Tipografía | Playfair Display + Montserrat (ambas en `forbidden.fontFamilies`) | Brand Book p4 | The Seasons → **Droid Serif** + **Poppins** |
  | Paleta | `#C24E2A`, `#4C5A3D`, `#F3EAE1`… y difieren entre los 4 mockups | Brand Book p3 = `design-tokens.json` | Los 10 hex oficiales |
  | Puntos vs. crédito | Mockup 02 los fusiona: *"1,350 pts / Equivalen a $135 MXN"* | `docs/00`: *"Puntos: recompensa no monetaria"* | Dos módulos separados, sin conversión, todo en **USD** |
  | Regla de earning | Mockup 03: *"1 punto = $0.10"* y 10% en créditos | Brand Book p6 + `docs/04` (debe ser configurable) | `$1 → 1 punto`; Bebidas +50; Tienda +100 |
  | Niveles | *"Nivel Hoja"* (no existe en el enum) | `0001_siembra_core.sql` | `semilla · brote · raiz · florecer` |
  | Dirección | *"123 Wellness Way, San Juan, PR 00907"* (placeholder) | Business Card oficial + `Siembra Promo Square.png` | **1024 Ashford Avenue, Condado, San Juan, PR** |
  | Moneda | MXN | Esquema `currency = 'USD'`; negocio en Puerto Rico | USD |

- **Pendiente de dato externo:** los umbrales de nivel no existen en ninguna fuente. Se siembran como datos editables (`loyalty_tiers`: 0 / 500 / 2.000 / 5.000) usando el único ancla del mockup 02 (brote = 750 pts, siguiente nivel = 2.000). El cliente los ajusta en una fila.

### DEC-006 — Las gift cards pasan a tener saldo recargable

- **Estado:** aprobada (decisión del dueño del negocio; ver «Aprobación»)
- **Contexto:** una tarjeta era un cheque de un solo uso: un importe, un canje y se acabó. No había forma de gastarla en dos visitas ni de añadirle saldo, y el panel no ofrecía nada entre «anular» y «emitir código nuevo».
- **Decisión:** `gift_cards` gana `balance_cents` (saldo vivo) junto a `amount_cents` (importe emitido, inmutable). El canje pasa a ser un débito parcial y la dueña puede recargar. Migración `0019_gift_cards_recargables.sql`.

  | Punto | Decisión | Por qué |
  |---|---|---|
  | Destino del canje | Sigue siendo el wallet, pero por partes | No toca checkout ni mostrador; el wallet ya es el instrumento de gasto |
  | Quién recarga | Solo la dueña, desde el panel | Crea crédito sin cobro detrás: mismo carril que `admin_ajustar_wallet` —rol en SQL, motivo, tope de $5.000, auditoría |
  | Tarjeta agotada | Recargarla la revive con el mismo código | Un cliente habitual conserva una sola tarjeta |
  | `redeemed_by_user_id` | Pasa a significar «quién la agotó» | Con canje parcial la tarjeta pasa por varias manos; el rastro completo está en `wallet_transactions` |
  | Pasivo pendiente | `metricas_resumen` suma `balance_cents`, no `amount_cents` | Una tarjeta de $100 con $10 dentro inflaba el pasivo nueve veces |

- **Alternativas consideradas:** convertir la tarjeta en instrumento de pago directo contra caja (descartada: exige un flujo de cobro que hoy no existe) y recarga pagada por Stripe (descartada por ahora: toda acreditación con dinero detrás tiene que entrar por webhook, `docs/06`, y eso es un checkout nuevo).
- **Consecuencias — la que importa:** cambia la clave de idempotencia del ledger. Era `giftcard:<id>`, que hacía que un segundo canje del mismo código nunca acreditara dos veces. Con varios créditos legítimos por tarjeta esa clave deja de servir, así que pasa a `giftcard:<id>:<usuario>:<peticion>`, con `<peticion>` generada por el navegador una vez por intento de envío. Sin el `<usuario>` dentro, dos personas que comparten un código y mandan el mismo identificador colisionarían y la segunda recibiría el movimiento de la primera. La comprobación de idempotencia va **antes** de descontar el saldo: al revés, la tarjeta perdería dinero sin que nadie lo recibiera.
- **Otras consecuencias:** `balance_cents` es `not null` y **sin default**, a propósito: un INSERT que se olvide de declarar el saldo falla en vez de crear una tarjeta vacía y canjeable. `gift_cards.status = 'redeemed'` pasa a leerse «sin saldo» y en el panel se muestra así.
- **Aprobación:** el dueño del negocio, en sesión de 2026-07-31, sobre las tres decisiones de la tabla.

### DEC-007 — La cuenta de cliente en móvil: barra inferior, puntos y recompensas

- **Estado:** aprobada (decisión del dueño del negocio, sesión de 2026-07-31)
- **Contexto:** el teléfono se sentía como la web en pequeño, y los puntos solo subían. `NAV_MOVIL` llevaba declarado en `src/lib/nav.ts` desde la Fase 5 sin que lo pintara nadie, y `loyalty_transactions` admitía el tipo `'redeem'` desde `0001` sin que ningún archivo de `src/` lo escribiera jamás: un programa de lealtad donde la recompensa no existía.
- **Referencia:** `design-references/05-cuenta-movil-reference.png`.
- **Decisión:**

  | Punto | Decisión | Por qué |
  |---|---|---|
  | Barra inferior | Inicio · Puntos · Tienda · **Wallet** · Perfil | La referencia no lleva Wallet; se añade porque ahí viven el crédito y las gift cards. Sustituye a la barra del mockup 02 |
  | Cuándo se pinta | Solo con sesión y solo en móvil | Sin sesión, tres de cinco destinos rebotarían al login |
  | Recompensas | Catálogo que la dueña gestiona; canje descuenta puntos y entrega un código | `configurar_recompensas` es de dueña; `entregar_recompensa` también del mostrador, porque despachar es trabajo de barra |
  | Puntos y dinero | Siguen sin tocarse | DEC-005 y `docs/00`: los puntos no son monetarios. Un canje entrega producto, nunca crédito |
  | Nombre y coste del canje | Congelados en la fila | Si mañana sube el precio, el canje de ayer siguió costando lo que costó |
  | Fotos de recompensa | Clave del manifiesto de marca, nunca una URL | `docs/01` prohíbe imágenes remotas o inventadas. Sin foto, tarjeta tipográfica |

- **Consecuencias:** la idempotencia del canje repite el patrón de `DEC-006` —clave `reward:<id>:<usuario>:<peticion>`, comprobada **antes** de descontar—, porque descontar primero restaría existencias sin que nadie recibiera nada.
- **Desviaciones deliberadas de la referencia**, ambas por `docs/01`: sin emoji junto al saludo (DEC-003) y sin fotos para «Pastel o snack» ni «Experiencia», que no tienen asset aprobado y nacen sin imagen.
- **Pendiente:** falta hacer pedidos y compras desde la cuenta (fase 3), con pago por Stripe y con saldo del wallet.

### DEC-008 — Pedidos del menú para recoger, con pago por saldo o tarjeta

- **Estado:** aprobada (decisión del dueño del negocio, sesión de 2026-07-31)
- **Contexto:** `orders` existía desde `0005` y solo se leía — `/perfil/pedidos` pintaba un historial que nadie escribía nunca. Guardaba un total y ninguna línea, así que un pedido no podía decir de qué era. La regla de lealtad `por_dolar` llevaba desde `0005` marcada como imposible de disparar porque «la web no ve lo que se cobra en el mostrador».
- **Decisión:**

  | Punto | Decisión | Por qué |
  |---|---|---|
  | Qué se pide | El menú (`menu_productos` / `menu_variantes`), para recoger en el local | Es lo único con precios reales en la base. `/tienda` es un escaparate estático |
  | Precio | Lo calcula `crear_pedido` leyendo el catálogo | `CLAUDE.md` §5: el cliente nunca escribe importes. Un carrito manipulado pide otra cosa, no paga menos |
  | Pago | Saldo **o** tarjeta, nunca mezclado | Un pedido a medio pagar deja un estado en el que el dinero ya salió y el pedido aún no existe para la barra |
  | Cierre | Solo un pago confirmado | La página de éxito no paga nada (`docs/06`), igual que en las gift cards |
  | Estados | `pendiente_pago → pagado → preparando → entregado` | Vocabulario de recogida. Los de `0005` se conservan en el CHECK para no invalidar filas ya escritas |
  | Puntos | `por_dolar` se aplica al confirmarse el pago | Un pedido por la web sí se ve, así que la regla por fin se puede disparar |
  | Nombre y precio de la línea | Congelados | Igual que en `DEC-007`: subir el latte no puede reescribir el ticket de ayer |

- **Consecuencias:** el webhook de Stripe pasa a atender dos cosas y las distingue por `metadata.tipo`. Sin marca se asume gift card, que es lo único que existía antes, para que las sesiones abiertas antes del cambio sigan emitiendo su tarjeta. El CTA «Ordena online» del header deja de apuntar a `/menu`: la URL de pedidos real que D7 daba por pendiente ya existe.
- **Pendiente:** merch de `/tienda` (no tiene catálogo con precios), hora de recogida y aviso al cliente cuando el pedido esté listo.

### DEC-009 — Foto por producto en el menú, y el catálogo editable de verdad

- **Estado:** aprobada (aprobación escrita del dueño, 2026-08-01: «sí ponla en el menú también y asignar fotos está bien»)
- **Contexto:** `menu_productos` no tenía columna de imagen, así que la carta enseñaba fotos genéricas por sección y ninguna por producto. Y el panel de catálogo solo exponía precio, agotado y archivar: crear producto, editar nombre/nota/destacado, reordenar y gestionar tamaños existían como RPC desde `0015` **sin ningún botón que las llamara**.
- **Decisión:**

  | Punto | Decisión | Por qué |
  |---|---|---|
  | Cómo se guarda la foto | Clave del manifiesto de marca en `imagen_clave` | Extiende la regla de DEC-007. El validador de diseño **no lee `.sql` ni la base**, así que una URL guardada en Postgres pasaría en verde violando `docs/01`: la barrera tiene que estar en el modelo de datos |
  | Subir vs asignar | Asignar, no subir | Una migración que toque `storage.*` rompe las 17 suites de integración (verificado). Esquivarlo dejaría el RLS del bucket sin ningún test |
  | Foto en `/menu` | Sí, miniatura de 44px dentro de la fila existente | Aprobación escrita, según exige `CLAUDE.md` §2. No se convierte la lista en cuadrícula ni se rompe la guía de puntos |
  | Sin foto | Caso **normal**, no excepción | 24 imágenes elegibles para 30 productos, y varias son totes y servilletas. `docs/11`: el asset que falta se lista, no se sustituye |
  | Texto alternativo | `alt=""` | La miniatura acompaña al nombre en la misma fila: es decorativa, y repetirlo haría que el lector de pantalla lo dijera dos veces |
  | RPC de la foto | Función nueva, no ampliar la de editar | `create or replace` con otra lista de argumentos crea una **sobrecarga**: la firma vieja sobrevive sin revocar y las llamadas posicionales de los tests se rompen |
  | Barra inferior | «Tienda» pasa a ser «Pedir» | `/tienda` es un escaparate del que no se puede comprar. Gastar uno de los cinco huecos del pulgar en un callejón sin salida no se sostiene |

- **Consecuencias:** se descubrió que `public/brand/optimized/` **no existía en disco**, está en `.gitignore` y ningún script del build lo generaba, mientras el manifiesto ya apuntaba ahí — toda imagen optimizada era un 404, incluido el hero de la portada. Se arregla con un `prebuild` que ejecuta `build-asset-manifest`.
- **Nota de seguridad:** la CSP (`img-src 'self' data: blob:`) **no** es la salvaguarda que parece frente a imágenes remotas: `next/image` con `remotePatterns` las sirve desde el propio origen. La decisión se apoya en el modelo de datos, no en la CSP.

### DEC-010 — Apagar un producto lo QUITA de la carta

- **Estado:** aprobada (petición escrita de la dueña, 2026-08-01: «si en el area del catalogo se apaga un producto ... en el area de menu tambien se apague meaning que no se vea»)
- **Contexto:** hasta hoy `disponible = false` significaba «Agotado»: el producto seguía en `/menu`, rotulado. La decisión estaba escrita en el código —«que no esté hoy no significa que deje de existir en la carta»— y la pantalla del panel la explicaba. No era lo que la dueña entiende por apagar: `audit_logs` registra **41 cambios de disponibilidad**, el último a las 05:31 del 1 de agosto de 2026, y el resultado fue una carta pública con **30 de 31 productos rotulados AGOTADO**. La sincronización nunca falló —`revalidatePath("/menu")` funciona y la carta reflejaba la base al instante—; lo que fallaba era el significado del interruptor.
- **Decisión:**

  | Punto | Decisión | Por qué |
  |---|---|---|
  | `disponible = false` | El producto **no se enseña** en `/menu` ni en «Todo el menú» de favoritos | Es lo que la dueña espera del interruptor, y un menú donde todo está agotado parece un local cerrado |
  | Secciones vacías | No se enseñan | Un recuadro con título y nada debajo parece la página a medio cargar. Pasó con «Bebidas de Temporada», creada vacía |
  | Todo apagado | `/menu` lo dice con una frase; no deja el titular solo | Es un estado alcanzable de verdad desde el panel |
  | Un favorito apagado | En **su** ficha de favoritos sí se ve, con «Agotado hoy» y sin botón de pedir | Es suyo y lo guardó; ocultarlo sin explicación haría creer que se borró |
  | Retirar (`archivado`) | Sin cambios | Sigue siendo la retirada indefinida, y no se borra por los favoritos que lo apuntan |

- **Alternativas consideradas:** dejar el rótulo «Agotado» y enseñar a usar «Retirar». Se descarta porque obliga a distinguir dos conceptos para una sola intención, y porque el interruptor que ya se usó 41 veces debe hacer lo que parece que hace.
- **Consecuencias:** con los datos del 1 de agosto de 2026 la carta pasa a enseñar **un solo producto** (Matcha Clásico); volver a encender el resto es decisión de negocio y se avisa por escrito. Se pierde la forma de anunciar «hoy no hay matcha» sin quitarlo de la carta: si hiciera falta, será un estado propio y no un efecto lateral de la disponibilidad.

### DEC-011 — «Coffee Party»: la carta del soft opening entra como sección propia

- **Estado:** aprobada (petición escrita del dueño, 2026-08-01: «quiero agregar al menu este pero la seccion de este menu se llamara Coffee Party usa los nombres precios y especificciones que vez en el menu», con el flyer adjunto)
- **Contexto:** el flyer oficial del soft opening («SOFT OPENING PRESENTS — Coffee Party») lista once filas con precios propios. El flyer viñetea casi todas, pero las viñetas **no significan lo mismo** en cada fila, y esa es toda la decisión de modelado.
- **Decisión:**

  | Punto | Decisión | Por qué |
  |---|---|---|
  | Vehículo | Migración `0024`, no el panel | Son 11 productos y 15 variantes de una tirada: a mano son ~40 formularios y ningún sitio donde revisar antes de que salga a la carta pública. Aquí queda versionado y con una prueba que reconstruye cada precio contra el flyer |
  | Viñetas que **describen** (Rolls, Dupleta) | `nota_es`/`nota_en` | Los tres rolls del trío vienen los tres; no hay nada que elegir |
  | Viñetas que **eligen** al mismo precio (Donas, Coffee Bar) | Variantes etiquetadas | En `/pedir` cada variante es un botón —«Nutella · 4.75»—, que es literalmente la forma de pedir un sabor |
  | Matcha Bar | **Cinco productos**, no cinco variantes | Cada bebida trae ingredientes distintos y una variante solo lleva etiqueta y precio: no tiene dónde guardar «cold foam, matcha, oat milk, puré de fresa» |
  | Nombres del Matcha Bar | «Matcha Vanilla», no «Vanilla» | En el flyer la palabra la pone la cabecera de encima. En un carrito no hay cabecera: la línea diría «Vanilla», y en la comanda eso no es una bebida, es un adjetivo |
  | Posición | `orden = 0` | Cabe delante sin renumerar las nueve que ya estaban. Y va delante porque es el evento que está pasando: bajo «Para Llevar (pronto)» no la vería quien viene al soft opening |
  | `precioDeCarta` | Deja de repetir el mismo precio | Con variantes de sabor la carta anunciaba «4.75 / 4.75 / 4.75», que se lee como catorce dólares. Ningún producto de la carta original tiene dos tamaños al mismo precio, así que no cambia nada de lo anterior |
  | Fotos | Ninguna | El flyer trae fotos pero no están en `public/brand/originals/`. `docs/11`: el asset que falta se lista y se para. Se asignan desde el panel (botón FOTO) en cuanto entren |
  | `catalogo-fidelidad` | Pasa a validar **las nueve secciones de `MENU`**, no la tabla entera | Desde `0023` la dueña añade secciones desde el panel. Exigir que no haya nada más convierte el test en una alarma que salta cada vez que alguien hace su trabajo — la forma más rápida de enseñar a ignorar un test rojo. Las dos reglas que sí son del modelo (slug derivado del nombre, slug sin repetir) siguen comprobándose sobre **todo** el catálogo |

- **Alternativas consideradas:** sembrar «Espresso», «Iced Latte» y «Cortadito» como productos sueltos del Coffee Bar. Descartado: `menu_productos.slug` es único global y `espresso` e `iced-latte` **ya existen** en la carta base a $2.75 y $7.25. Habrían sido dos productos casi iguales con precios muy distintos, y el segundo con nombre retorcido para esquivar la colisión. Una sola fila «Coffee Bar» con las tres opciones dentro dice lo mismo que el flyer y no ensucia el catálogo.
- **Relación con DEC-010:** los once productos nacen **disponibles**, así que la carta pública deja de enseñar un solo producto. No es el arreglo de DEC-010 —volver a encender el resto sigue siendo decisión de negocio— pero sí significa que `/menu` vuelve a tener algo que enseñar sin que nadie toque un interruptor.
- **Consecuencias / a confirmar con la dueña:**
  - El Coffee Bar queda a **$8.95 c/u** tal y como está impreso, incluido el espresso, que en la carta base son $2.75. Es precio de evento; si es una errata del flyer se corrige desde el panel sin desplegar.
  - El flyer rotula «Pan dulce» también bajo la Dupleta, debajo de las empanadas. Se ha dejado **solo** en los Rolls por parecer un arrastre de maquetación; si es intencionado, se añade desde el panel.
  - El Matcha Bar del flyer se solapa con la sección «Barra de Matcha» que ya estaba (Fresa Glow ≈ Strawberry, Mango Radiance ≈ Mango, Plátano Mellow ≈ Banana & Honey). Conviven a propósito: nombres, precio y descripción son los del flyer. Si se prefiere una sola, se archiva la otra desde el panel.
  - «¡Mas!» del Coffee Bar no se sembró como producto; queda como nota de la fila («Y más en barra»).

### DEC-012 — El icono de la app es el isotipo, no el logotipo entero

- **Estado:** aprobada (petición escrita del dueño, 2026-08-01: «ocupo q el favicon pongas el logo de siembra»)
- **Contexto:** `src/app/favicon.ico` era el icono por defecto de Next.js. La marca no aparecía en ninguna pestaña, ni al guardar la web en la pantalla de inicio de un móvil.
- **El conflicto:** `docs/11` dice **«no recortar logos»**, y el logotipo oficial mide 2483 × 1164 — 2,13 a 1. Un icono es cuadrado. Metido entero ahí, «SIEMBRA» ocuparía 32 × 15 píxeles: no sería el logo pequeño, sería una mancha marrón. Cumplir la regla al pie de la letra habría producido exactamente lo que la regla existe para evitar.
- **Decisión:**

  | Punto | Decisión | Por qué |
  |---|---|---|
  | Qué se pinta | El **isotipo**: el sol con el grano de café | Es el elemento que la marca ya usa como sello, y es lo único que sobrevive a 32 píxeles |
  | Cómo se recorta | Lo **mide** un script sobre el SVG rasterizado, no se escribe a ojo | Si el arte cambia, el encuadre cambia con él. Nadie vuelve a abrir un editor |
  | De dónde sale | `public/brand/logos/logo-beige.svg`, el vector oficial | Ni un trazo redibujado: es reencuadre y cambio de color, ambos sobre el arte original |
  | Colores | Grano oat `#FFD89E` sobre espresso `#45200A` | Pareja del Brand Book. Un cuadrado macizo se ve igual sobre una barra de pestañas clara que sobre una oscura, cosa que un fondo transparente no puede prometer |
  | El de 16 px | Solo el **grano** | A ese tamaño los rayos miden menos de un píxel: no se ven finos, se ven como un borrón. Un `.ico` admite arte distinto por tamaño justamente para esto |
  | Ficheros | `favicon.ico` (16/32/48), `icon.png` (512), `apple-icon.png` (180) | Next los enlaza solo por estar en `src/app/`. El de iOS va con fondo macizo y sin redondear: el sistema recorta las esquinas él |

- **Alternativas consideradas:** meter el logotipo completo centrado en el cuadrado, sin recortar nada. Se descarta porque el resultado es ilegible a cualquier tamaño real de pestaña — respetaría la letra de `docs/11` y traicionaría su motivo, que es que el arte de marca se vea como debe verse.
- **Consecuencias:** `docs/11` queda actualizado con la excepción y con el comando (`npm run icons`). Los iconos son **derivados versionados**: se commitean generados, pero nadie los edita a mano; se regeneran desde el SVG.

## Plantilla

```md
### DEC-XXX — Título
- Estado: propuesta / aprobada / rechazada
- Contexto:
- Decisión:
- Alternativas consideradas:
- Consecuencias:
- Aprobación:
```

Claude no puede autoaprobar decisiones que alteren diseño, stack, datos financieros o seguridad.
