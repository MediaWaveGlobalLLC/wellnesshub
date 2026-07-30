<!--
  Documento de decision, NO de implementacion. Producto de una investigacion
  con verificacion adversarial: cada dato que no venia de documentacion oficial
  de Clover paso por un agente que intento refutarlo antes de entrar aqui.

  La seccion 6 es la mas importante. Nada de lo que esta ahi debe darse por
  cierto al hablar con la duena ni al planificar.

  Fecha de la investigacion: 30 de julio de 2026.
-->

# Pedidos online para SIEMBRA: qué hacer con Clover

*(Documento de decisión. Nada aquí compromete código todavía.)*

---

## 1. Cómo funciona esto de verdad

Lo primero que hay que sacarse de la cabeza es que "integrar con Clover" sea una sola cosa. Clover no es *una* API: es un ecosistema con **cinco puertas de entrada distintas**, cada una con su propia llave, su propio costo y su propio dueño.

La **puerta 1** es el producto ya empaquetado: *Clover Online Ordering*. Es una página de pedidos que Clover genera sola. Está funcionando hoy en Puerto Rico (verificamos en vivo comercios boricuas reales operando con él). Su problema no es técnico, es de marca: la página vive en `clover.com/online-ordering/tu-negocio`, el encabezado es verde Clover **con el logo de Clover**, y el logo de SIEMBRA aparece como una miniatura cuadrada al lado del nombre. Y no se puede "meter dentro" de siembra en un iframe: comprobamos la cabecera de seguridad del sitio (`frame-ancestors`) y el navegador lo bloquea. O sea: la única forma de usarlo es mandar al cliente fuera, a clover.com.

La **puerta 2** son apps de terceros del App Market de Clover (Smart Online Order, OrderEm, Ogent). Prometen marca propia, pero son cajas negras: ninguna publica precio, casi toda la información disponible es material de venta de ellos mismos, y el plugin oficial de la más citada es para WordPress, no para Next.js. La **puerta 3** es la *Platform API*: la que permite **escribir un pedido dentro de la caja del local**, con los productos y modificadores reales del inventario, y mandar a imprimir la comanda. La **puerta 4** es la *Ecommerce API / Hosted Checkout*: cobrar con Clover. Y la **puerta 5** es no tocar Clover en absoluto: construir el pedido en el sitio de SIEMBRA y que el barista lo teclee en el Clover como cualquier otra venta.

Lo importante: **las puertas 3 y 4 no son gratis de abrir, y hoy no sabemos si están abiertas para SIEMBRA.** Dependen de dos cosas que nadie ha verificado todavía. Primera: el **plan de software** que la dueña tiene contratado. Clover documenta oficialmente que los planes de entrada (Payments / Payments Plus) solo soportan apps "que no requieran datos de órdenes ni de items" — traducido: si su plan es de esos, la puerta 3 está tapiada y el proyecto de integración real no existe hasta que suba de plan. Segunda: **cómo se autentica el código**. La documentación de Clover se contradice consigo misma en este punto — su FAQ de OAuth recomienda usar un "token generado por el comercio" para integraciones de un solo negocio como esta, pero la guía de tokens dice que producción debe usar OAuth. Y OAuth exige registrar una app y **pasarla por aprobación de Clover, sin plazo publicado** (Clover dice literalmente que los tiempos "varían"). Esas dos incógnitas son la razón por la que este documento recomienda lo que recomienda.

---

## 2. Las opciones reales

