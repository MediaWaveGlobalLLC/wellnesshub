// @vitest-environment node
/**
 * Lealtad viva y salud técnica (migración 0018).
 *
 * El bloque que más importa es el del bono de bienvenida, y no por el bono:
 * ese código corre DENTRO de la transacción que crea una cuenta. Si lanzara,
 * nadie podría registrarse en la web. Se prueba que un fallo suyo no cierra la
 * puerta.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearBase, crearUsuario, leerFresco, type Db } from "./supabase-harness";

let db: Db;
let duena: string;
let empleado: string;

beforeAll(async () => {
  db = await crearBase();
  duena = await crearUsuario(db, { email: "duena@siembra.test" });
  empleado = await crearUsuario(db, { email: "mostrador@siembra.test" });
  await db.query("insert into public.admin_users (user_id, rol) values ($1, 'duena')", [duena]);
  await db.query("insert into public.admin_users (user_id, rol) values ($1, 'empleado')", [empleado]);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`
    delete from public.audit_logs;
    delete from public.stripe_webhook_events;
    delete from public.gift_card_redeem_attempts;
    delete from public.rate_limit_hits;
    -- El ledger también: sin esto, los bonos de bienvenida de los usuarios que
    -- crea cada test se acumulan y los conteos de «veces aplicada» cuentan lo
    -- de las pruebas anteriores.
    delete from public.loyalty_transactions;
    update public.loyalty_accounts set points_balance = 0;
  `);
  // Se restaura la semilla de 0005 + 0018 por si un test la movió.
  await db.exec(`
    update public.loyalty_rules set points = 100, active = true, label = 'Bono de bienvenida'
      where key = 'bienvenida';
    update public.loyalty_rules set points = 5, active = true where key = 'vaso_reusable';
    update public.loyalty_tiers set min_points = 0    where key = 'semilla';
    update public.loyalty_tiers set min_points = 500  where key = 'brote';
    update public.loyalty_tiers set min_points = 2000 where key = 'raiz';
    update public.loyalty_tiers set min_points = 5000 where key = 'florecer';
  `);
});

describe("las reglas dicen la verdad sobre lo que el sistema hace", () => {
  it("solo una de las siete es automática hoy", async () => {
    /*
      De las siete reglas del Brand Book, cinco necesitan algo que no existe
      —el punto de venta, la fecha de nacimiento, un sistema de referidos— y
      una es una decisión de quien está en la barra. Enseñarlas todas iguales
      haría creer que el sistema da puntos por siete conceptos.
    */
    const r = await db.query<{ aplicacion: string; n: string }>(
      "select aplicacion, count(*)::text as n from public.loyalty_rules group by aplicacion order by 1"
    );
    const mapa = Object.fromEntries(r.rows.map((f) => [f.aplicacion, Number(f.n)]));
    expect(mapa).toEqual({ automatica: 1, bloqueada: 5, manual: 1 });
  });

  it("cada regla bloqueada explica QUÉ falta", async () => {
    // «Bloqueada» sin motivo es un callejón sin salida para quien lo lea.
    const r = await db.query<{ key: string; nota: string | null }>(
      "select key, nota from public.loyalty_rules where aplicacion = 'bloqueada'"
    );
    for (const f of r.rows) {
      expect(f.nota, `la regla ${f.key} no dice por qué está bloqueada`).toBeTruthy();
    }
  });
});

