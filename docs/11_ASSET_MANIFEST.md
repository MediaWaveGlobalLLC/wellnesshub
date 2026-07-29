# 11 — Asset Manifest

## Referencias de pantalla bloqueadas

- `design-references/01-registro-reference.png`
- `design-references/02-perfil-reference.png`
- `design-references/03-wallet-giftcards-reference.png`
- `design-references/04-home-brand-direction-reference.png`

No editar estas imágenes. Son evidencia visual.

## Assets de marca autorizados

- `bag-terracotta.png`
- `bag-olive.png`
- `napkins-light-matcha.png`
- `napkins-terracotta.png`
- `puerto-rico-coffee-beans.png`
- `iced-matcha-splash.png`
- `coffee-matcha-splash-duo.png`
- `hot-coffee-cup.png`
- `iced-matcha-cup.png`
- `terracotta-coffee-mug.png`
- `glass-iced-matcha-mug.png`

Ubicación: `public/brand/originals/`.

## Uso

- No sobrescribir originales.
- Crear derivados optimizados en `public/brand/optimized/`.
- Mantener transparencia y proporciones.
- Usar `next/image` cuando aplique.
- Registrar cada derivado en un manifest generado.
- No recortar logos ni reescribirlos con texto HTML para simular el arte.

## Asset faltante

Si el diseño exige un asset que no existe, Claude debe listar el asset faltante y detener esa sección. No puede fabricar un sustituto.

## Brand Book oficial protegido

- `brand-reference/Siembra-Brand-Book-Official.pdf`

No modificar ni sustituir. Consultar `docs/15_BRAND_BOOK_REFERENCE.md`.

## Archivos que existen en disco pero NO se versionan

**Este repositorio es público.** El Brand Book, los archivos maestros editables y
las presentaciones de negocio son propiedad del cliente y no pueden publicarse.
Además superan el límite de 100 MB por archivo de GitHub.

Están en `.gitignore` y deben copiarse a mano para que `npm run validate:design`
pase en un clon nuevo:

| Ruta | Origen | Por qué no se versiona |
|---|---|---|
| `brand-reference/Siembra-Brand-Book-Official.pdf` | `Siembra_Claude_Code_Design_Lock_Kit/` | 68 MB · propiedad del cliente |
| `design-references/Siembra *.psd`, `*.ai` | `Siembra Branding Oficial/` | archivos maestros editables |
| `design-references/Presentaciones/` | `Siembra Branding Oficial/` | **propuesta municipal confidencial** (331 MB) |
| `evidencia/` | generado por `scripts/capture-evidence.mjs` | capturas de revisión, regenerables |

Sí se versionan los 4 mockups de pantalla (`01`–`04`), porque el gate visual los
necesita y son referencias derivadas, no material fuente.

> Si el repositorio pasa a privado, revisar esta decisión con el dueño del
> proyecto antes de versionar nada de lo anterior.