| Opción | Esfuerzo | Costo | Control del diseño | Qué se pierde |
|---|---|---|---|---|
| **A. Clover Online Ordering nativo** (poner un botón que saque al cliente a clover.com) | Horas. Lo activa ella, no nosotros | Sin cuota separada, **pero viene incluido en planes de restaurante de pago** (los precios que circulan se contradicen entre sí, ver §6). Cada pedido paga tarifa "tarjeta no presente", reportada en ~3.5% + $0.10 | **Ninguno.** Header verde Clover, logo de Clover, tipografía de Clover, avisos en inglés | El wallet, las gift cards y los puntos. Clover no los ve ni los verá nunca. El cliente sale de siembra. El dato de quién compra qué se queda en Clover |
| **B. App de terceros del App Market** (Smart Online Order, OrderEm, Ogent) | Semanas, y depende de un vendedor externo | Desconocido. **Ninguno publica precio** | Parcial. Prometen marca propia, pero no lo verificamos | Control. Es otra caja negra más entre SIEMBRA y su cliente. Tampoco integra el wallet ni los puntos |
| **C. Integración completa con la API de Clover** (menú espejado desde el inventario, pedido escrito en la caja, comanda impresa) | **Meses**, y con dos bloqueos que hoy no sabemos resolver | Desarrollo alto + posible subida de plan de Clover | **Total.** El cliente nunca sale de siembra | Tiempo y certeza. Depende de aprobación de Clover, del plan de la dueña, y de una pregunta legal sin respuesta (§4). Puede terminar en "no se puede" después de invertir semanas |
| **D. Motor propio, cobrando en el mostrador** (pedido en siembra → pantalla en el local → el barista lo teclea en el Clover) | **Días** | Cero costo nuevo. La venta entra por el Clover como venta presencial normal | **Total** | La automatización. El barista teclea dos veces. El menú vive en dos sitios (el POS y el código) |
| **E. Motor propio + prepago con el Stripe que ya existe** | D + ~1 semana | Comisión Stripe (~2.9% + $0.30), sobre infraestructura ya construida y probada | **Total** | Igual que D, más una pregunta de política que hay que hacerle a Clover por escrito antes de encenderlo |

---

## 3. Mi recomendación

**D primero, E después. Y C solo si —y cuando— se despejen los bloqueos.**

Concretamente: construir el motor de pedidos **dentro del sitio de SIEMBRA**, con Clover completamente fuera del camino crítico en la primera versión. El cliente pide en `/ordena`, el pedido cae en Supabase, y aparece en menos de un segundo en una tablet detrás de la barra con sonido hasta que alguien lo acepta, más un correo de respaldo por si la tablet muere. El barista lo teclea en el Clover como cualquier otra venta y cobra en el mostrador. Fase dos, encima de eso y sin rehacer nada: prepago con el Stripe que ya está funcionando para las gift cards.

**Por qué esta y no otra, en orden de peso:**

1. **Puede estar recibiendo pedidos reales en días, no en meses.** No espera respuesta de Clover, ni aprobación de app, ni token, ni cambio de plan. Las opciones B y C dependen de terceros que no controlamos y que no dan fechas.
2. **Es la única que no puede quedar bloqueada.** Si mañana Clover dice que no a todo, este sistema sigue funcionando igual. La integración con la caja pasa a ser un lujo posterior, no un requisito.
3. **Es la única que conecta el pedido con lo que ya construimos.** El wallet en dólares, los puntos y las gift cards ya existen en la base de datos de SIEMBRA. Ninguna de las otras opciones los ve. Ese es literalmente el valor diferencial del sitio frente a mandar al cliente a clover.com — y si no lo usamos, la pregunta honesta es por qué no usar simplemente la opción A y ahorrarse todo.
4. **Fiscalmente es la más limpia, no la más sucia.** En la fase D la venta la teclea el barista en el mismo Clover de siempre: pasa por el terminal fiscal exactamente igual que si el cliente hubiera entrado por la puerta. Una integración por API que crea pedidos por fuera del flujo normal es *más* riesgosa en ese aspecto, no menos.
5. **Y deja la puerta abierta.** Las tablas de pedidos se construyen desde el día uno con dos campos vacíos reservados para el ID de la orden en Clover. El día que se despejen los bloqueos, se enchufa la sincronización por detrás sin tocar nada de lo que ve el cliente.

**Lo que estoy aceptando a cambio, dicho sin adornos:** el barista teclea dos veces. Con 5 o 10 pedidos al día eso es trivial. Con 60 al día es insostenible y obliga a la integración real. Ese es el umbral, y hay que decírselo a la dueña **antes** de empezar, no después. Y el precio va a vivir en dos sitios (el POS y el código del sitio), así que si ella sube el precio del latte en la caja y nadie avisa, el sitio cobra de menos. Eso no se arregla con código en esta fase; se arregla con proceso.

**Lo que hay que decirle claro y que no le va a gustar:** en esta fase **no sale el papelito solo**, como en DoorDash. Alguien tiene que mirar la tablet. Por eso el sistema incluye, obligatoriamente, un "latido": si la tablet lleva 3 minutos sin dar señales de vida, el sitio **deja de aceptar pedidos automáticamente** y avisa. Un pedido que entra y nadie ve es el único fallo verdaderamente inaceptable aquí, y prefiero apagar la tienda sola que dejar a un cliente esperando un café que nadie está haciendo.

---