describe("bono de bienvenida", () => {
  it("una cuenta nueva nace con sus 100 puntos", async () => {
    const nueva = await crearUsuario(db, { email: "socia1@siembra.test", firstName: "Nueva" });
    const r = await leerFresco<{ points_balance: string }>(
      db, "select points_balance from public.loyalty_accounts where user_id = $1", [nueva]
    );
    expect(Number(r[0]!.points_balance)).toBe(100);
  });

  it("el movimiento queda en el ledger con su concepto", async () => {
    const nueva = await crearUsuario(db, { email: "socia2@siembra.test" });
    const r = await leerFresco<{ points: string; source_id: string; description: string }>(
      db,
      "select points, source_id, description from public.loyalty_transactions where user_id = $1",
      [nueva]
    );
    expect(r).toHaveLength(1);
    expect(Number(r[0]!.points)).toBe(100);
    expect(r[0]!.source_id).toBe("bienvenida");
    expect(r[0]!.description).toBe("Bono de bienvenida");
  });

  it("cambiar los puntos desde la tabla cambia el bono, sin desplegar", async () => {
    // Es lo que 0005 prometía al declarar la tabla «editable sin tocar código».
    await db.exec("update public.loyalty_rules set points = 250 where key = 'bienvenida'");
    const nueva = await crearUsuario(db, { email: "socia3@siembra.test" });
    const r = await leerFresco<{ points_balance: string }>(
      db, "select points_balance from public.loyalty_accounts where user_id = $1", [nueva]
    );
    expect(Number(r[0]!.points_balance)).toBe(250);
  });

  it("desactivar la regla deja la cuenta a cero, y sigue creándose", async () => {
    await db.exec("update public.loyalty_rules set active = false where key = 'bienvenida'");
    const nueva = await crearUsuario(db, { email: "socia4@siembra.test" });
    const r = await leerFresco<{ points_balance: string }>(
      db, "select points_balance from public.loyalty_accounts where user_id = $1", [nueva]
    );
    expect(Number(r[0]!.points_balance)).toBe(0);
  });

  it("la tabla no acepta un bono absurdo", async () => {
    /*
      El primer intento de este archivo simulaba el fallo poniendo el máximo
      bigint en los puntos. No fallaba: insertaba un bono de nueve trillones de
      puntos y el trigger lo daba tan contento, porque la columna no tenía
      ningún tope. Un dedo torpe habría regalado esa cifra a todo el que se
      registrara, y los movimientos de lealtad son inmutables: deshacerlo son
      mil correcciones, no un `update`.
    */
    await expect(
      db.exec("update public.loyalty_rules set points = 9223372036854775807 where key = 'bienvenida'")
    ).rejects.toThrow();

    await expect(
      db.exec("update public.loyalty_rules set points = 0 where key = 'bienvenida'")
    ).rejects.toThrow();
  });

  it("SI EL BONO FALLA, LA CUENTA SE CREA IGUAL", async () => {
    /*
      El test que justifica el bloque `exception` del trigger.

      Ese código corre dentro de la transacción que da de alta a una persona.
      Sin la captura, cualquier fallo suyo cerraría el registro de la web
      entera. Un bono de cien puntos no vale una puerta cerrada.

      El fallo se provoca rompiendo a propósito el ledger con una restricción
      temporal, que es la forma de que reviente DENTRO del bloque en vez de
      antes de llegar a él.
    */
    // `not valid`: solo se aplica a las filas nuevas. Sin eso, Postgres
    // rechaza añadir la restricción porque los bonos de tests anteriores ya la
    // incumplen.
    await db.exec(
      "alter table public.loyalty_transactions add constraint tmp_rompe_bono check (points <> 100) not valid"
    );

    try {
      const nueva = await crearUsuario(db, { email: "socia5@siembra.test", firstName: "Pese" });

      const perfil = await leerFresco<{ n: string }>(
        db, "select count(*)::text as n from public.profiles where id = $1", [nueva]
      );
      expect(perfil[0]!.n).toBe("1");

      const wallet = await leerFresco<{ n: string }>(
        db, "select count(*)::text as n from public.wallets where user_id = $1", [nueva]
      );
      expect(wallet[0]!.n).toBe("1");

      // Sin bono, claro: el ledger lo rechazó. Pero la cuenta existe.
      const puntos = await leerFresco<{ points_balance: string }>(
        db, "select points_balance from public.loyalty_accounts where user_id = $1", [nueva]
      );
      expect(Number(puntos[0]!.points_balance)).toBe(0);
    } finally {
      await db.exec("alter table public.loyalty_transactions drop constraint tmp_rompe_bono");
    }
  });
});

