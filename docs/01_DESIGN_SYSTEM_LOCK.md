# 01 — Design System Lock

## Personalidad

Natural, auténtica, tropical, premium, revitalizante y centrada en bienestar. La voz es cercana, optimista, serena y con intención.

## Paleta autorizada

Usa únicamente variables declaradas en `config/design-tokens.json`.

Colores oficiales principales:

- Terracota `#CB3700`
- Mustard `#D08F29`
- Avena `#FFD89E`
- Leche `#F4ECE3`
- Espresso `#45200A`
- Tea Tree `#B5CB97`
- Matcha `#B7B542`
- Olive `#627016`
- Light Matcha `#9EA65C`
- Forest `#0E3117`

No agregar hex improvisados. Para opacidad usa `color-mix`, alpha o variables derivadas documentadas.

## Tipografía

Orden oficial:

1. **The Seasons** para momentos editoriales/hero, únicamente si el proyecto cuenta legalmente con la fuente.
2. **Droid Serif** para títulos y fallbacks editoriales.
3. **Poppins** para UI, formularios, navegación y cuerpo.

No compartir ni subir archivos de fuentes desde este kit. Si The Seasons no está disponible, usar Droid Serif; no reemplazarla silenciosamente por otra fuente.

## Fotografía

- Cálida, real, cercana y táctil.
- Luz natural, sombras de hojas y materiales orgánicos.
- Ritual de café/matcha, comunidad y pausa.
- Usar los assets suministrados.
- No usar fotos genéricas, stock remoto ni nuevas imágenes IA.

## Composición

- Fondos Leche/Avena como base.
- Terracota para CTAs y bloques de energía.
- Forest/Olive para membresía, footer y módulos de balance.
- Espresso para texto principal.
- Alternancia editorial de texto + fotografía.
- Líneas botánicas delicadas, sin saturar.
- Cards con borde fino y sombra mínima.
- Espaciado generoso, pero no vacío.

## Dimensiones base

- Content max width: 1280px.
- Desktop gutters: 32–48px.
- Tablet gutters: 24px.
- Mobile gutters: 16–20px.
- Form controls: 48–52px de altura.
- Botón principal: mínimo 48px de altura.
- Radio normal: 10–16px.
- Shadow: suave y cálida; nunca glow.

## Prohibiciones detectables

- `linear-gradient` o `radial-gradient` salvo textura aprobada documentada.
- `backdrop-blur`.
- `rounded-3xl` o radios de 28px+.
- Colores Tailwind blue, indigo, violet, purple, cyan, teal, pink.
- Imágenes externas.
- Tipografías Inter, Roboto, Playfair o Montserrat como reemplazo final de marca.
- Emojis como iconografía de UI.
