// @vitest-environment node
/**
 * Pedidos del menú (migración 0021).
 *
 * `orders` existía desde `0005` y solo se leía. Lo que se prueba aquí es lo
 * único que de verdad puede salir caro:
 *
 *  · que el precio lo ponga el servidor y no el carrito;
 *  · que un pedido se cobre una vez, no dos, ni con saldo ni con tarjeta;
 *  · que nadie pague ni recoja el pedido de otro;
 *  · que subir un precio no reescriba los tickets de ayer.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearBase, crearUsuario, leerFresco, type Db } from "./supabase-harness";

let db: Db;
let duena: string;
let empleado: string;
let ana: string;
let beto: string;

/** Latte a $6.25 y matcha a $8.75, como el menú oficial. */
let varLatte: string;
let varMatcha: string;
let prodLatte: string;

beforeAll(async () => {
  db = await crearBase();

  duena = await crearUsuario(db, { email: "duena@siembra.test", firstName: "Erika" });
  empleado = await crearUsuario(db, { email: "barra@siembra.test", firstName: "Barra" });
  ana = await crearUsuario(db, { email: "ana@siembra.test", firstName: "Ana" });
  beto = await crearUsuario(db, { email: "beto@siembra.test", firstName: "Beto" });

  await db.query("insert into public.admin_users (user_id, rol) values ($1, 'duena')", [duena]);
  await db.query("insert into public.admin_users (user_id, rol) values ($1, 'empleado')", [empleado]);

  const cat = await db.query<{ id: string }>(
    `insert into public.menu_categorias (slug, nombre_es, nombre_en, mundo, estado, orden)
     values ('pruebas', 'Pruebas', 'Tests', 'cafe', 'hoy', 99) returning id`
  );

  const latte = await db.query<{ id: string }>(
    `insert into public.menu_productos (categoria_id, slug, nombre, orden)
     values ($1, 'latte-prueba', 'Latte', 1) returning id`,
    [cat.rows[0]!.id]
  );
  prodLatte = latte.rows[0]!.id;

  const matcha = await db.query<{ id: string }>(
    `insert into public.menu_productos (categoria_id, slug, nombre, orden)
     values ($1, 'matcha-prueba', 'Matcha Clásico', 2) returning id`,
    [cat.rows[0]!.id]
  );

  const v1 = await db.query<{ id: string }>(
    `insert into public.menu_variantes (producto_id, etiqueta, precio_cents, orden)
     values ($1, '12 oz', 625, 1) returning id`,
    [prodLatte]
  );
  varLatte = v1.rows[0]!.id;

  const v2 = await db.query<{ id: string }>(
    `insert into public.menu_variantes (producto_id, etiqueta, precio_cents, orden)
     values ($1, null, 875, 1) returning id`,
    [matcha.rows[0]!.id]
  );
  varMatcha = v2.rows[0]!.id;
}, 120_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    delete from public.order_items;
    delete from public.orders;
    delete from public.wallet_transactions;
    delete from public.wallets;
    delete from public.loyalty_transactions;
    delete from public.loyalty_accounts;
    delete from public.stripe_webhook_events;
    delete from public.audit_logs;
  `);
  await db.query("update public.menu_variantes set precio_cents = 625 where id = $1", [varLatte]);
  await db.query("update public.menu_productos set disponible = true where id = $1", [prodLatte]);
});

const crearPedido = (
  userId: string,
  items: unknown[],
  intento: string | null = null,
  propina = 0
) =>
  db.query<{
    order_id: string;
    order_number: string;
    subtotal_cents: string;
    propina_cents: string;
    total_cents: string;
  }>("select * from public.crear_pedido($1, $2::jsonb, $3, $4)", [
    userId,
    JSON.stringify(items),
    intento,
    propina,
  ]);

async function darSaldo(userId: string, centavos: number, clave = `saldo-${userId}-${centavos}`) {
  await db.query("select * from public.apply_wallet_transaction($1,$2,'promotion',$3)", [
    userId,
    centavos,
    clave,
  ]);
}

const saldo = async (userId: string): Promise<number> => {
  const r = await leerFresco<{ balance_cents: string }>(
    db,
    "select balance_cents from public.wallets where user_id = $1",
    [userId]
  );
  return Number(r[0]?.balance_cents ?? 0);
};

const puntos = async (userId: string): Promise<number> => {
  const r = await leerFresco<{ points_balance: string }>(
    db,
    "select points_balance from public.loyalty_accounts where user_id = $1",
    [userId]
  );
  return Number(r[0]?.points_balance ?? 0);
};

describe("crear el pedido", () => {
  it("el total lo calcula el servidor con los precios del catálogo", async () => {
    const r = await crearPedido(ana, [
      { variante_id: varLatte, cantidad: 2 },
      { variante_id: varMatcha, cantidad: 1 },
    ]);

    // 625×2 + 875 = 2125. El carrito no dijo ni un precio.
    expect(Number(r.rows[0]!.total_cents)).toBe(2125);
    expect(r.rows[0]!.order_number).toMatch(/^P-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);

    const pedido = await leerFresco<{ status: string; channel: string }>(
      db,
      "select status, channel from public.orders"
    );
    expect(pedido[0]!.status).toBe("pendiente_pago");
    expect(pedido[0]!.channel).toBe("linea");
  });

  it("ignora cualquier precio que venga del cliente", async () => {
    /*
      El caso que justifica que el precio salga de la base: aunque el carrito
      mande un precio de un centavo, el pedido cuesta lo que cuesta.
    */
    const r = await crearPedido(ana, [
      { variante_id: varLatte, cantidad: 1, precio_cents: 1, total: 1 },
    ]);
    expect(Number(r.rows[0]!.total_cents)).toBe(625);
  });

  it("congela nombre, tamaño y precio en la línea", async () => {
    await crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }]);

    const linea = await leerFresco<{
      nombre: string;
      etiqueta_variante: string;
      precio_cents: number;
    }>(db, "select nombre, etiqueta_variante, precio_cents from public.order_items");

    expect(linea[0]!.nombre).toBe("Latte");
    expect(linea[0]!.etiqueta_variante).toBe("12 oz");
    expect(linea[0]!.precio_cents).toBe(625);
  });

  it("rechaza carritos imposibles", async () => {
    await expect(crearPedido(ana, [])).rejects.toThrow(/carrito_vacio/);
    await expect(
      crearPedido(ana, [{ variante_id: varLatte, cantidad: 0 }])
    ).rejects.toThrow(/cantidad_invalida/);
    await expect(
      crearPedido(ana, [{ variante_id: varLatte, cantidad: 21 }])
    ).rejects.toThrow(/cantidad_invalida/);
    await expect(
      crearPedido(ana, [{ variante_id: "00000000-0000-0000-0000-000000000000", cantidad: 1 }])
    ).rejects.toThrow(/producto_no_encontrado/);
  });

  it("no deja pedir lo que está agotado hoy", async () => {
    await db.query("update public.menu_productos set disponible = false where id = $1", [prodLatte]);
    await expect(
      crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }])
    ).rejects.toThrow(/producto_agotado/);
  });

  it("repetir el mismo intento no crea dos pedidos", async () => {
    const a = await crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }], "intento-1");
    const b = await crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }], "intento-1");

    expect(b.rows[0]!.order_id).toBe(a.rows[0]!.order_id);
    const pedidos = await leerFresco(db, "select id from public.orders");
    expect(pedidos).toHaveLength(1);
  });

  it("dos personas con el mismo identificador de intento no se pisan", async () => {
    await crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }], "mismo");
    await crearPedido(beto, [{ variante_id: varLatte, cantidad: 1 }], "mismo");
    const pedidos = await leerFresco(db, "select id from public.orders");
    expect(pedidos).toHaveLength(2);
  });
});

describe("pagar con saldo", () => {
  const pagar = (userId: string, orderId: string) =>
    db.query<{ order_number: string; saldo_restante: string; puntos_ganados: string }>(
      "select * from public.pagar_pedido_con_saldo($1,$2)",
      [userId, orderId]
    );

  async function pedidoDe(userId: string, cantidad = 2): Promise<string> {
    const r = await crearPedido(userId, [{ variante_id: varLatte, cantidad }]);
    return r.rows[0]!.order_id;
  }

  it("descuenta del saldo, cierra el pedido y da puntos", async () => {
    await darSaldo(ana, 5000);
    const id = await pedidoDe(ana); // 1250

    const r = await pagar(ana, id);

    expect(Number(r.rows[0]!.saldo_restante)).toBe(3750);
    // `por_dolar` da 1 punto por dólar: $12.50 → 12 puntos.
    expect(Number(r.rows[0]!.puntos_ganados)).toBe(12);

    expect(await saldo(ana)).toBe(3750);
    expect(await puntos(ana)).toBe(12);

    const pedido = await leerFresco<{ status: string; metodo_pago: string; paid_at: string }>(
      db,
      "select status, metodo_pago, paid_at from public.orders where id = $1",
      [id]
    );
    expect(pedido[0]!.status).toBe("pagado");
    expect(pedido[0]!.metodo_pago).toBe("wallet");
    expect(pedido[0]!.paid_at).not.toBeNull();
  });

  it("sin saldo suficiente no pasa nada de nada", async () => {
    await darSaldo(ana, 1249);
    const id = await pedidoDe(ana); // 1250

    await expect(pagar(ana, id)).rejects.toThrow(/saldo_insuficiente/);

    expect(await saldo(ana)).toBe(1249);
    const pedido = await leerFresco<{ status: string }>(
      db, "select status from public.orders where id = $1", [id]
    );
    expect(pedido[0]!.status).toBe("pendiente_pago");
  });

  it("no se paga dos veces", async () => {
    await darSaldo(ana, 5000);
    const id = await pedidoDe(ana);

    await pagar(ana, id);
    await expect(pagar(ana, id)).rejects.toThrow(/pedido_ya_pagado/);

    expect(await saldo(ana)).toBe(3750);
    const movs = await leerFresco(
      db,
      "select id from public.wallet_transactions where transaction_type = 'purchase'"
    );
    expect(movs).toHaveLength(1);
  });

  it("nadie paga el pedido de otro", async () => {
    await darSaldo(beto, 5000);
    const id = await pedidoDe(ana);
    await expect(pagar(beto, id)).rejects.toThrow(/pedido_ajeno/);
    expect(await saldo(beto)).toBe(5000);
  });

  it("los puntos no se dan dos veces aunque se reintente", async () => {
    await darSaldo(ana, 5000);
    const id = await pedidoDe(ana);
    await pagar(ana, id);

    // Segunda pasada directa a la función de puntos: no vuelve a acreditar.
    await db.query("select public.otorgar_puntos_pedido($1)", [id]);
    expect(await puntos(ana)).toBe(12);
  });
});

describe("pago por Stripe", () => {
  async function pedidoAtado(sessionId = "cs_pedido_1"): Promise<string> {
    const r = await crearPedido(ana, [{ variante_id: varLatte, cantidad: 2 }]);
    const id = r.rows[0]!.order_id;
    await db.query("select public.atar_sesion_stripe($1,$2,$3)", [ana, id, sessionId]);
    return id;
  }

  const confirmar = (eventId: string, sessionId = "cs_pedido_1") =>
    db.query<{ order_id: string; ya_procesado: boolean }>(
      "select * from public.marcar_pedido_pagado($1,'checkout.session.completed',$2)",
      [eventId, sessionId]
    );

  it("el webhook cierra el pedido y da los puntos", async () => {
    const id = await pedidoAtado();
    const r = await confirmar("evt_1");

    expect(r.rows[0]!.ya_procesado).toBe(false);
    const pedido = await leerFresco<{ status: string; metodo_pago: string }>(
      db, "select status, metodo_pago from public.orders where id = $1", [id]
    );
    expect(pedido[0]!.status).toBe("pagado");
    expect(pedido[0]!.metodo_pago).toBe("stripe");
    expect(await puntos(ana)).toBe(12);
  });

  it("un reintento de Stripe no vuelve a dar puntos", async () => {
    await pedidoAtado();
    await confirmar("evt_1");
    const repetido = await confirmar("evt_1");

    expect(repetido.rows[0]!.ya_procesado).toBe(true);
    expect(await puntos(ana)).toBe(12);
  });

  it("una sesión que no ata a ningún pedido no cobra nada", async () => {
    await expect(confirmar("evt_x", "cs_que_no_existe")).rejects.toThrow(/pedido_no_encontrado/);
  });
});

describe("el precio de ayer no cambia", () => {
  it("subir el latte no reescribe un pedido ya hecho", async () => {
    const r = await crearPedido(ana, [{ variante_id: varLatte, cantidad: 2 }]);
    await db.query("update public.menu_variantes set precio_cents = 900 where id = $1", [varLatte]);

    const pedido = await leerFresco<{ total_cents: string }>(
      db, "select total_cents from public.orders where id = $1", [r.rows[0]!.order_id]
    );
    const linea = await leerFresco<{ precio_cents: number }>(
      db, "select precio_cents from public.order_items"
    );

    expect(Number(pedido[0]!.total_cents)).toBe(1250);
    expect(linea[0]!.precio_cents).toBe(625);
  });

  it("un producto con pedidos detrás no se puede borrar", async () => {
    await crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }]);
    await expect(
      db.query("delete from public.menu_productos where id = $1", [prodLatte])
    ).rejects.toThrow();
  });
});

describe("la cola del mostrador", () => {
  async function pedidoPagado(): Promise<string> {
    await darSaldo(ana, 5000, `cola-${Math.floor(Date.now() / 1)}`);
    const r = await crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }]);
    const id = r.rows[0]!.order_id;
    await db.query("select * from public.pagar_pedido_con_saldo($1,$2)", [ana, id]);
    return id;
  }

  const avanzar = (actor: string, id: string, estado: string) =>
    db.query("select * from public.admin_pedido_avanzar($1,$2,$3)", [actor, id, estado]);

  it("el mostrador lo pasa a preparando y luego a entregado", async () => {
    const id = await pedidoPagado();

    const estado = () =>
      leerFresco<{ status: string; preparando_at: string | null; entregado_at: string | null }>(
        db,
        "select status, preparando_at, entregado_at from public.orders where id = $1",
        [id]
      );

    await avanzar(empleado, id, "preparando");
    let p = await estado();
    expect(p[0]!.status).toBe("preparando");
    expect(p[0]!.preparando_at).not.toBeNull();

    await avanzar(empleado, id, "entregado");
    p = await estado();
    expect(p[0]!.status).toBe("entregado");
    expect(p[0]!.entregado_at).not.toBeNull();
  });

  it("un pedido sin pagar no entra en la cola", async () => {
    const r = await crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }]);
    await expect(avanzar(empleado, r.rows[0]!.order_id, "preparando")).rejects.toThrow(
      /pedido_sin_pagar/
    );
  });

  it("no se entrega dos veces ni se retrocede", async () => {
    const id = await pedidoPagado();
    await avanzar(empleado, id, "entregado");
    await expect(avanzar(empleado, id, "entregado")).rejects.toThrow(/pedido_ya_entregado/);
    await expect(avanzar(empleado, id, "preparando")).rejects.toThrow(/pedido_ya_entregado/);
  });

  it("alguien de fuera del equipo no toca la cola", async () => {
    const id = await pedidoPagado();
    await expect(avanzar(beto, id, "preparando")).rejects.toThrow(/no_autorizado/);
  });

  it("la cola enseña las líneas de cada pedido", async () => {
    await pedidoPagado();
    const cola = await leerFresco<{ lineas: string; order_number: string }>(
      db,
      "select * from public.admin_pedidos_cola()"
    );
    expect(cola).toHaveLength(1);
    expect(cola[0]!.lineas).toContain("Latte");
  });
});

describe("propina — 0026_propina.sql", () => {
  /*
    La propina es el único importe del pedido que no sale del catálogo: la
    elige quien paga. Estas pruebas cubren lo que eso implica.

    Lo delicado no es sumarla, es dónde NO tiene que aparecer: los puntos se
    dan por lo que se compra. Dar puntos por la propina es pagarle a alguien
    por ser generoso con otra persona.
  */

  it("entra en el total y se guarda aparte del subtotal", async () => {
    // 2 lattes de 6.25 = 12.50, más 2.00 de propina.
    const r = await crearPedido(ana, [{ variante_id: varLatte, cantidad: 2 }], null, 200);

    expect(Number(r.rows[0]!.subtotal_cents)).toBe(1250);
    expect(Number(r.rows[0]!.propina_cents)).toBe(200);
    expect(Number(r.rows[0]!.total_cents)).toBe(1450);

    const fila = await leerFresco<{
      subtotal_cents: string;
      propina_cents: string;
      total_cents: string;
    }>(
      db,
      "select subtotal_cents, propina_cents, total_cents from public.orders where id = $1",
      [r.rows[0]!.order_id]
    );
    expect(Number(fila[0]!.subtotal_cents)).toBe(1250);
    expect(Number(fila[0]!.propina_cents)).toBe(200);
    expect(Number(fila[0]!.total_cents)).toBe(1450);
  });

  it("sin propina el pedido cuesta exactamente lo de antes", async () => {
    const r = await crearPedido(ana, [{ variante_id: varLatte, cantidad: 2 }]);
    expect(Number(r.rows[0]!.propina_cents)).toBe(0);
    expect(Number(r.rows[0]!.total_cents)).toBe(1250);
    expect(Number(r.rows[0]!.subtotal_cents)).toBe(1250);
  });

  it("el saldo se descuenta CON la propina", async () => {
    await darSaldo(ana, 2000, "propina-saldo");
    const r = await crearPedido(ana, [{ variante_id: varLatte, cantidad: 2 }], null, 200);

    await db.query("select * from public.pagar_pedido_con_saldo($1, $2)", [
      ana,
      r.rows[0]!.order_id,
    ]);

    // 20.00 − 14.50. Si el cobro usara el subtotal quedarían 7.50 y el local
    // se estaría comiendo la propina de su propio bolsillo.
    expect(await saldo(ana)).toBe(550);
  });

  it("los puntos NO cuentan la propina", async () => {
    await db.query("update public.loyalty_rules set active = true where key = 'por_dolar'");
    await darSaldo(ana, 5000, "propina-puntos");

    // Subtotal 12.50 → 12 puntos. Con la propina el total es 14.50: si se
    // contara, saldrían 14.
    const r = await crearPedido(ana, [{ variante_id: varLatte, cantidad: 2 }], null, 200);
    await db.query("select * from public.pagar_pedido_con_saldo($1, $2)", [
      ana,
      r.rows[0]!.order_id,
    ]);

    expect(await puntos(ana)).toBe(12);
  });

  it("rechaza una propina negativa o por encima de $100", async () => {
    /*
      El tope no es desconfianza: un teclado móvil convierte «2.00» en 200000
      con una pulsación despistada, y sin techo eso es un cobro de dos mil
      dólares por dos cafés.
    */
    await expect(
      crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }], null, -1)
    ).rejects.toThrow(/propina_invalida/);

    await expect(
      crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }], null, 10001)
    ).rejects.toThrow(/propina_invalida/);

    // $100 clavados sí entran: el tope es inclusivo.
    const r = await crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }], null, 10000);
    expect(Number(r.rows[0]!.propina_cents)).toBe(10000);
  });

  it("un pedido rechazado por la propina no deja nada a medias", async () => {
    // La validación va ANTES del insert, así que no queda ni la cabecera del
    // pedido ni un número de pedido gastado.
    await expect(
      crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }], null, 99999)
    ).rejects.toThrow(/propina_invalida/);

    const filas = await leerFresco<{ n: string }>(
      db,
      "select count(*)::text as n from public.orders where user_id = $1",
      [ana]
    );
    expect(Number(filas[0]!.n)).toBe(0);
  });

  it("reenviar el mismo intento devuelve la propina de ENTONCES", async () => {
    /*
      El identificador de intento es la petición, no el carrito. Si alguien
      toca «Continuar» dos veces, la segunda no puede cambiar lo que ya se
      calculó: sería la misma petición cobrando otra cosa.
    */
    const intento = "11111111-1111-4111-8111-111111111111";
    const uno = await crearPedido(
      ana,
      [{ variante_id: varLatte, cantidad: 1 }],
      intento,
      300
    );
    const dos = await crearPedido(
      ana,
      [{ variante_id: varLatte, cantidad: 1 }],
      intento,
      900
    );

    expect(dos.rows[0]!.order_id).toBe(uno.rows[0]!.order_id);
    expect(Number(dos.rows[0]!.propina_cents)).toBe(300);
    expect(Number(dos.rows[0]!.total_cents)).toBe(925);
  });

  it("la cola de la barra enseña la propina, no solo el total", async () => {
    // Una propina que nadie ve es una propina que nadie reparte.
    await darSaldo(ana, 5000, "propina-cola");
    const r = await crearPedido(ana, [{ variante_id: varLatte, cantidad: 1 }], null, 150);
    await db.query("select * from public.pagar_pedido_con_saldo($1, $2)", [
      ana,
      r.rows[0]!.order_id,
    ]);

    const cola = await leerFresco<{
      subtotal_cents: string;
      propina_cents: string;
      total_cents: string;
    }>(db, "select * from public.admin_pedidos_cola()");

    expect(cola).toHaveLength(1);
    expect(Number(cola[0]!.subtotal_cents)).toBe(625);
    expect(Number(cola[0]!.propina_cents)).toBe(150);
    expect(Number(cola[0]!.total_cents)).toBe(775);
  });
});