describe("aplicar una regla manual", () => {
  it("el MOSTRADOR puede dar los puntos del vaso reusable", async () => {
    const cliente = await crearUsuario(db, { email: "cliente1@siembra.test" });

    const r = await db.query<{ puntos: string; nuevo_saldo: string }>(
      "select puntos, nuevo_saldo from public.admin_aplicar_regla_lealtad($1, $2, 'vaso_reusable')",
      [empleado, cliente]
    );

    expect(Number(r.rows[0]!.puntos)).toBe(5);
    // 100 de bienvenida + 5.
    expect(Number(r.rows[0]!.nuevo_saldo)).toBe(105);

    const log = await leerFresco<{ n: string }>(
      db, "select count(*)::text as n from public.audit_logs where action = 'lealtad_regla_aplicada'"
    );
    expect(Number(log[0]!.n)).toBe(1);
  });

  it("se puede aplicar dos veces: mañana trae el vaso otra vez", async () => {
    const cliente = await crearUsuario(db, { email: "cliente2@siembra.test" });
    await db.query("select * from public.admin_aplicar_regla_lealtad($1, $2, 'vaso_reusable')", [empleado, cliente]);
    const r = await db.query<{ nuevo_saldo: string }>(
      "select nuevo_saldo from public.admin_aplicar_regla_lealtad($1, $2, 'vaso_reusable')",
      [empleado, cliente]
    );
    expect(Number(r.rows[0]!.nuevo_saldo)).toBe(110);
  });

  it("NO se puede aplicar una regla automática a mano: duplicaría el bono", async () => {
    const cliente = await crearUsuario(db, { email: "cliente3@siembra.test" });
    await expect(
      db.query("select * from public.admin_aplicar_regla_lealtad($1, $2, 'bienvenida')", [empleado, cliente])
    ).rejects.toThrow(/regla_no_manual/);
  });

  it("NO se puede aplicar una bloqueada: el dato que la dispara no existe", async () => {
    const cliente = await crearUsuario(db, { email: "cliente4@siembra.test" });
    await expect(
      db.query("select * from public.admin_aplicar_regla_lealtad($1, $2, 'por_dolar')", [empleado, cliente])
    ).rejects.toThrow(/regla_no_manual/);
  });

  it("ni una desactivada", async () => {
    const cliente = await crearUsuario(db, { email: "cliente5@siembra.test" });
    await db.exec("update public.loyalty_rules set active = false where key = 'vaso_reusable'");
    await expect(
      db.query("select * from public.admin_aplicar_regla_lealtad($1, $2, 'vaso_reusable')", [empleado, cliente])
    ).rejects.toThrow(/regla_inactiva/);
  });

  it("quien no es del equipo no da puntos a nadie", async () => {
    const cliente = await crearUsuario(db, { email: "cliente6@siembra.test" });
    await expect(
      db.query("select * from public.admin_aplicar_regla_lealtad($1, $2, 'vaso_reusable')", [cliente, cliente])
    ).rejects.toThrow(/no_autorizado/);
  });
});