## 4. El punto espinoso: qué pasa con el wallet, las gift cards y los puntos si el cobro se va a Clover

Esto hay que entenderlo bien porque es la parte que decide todo lo demás.

**Si el cobro se va a Clover, el wallet, las gift cards y los puntos quedan fuera del pedido online. Punto.** No es una limitación que se pueda programar alrededor. Clover cobra el total de la transacción y no tiene ni idea de que existe una base de datos en Supabase con $40 de crédito a nombre de un cliente. La página de pago de Clover no puede preguntarle a nuestro sistema cuánto crédito aplicar antes de cobrar.

Hay razones técnicas concretas además de esa. Revisando la documentación se encontró que el *Hosted Checkout* de Clover **no acepta el identificador de una orden existente**, y la propia documentación de Clover dice que esas sesiones de pago "no están vinculadas al inventario del comercio". O sea que si se cobra por ahí, Clover crea *su propia* venta con líneas sueltas, sin conexión con los productos reales — que es exactamente el escenario que Clover documenta como problemático para imprimir la comanda y para que aparezca bien en la caja. Encima, los tokens necesarios para esa vía (*Ecommerce API Tokens*) **no están confirmados para Puerto Rico**: la documentación de regiones de Clover nombra Estados Unidos y Canadá sin aclarar si los territorios entran.

Lo único que se podría hacer sería aplicar el crédito **como descuento** antes de mandar el total a Clover. **Eso es contablemente incorrecto y no lo debemos hacer.** Una gift card ya vendida no es una rebaja: es dinero que el negocio ya cobró y que ahora debe. Aplicarla como descuento reduce la base imponible de una venta que en realidad se hizo por su valor completo, y descuadra tanto el registro de ventas como el IVU. La forma correcta —si algún día se integra— es registrar el crédito como una **línea de pago separada** ("Crédito SIEMBRA / Gift Card") sobre la orden en Clover, usando el endpoint que Clover documenta para pagos externos "con fines contables". Así la venta se registra completa, con su impuesto completo, y el crédito aparece como lo que es: un medio de pago.

**Traducción para la dueña:** si el pago se va a Clover, todo el sistema de crédito y lealtad que ya está construido se convierte en algo que solo funciona cuando el cliente viene físicamente al local. Vale la pena o no vale la pena, pero es una decisión de negocio, no un detalle técnico. Mi lectura: si el crédito y los puntos no entran en el pedido online, entonces construir un motor de pedidos a medida deja de justificarse, y lo honesto sería usar el Clover Online Ordering nativo (opción A) y ahorrarse el desarrollo completo.

---

## 5. Lo que hace falta antes de escribir una línea de código

**Bloqueantes de verdad (sin esto no arrancamos):**

1. **Una tablet o iPad dedicado en el local**, con wifi estable y enchufado todo el día, para la pantalla de pedidos. Sin esto no hay proyecto.
2. **El menú real de hoy, con sus precios de hoy.** El menú del sitio salió de un PDF y puede estar desfasado. Hay que cotejarlo producto por producto.
3. **Definir la operación:** horario de pedidos online, tiempo de preparación por defecto (15 min, 20 min), y cuántos pedidos aguanta el barista por cada franja de 15 minutos.
4. **Decidir qué se puede pedir online y qué no.** Mi recomendación: empezar solo con café y bebidas. Dejar fuera lo que requiere cocina lenta hasta que el flujo esté rodado.
5. **Compromiso por escrito de la regla operativa:** todo pedido online se teclea en el Clover. Si no se cumple, se descuadra el cierre de caja y el IVU.
6. **Compromiso de avisar cada cambio de precio** mientras no exista la integración.

**Decisiones de negocio (antes de la fase de prepago):**

7. **¿Cobrar por adelantado o en el mostrador?** Cobrar antes = menos plantones, pero comisión y dinero que entra por Stripe y no en el depósito de Clover. Cobrar en el mostrador = cero riesgo y cero comisión extra, pero pedidos que nadie recoge. Esto lo decide ella, y su contable debe estar de acuerdo.
8. **Consultar con su contable** cómo se maneja el IVU y el número de Control IVU de un pedido cobrado en línea que no pasa por el terminal fiscal, y si eso toca su certificado de tasa reducida de alimentos preparados. **Nosotros no podemos responder eso y no lo vamos a inventar.**

**Preguntas baratas que abren o cierran la puerta a la integración futura (10 minutos, cero costo):**

