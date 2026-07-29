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