describe("editar la configuración", () => {
  it("cambiar los puntos de una regla queda auditado", async () => {
    await db.query(
      "select * from public.admin_lealtad_regla_editar($1, 'vaso_reusable', 10, 'Traer vaso reusable', true, 'Subimos el incentivo')",
      [duena]
    );
    const r = await leerFresco<{ points: string }>(
      db, "select points from public.loyalty_rules where key = 'vaso_reusable'"
    );
    expect(Number(r[0]!.points)).toBe(10);

    const log = await leerFresco<{ antes: string; despues: string }>(
      db,
      "select before_data::text as antes, after_data::text as despues from public.audit_logs where action = 'lealtad_regla_editada'"
    );
    expect(log[0]!.antes).toContain('"points": 5');
    expect(log[0]!.despues).toContain('"points": 10');
  });

  it("un empleado no cambia la configuración", async () => {
    await expect(
      db.query(
        "select * from public.admin_lealtad_regla_editar($1, 'vaso_reusable', 999, 'X', true, 'Porque si')",
        [empleado]
      )
    ).rejects.toThrow(/no_autorizado/);
  });

  it("NO deja desordenar los umbrales de los niveles", async () => {
    /*
      La guarda que importa. `nivel_para_puntos` (0006) elige el nivel más alto
      cuyo mínimo no supere el saldo, y el nivel NO se guarda: se deriva. Poner
      Brote por encima de Raíz recalcularía el nivel de todo el mundo mal y en
      silencio, y en /perfil saldrían barras de progreso hacia atrás.
    */
    await expect(
      db.query(
        "select * from public.admin_lealtad_nivel_editar($1, 'brote', 'Brote', 3000, null, 'Subo el minimo')",
        [duena]
      )
    ).rejects.toThrow(/umbrales_desordenados/);

    // Y la tabla queda como estaba: el raise revierte la transacción entera.
    const r = await leerFresco<{ min_points: string }>(
      db, "select min_points from public.loyalty_tiers where key = 'brote'"
    );
    expect(Number(r[0]!.min_points)).toBe(500);
  });

  it("NO deja que el primer nivel deje de empezar en cero", async () => {
    // Con el primero en 100, quien tenga 50 puntos no tendría NINGÚN nivel y
    // `calcularProgreso` se quedaría sin suelo.
    await expect(
      db.query(
        "select * from public.admin_lealtad_nivel_editar($1, 'semilla', 'Semilla', 100, null, 'Pruebo')",
        [duena]
      )
    ).rejects.toThrow(/primer_nivel_no_empieza_en_cero/);
  });

  it("un cambio válido sí pasa, y el nivel de la gente se recalcula solo", async () => {
    const cliente = await crearUsuario(db, { email: "cliente7@siembra.test" });
    // Nace con 100 de bienvenida: semilla.
    let nivel = await leerFresco<{ n: string }>(
      db, "select public.nivel_para_puntos(points_balance) as n from public.loyalty_accounts where user_id = $1", [cliente]
    );
    expect(nivel[0]!.n).toBe("semilla");

    await db.query(
      "select * from public.admin_lealtad_nivel_editar($1, 'brote', 'Brote', 50, 'Estás comenzando.', 'Bajamos el umbral de Brote')",
      [duena]
    );

    nivel = await leerFresco<{ n: string }>(
      db, "select public.nivel_para_puntos(points_balance) as n from public.loyalty_accounts where user_id = $1", [cliente]
    );
    // Sin tocar ni un punto de nadie: el nivel se deriva.
    expect(nivel[0]!.n).toBe("brote");
  });

  it("el listado dice cuántas veces se ha aplicado cada regla de verdad", async () => {
    // Una regla activa con cero usos lleva meses sin dar un punto a nadie.
    const cliente = await crearUsuario(db, { email: "cliente8@siembra.test" });
    await db.query("select * from public.admin_aplicar_regla_lealtad($1, $2, 'vaso_reusable')", [empleado, cliente]);

    const r = await db.query<{ clave: string; veces_aplicada: string; puntos_dados: string }>(
      "select clave, veces_aplicada, puntos_dados from public.admin_lealtad_reglas() where clave = 'vaso_reusable'"
    );
    expect(Number(r.rows[0]!.veces_aplicada)).toBe(1);
    expect(Number(r.rows[0]!.puntos_dados)).toBe(5);

    const sinUso = await db.query<{ veces_aplicada: string }>(
      "select veces_aplicada from public.admin_lealtad_reglas() where clave = 'por_dolar'"
    );
    expect(Number(sinUso.rows[0]!.veces_aplicada)).toBe(0);
  });

  it("el listado de niveles cuenta a la gente de cada uno", async () => {
    const r = await db.query<{ clave: string; miembros: string }>(
      "select clave, miembros from public.admin_lealtad_niveles() order by clave"
    );
    expect(r.rows).toHaveLength(4);
    const total = r.rows.reduce((s, f) => s + Number(f.miembros), 0);
    const cuentas = await db.query<{ n: string }>(
      "select count(*)::text as n from public.loyalty_accounts"
    );
    // Cada cuenta cae en exactamente un nivel: si no, hay un hueco en los
    // umbrales y alguien se quedaría sin nivel.
    expect(total).toBe(Number(cuentas.rows[0]!.n));
  });
});