9. **¿Qué plan de software de Clover tiene contratado?** Nombre exacto, desde su Clover Dashboard. Si es Payments o Payments Plus, la integración real no existe sin subir de plan.
10. **¿Aparece "API tokens" en su dashboard?** Settings → View all settings → sección Business Operations. Una captura de pantalla responde en un minuto si la integración se puede hacer sin pasar por el proceso de aprobación de app de Clover.
11. **¿Quién le vendió el Clover?** El banco, ISO o revendedor. De eso dependen sus tarifas reales y a quién hay que llamar cuando algo falla.
12. **Una foto de su factura mensual de Clover.** Es el único número autoritativo sobre lo que paga (ver §6).

---

## 6. Lo que NO se pudo confirmar

Lista completa y sin filtrar. Todo lo de abajo es incertidumbre real, no cautela decorativa.

- **Ningún precio de Clover está confirmado oficialmente.** Las páginas de precios de clover.com se generan con JavaScript y no devolvieron contenido. Todos los montos que circulan vienen de terceros **que se contradicen entre sí**: el mismo plan "Essentials" aparece a $14.95, $29.95 y $49.95 según la fuente; una fuente llama "legacy" (descontinuados) a planes que otra lista como vigentes; el mismo mes, dos sitios dan el doble de precio uno del otro para el mismo producto. **Estructuralmente no puede haber un precio único**: Clover se vende por revendedores y cada uno pone el suyo. Cualquier cifra en dólares en este documento es orden de magnitud, nunca compromiso.
- **La tarifa de 3.5% + $0.10 para pagos online** es consistente en varias fuentes recientes (nov-2025 a jun-2026), pero **ninguna es Clover**. Y son tarifas de compra directa; las de SIEMBRA dependen de su adquirente.
- **No está confirmado si un comercio de producción puede generar un token de API desde su dashboard.** La documentación oficial de Clover se contradice a sí misma: su FAQ de OAuth lo recomienda para casos como este, su guía de tokens dice que producción debe usar OAuth. Guías de terceros de 2025 describen la ruta en producción, pero no lo verificamos en vivo. **Esta es la incógnita más importante del proyecto.**
- **No está confirmado que a un comercio de Puerto Rico se le emitan tokens de la Ecommerce API.** La documentación de regiones de Clover nombra "United States and Canada" sin aclarar territorios. El producto de pedidos **sí** funciona en PR (verificado en comercios reales), pero eso no prueba lo otro.
- **No hay plazo publicado de aprobación de apps.** Clover dice textualmente que "varían". No se le puede prometer una fecha a nadie por esa vía.
- **No sabemos si cobrar con Stripe en el sitio propio de SIEMBRA viola las políticas de Clover.** Clover documenta que "todo procesamiento de pagos debe implementarse dentro de las plataformas de Fiserv o Clover", pero esa política está escrita **para apps del App Market**, y el sitio de SIEMBRA no es una app de Clover. Es zona gris. **Hay que preguntárselo a Clover Developer Relations por escrito antes de encender el prepago.** En la fase de cobro en mostrador el punto ni se plantea.
- **No se pudo confirmar cómo trata Hacienda un pedido en línea** que no pasa por el terminal fiscal, ni si afecta el certificado de tasa reducida. Pregunta para su contable.
- **No pudimos ver un checkout real de Clover en vivo:** los dos comercios de PR que abrimos estaban cerrados. La lista de tipos de entrega (pickup, curbside, delivery) viene del blog de Clover, no de observación directa. La tarifa de $6.99 de delivery viene de un post **sin fecha visible**, probablemente de 2021 — trátala como obsoleta hasta confirmar.
- **No pudimos verificar precio, calidad ni disponibilidad en PR de ninguna app de terceros** (Smart Online Order, OrderEm, Ogent). Ninguna publica precio y casi toda la información es material de venta propio.
- **No pudimos acceder al Help Center oficial de Clover** sobre pedidos online: las URLs devolvieron error o exigen login de comerciante. Todo lo que sabemos sobre configuración viene del blog de Clover o de terceros.
- **No está confirmado que Clover Online Ordering permita subir logo grande o cambiar colores.** Lo que sí sabemos, por captura de pantalla propia de comercios boricuas reales, es que **en la práctica no ocurre**: el header es de Clover. Los resultados sobre "dominio personalizado" que aparecen en búsquedas corresponden a *otro* producto distinto de Clover (la tienda retail), no al de restaurante. No hay que mezclarlos.
