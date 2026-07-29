# SIEMBRA — Instrucciones obligatorias para Claude Code

Estas reglas son contrato del proyecto. No son sugerencias.

@docs/00_PRODUCT_CONTRACT.md
@docs/01_DESIGN_SYSTEM_LOCK.md
@docs/02_SCREEN_AND_ROUTE_SPECS.md
@docs/03_BACKEND_ARCHITECTURE.md
@docs/04_DATABASE_AND_LEDGER_RULES.md
@docs/05_API_CONTRACTS.md
@docs/06_SECURITY_AND_PAYMENTS.md
@docs/07_TESTING_AND_VISUAL_GATES.md
@docs/08_IMPLEMENTATION_PLAN.md
@docs/09_DECISION_LOG.md
@docs/10_DEFINITION_OF_DONE.md
@docs/11_ASSET_MANIFEST.md
@docs/15_BRAND_BOOK_REFERENCE.md

## 1. Autoridad y prioridad

Orden de autoridad cuando exista cualquier conflicto:

1. Mockups aprobados en `design-references/` para composición, jerarquía y flow.
2. Brand Book oficial en `brand-reference/Siembra-Brand-Book-Official.pdf` para identidad, logo, paleta, voz, fotografía y tipografía.
3. `config/design-tokens.json` para valores implementables.
4. Especificaciones de producto y backend en `docs/`.
5. Código existente que ya cumple las reglas anteriores.

Nunca priorices preferencias genéricas, tendencias de UI, librerías o “mejoras” propias por encima de estas fuentes.

## 2. Regla de diseño inmutable

NO REDISEÑAR.

No cambiar layout, jerarquía, densidad, paleta, estilo fotográfico, forma de los bloques, proporción de imágenes, navegación, lenguaje visual ni personalidad de la marca sin aprobación escrita del usuario.

Está prohibido:

- Inventar una nueva dirección visual.
- Usar colores fuera de los tokens autorizados.
- Usar azul, púrpura, neón, glassmorphism o gradientes SaaS.
- Usar `backdrop-blur`, cards flotantes genéricas o sombras exageradas.
- Usar imágenes de Unsplash, placeholders remotos o imágenes generadas nuevas.
- Sustituir assets SIEMBRA por íconos o fotos genéricas.
- Agregar secciones solo para “llenar espacio”.
- Cambiar la marca a una estética tecnológica, corporativa o de dashboard genérico.
- Aplicar bordes redondeados excesivos. Radio máximo normal: 16px; usar 24px solo si el mockup lo exige.
- Introducir tipografías no autorizadas.

Si falta un asset o una decisión visual, DETENTE y pregunta. No inventes.

## 3. Regla de implementación

Antes de editar código debes:

1. Leer todos los documentos importados.
2. Auditar el repositorio y los assets.
3. Crear una matriz: requisito → ruta → componente → tabla/API → prueba.
4. Declarar cualquier ambigüedad.
5. Presentar el plan de la fase actual.

Solo después de aprobación puedes implementar.

## 4. Regla de alcance

Implementa únicamente la fase autorizada. No aproveches para refactorizar módulos no relacionados, cambiar dependencias, renombrar rutas o “limpiar” estilos fuera del alcance.

## 5. Regla de datos financieros

- Nunca uses `float` para dinero. Usa enteros en centavos.
- Nunca permitas que el cliente escriba balances, puntos o estados de pago.
- Todo cambio de saldo debe crear una entrada inmutable en un ledger.
- Todo webhook y operación financiera debe ser idempotente.
- Stripe confirma pagos por webhook; la página de éxito nunca acredita fondos.
- Los códigos completos de gift card nunca se guardan en texto plano.
- Las claves `service_role`, Stripe secret y Resend secret nunca llegan al navegador.

## 6. Regla de seguridad

- Todas las tablas expuestas deben tener RLS.
- Un usuario solo puede leer o actualizar su propia información permitida.
- Operaciones de wallet, gift cards, puntos y ajustes administrativos se ejecutan server-side.
- Toda acción administrativa requiere rol verificado, motivo y audit log.
- No uses metadata editable por el usuario para autorización.

## 7. Regla de calidad

No declares una tarea terminada hasta ejecutar y reportar:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:visual
npm run validate:design
npm run build
```

Si algún comando no existe, créalo durante la fase de foundation.

## 8. Regla de reporte final

Cada entrega debe incluir:

- Archivos cambiados.
- Requisitos completados.
- Pruebas ejecutadas y resultados.
- Capturas desktop y mobile.
- Diferencias conocidas respecto al mockup.
- Riesgos o tareas pendientes.

No ocultes fallos. No uses frases como “debería funcionar” sin evidencia.
