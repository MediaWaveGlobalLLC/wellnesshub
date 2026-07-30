# 10 — Definition of Done

Una funcionalidad está terminada solamente si cumple todo lo siguiente.

## Diseño

- Coincide con la dirección del mockup en desktop y mobile.
- Usa únicamente tokens y assets aprobados.
- No tiene placeholders, fotos externas ni diseño genérico.
- Tiene estados loading, empty, error, success y disabled.
- Baseline visual aprobado o comparación documentada.

## Función

- Usa datos reales del backend.
- Tiene validación cliente y servidor.
- Maneja errores y reintentos.
- Tiene pruebas relevantes.
- No contiene TODO crítico.

## Seguridad

- Autenticación/autorización verificadas server-side.
- RLS probado.
- Secretos no expuestos.
- Operaciones financieras idempotentes y auditadas.

## Calidad

- Lint pasa.
- Typecheck pasa.
- Unit/integration pasan.
- E2E pasa.
- Visual pasa.
- Design validator pasa.
- Build production pasa.

## Evidencia

- Lista de archivos.
- Capturas.
- Resultados de comandos.
- Riesgos conocidos.
- Migraciones y variables de entorno documentadas.