describe("salud técnica", () => {
  it("con todo limpio devuelve ceros y nulos, no se cae", async () => {
    const r = await db.query<Record<string, string | null>>("select * from public.metricas_salud()");
    expect(r.rows).toHaveLength(1);
    expect(Number(r.rows[0]!.webhooks_total)).toBe(0);
    expect(r.rows[0]!.webhook_ultimo).toBeNull();
    expect(Number(r.rows[0]!.webhook_latencia_media_ms)).toBe(0);
  });

  it("cuenta los webhooks fallidos y los que se quedaron a medias", async () => {
    // Un webhook fallido es una gift card pagada y no emitida: dinero cobrado
    // sin producto.
    await db.exec(`
      insert into public.stripe_webhook_events (stripe_event_id, event_type, status, created_at, processed_at) values
        ('evt_1', 'checkout.session.completed', 'processed', now() - interval '1 hour', now() - interval '1 hour' + interval '400 milliseconds'),
        ('evt_2', 'checkout.session.completed', 'failed',    now() - interval '2 hours', null),
        ('evt_3', 'checkout.session.completed', 'processing', now() - interval '30 minutes', null),
        ('evt_4', 'checkout.session.completed', 'processing', now(), null);
    `);

    const r = await db.query<Record<string, string>>("select * from public.metricas_salud()");
    const f = r.rows[0]!;
    expect(Number(f.webhooks_total)).toBe(4);
    expect(Number(f.webhooks_fallidos)).toBe(1);
    // Solo el de hace 30 minutos: el de hace un instante todavía puede estar
    // en curso de verdad.
    expect(Number(f.webhooks_procesando)).toBe(1);
    expect(Number(f.webhooks_fallidos_7d)).toBe(1);
    expect(Number(f.webhook_latencia_media_ms)).toBe(400);
  });

  it("detecta a quien lleva tres intentos de canje sin acertar", async () => {
    const atascada = await crearUsuario(db, { email: "atascada@siembra.test" });
    const suerte = await crearUsuario(db, { email: "suerte@siembra.test" });

    await db.query(
      `insert into public.gift_card_redeem_attempts (user_id, exito) values
         ($1,false),($1,false),($1,false),
         ($2,false),($2,false),($2,true)`,
      [atascada, suerte]
    );

    const r = await db.query<Record<string, string>>("select * from public.metricas_salud()");
    expect(Number(r.rows[0]!.canjes_fallidos)).toBe(5);
    // Solo una: la otra acabó acertando, así que no está atascada.
    expect(Number(r.rows[0]!.canjes_personas_atascadas)).toBe(1);
  });

  it("dice quién está bloqueado AHORA, no quién lo estuvo", async () => {
    const hash = (n: string) => n.repeat(64).slice(0, 64);

    await db.query(
      `insert into public.rate_limit_hits (accion, clave_hash, ventana_inicio, conteo) values
         ('login', $1, now(), 20),
         ('login', $2, now() - interval '2 hours', 20),
         ('registro', $3, now(), 1)`,
      [hash("a"), hash("b"), hash("c")]
    );

    const r = await db.query<Record<string, string>>("select * from public.metricas_salud()");
    // El de hace dos horas ya salió de su ventana de 15 minutos, y el de
    // registro no ha superado su cupo.
    expect(Number(r.rows[0]!.bloqueos_activos)).toBe(1);
    expect(Number(r.rows[0]!.bloqueos_login_activos)).toBe(1);
  });

  it("los webhooks recientes ponen lo roto primero", async () => {
    // Si hay un fallo entre cien entregas buenas, es lo único que hay que mirar.
    await db.exec(`
      insert into public.stripe_webhook_events (stripe_event_id, event_type, status, created_at) values
        ('evt_ok1', 'x', 'processed', now()),
        ('evt_ok2', 'x', 'processed', now() - interval '1 minute'),
        ('evt_mal', 'x', 'failed',    now() - interval '3 hours');
    `);

    const r = await db.query<{ evento_id: string; estado: string }>(
      "select evento_id, estado from public.admin_webhooks_recientes(10)"
    );
    expect(r.rows[0]!.evento_id).toBe("evt_mal");
    expect(r.rows[0]!.estado).toBe("failed");
  });
});

describe("permisos", () => {
  it("ni anon ni authenticated alcanzan nada de 0018", async () => {
    for (const rol of ["anon", "authenticated"]) {
      await db.exec(`set role ${rol}`);
      try {
        await expect(db.query("select * from public.metricas_salud()")).rejects.toThrow();
        await expect(db.query("select * from public.admin_lealtad_reglas()")).rejects.toThrow();
        await expect(db.query("select * from public.admin_webhooks_recientes(5)")).rejects.toThrow();
      } finally {
        await db.exec("reset role");
      }
    }
  });
});
