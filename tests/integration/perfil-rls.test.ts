// @vitest-environment node
/**
 * RLS de las tablas del perfil (migración 0005).
 *
 * El reparto que se verifica aquí:
 *  · favoritos y reservas — el usuario los gestiona;
 *  · pedidos y direcciones — lee lo suyo;
 *  · niveles, reglas y eventos publicados — catálogo público;
 *  · token del QR — inalcanzable desde el navegador.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { comoUsuario, crearBase, crearUsuario, type Db } from "./supabase-harness";

let db: Db;
let ana: string;
let bruno: string;

beforeEach(async () => {
  db = await crearBase();
  ana = await crearUsuario(db, { email: "ana@siembra.test", firstName: "Ana" });
  bruno = await crearUsuario(db, { email: "bruno@siembra.test", firstName: "Bruno" });
});

describe("configuración de lealtad", () => {
  it("trae los cuatro niveles ordenados y con umbrales crecientes", async () => {
    const r = await db.query<{ key: string; min_points: number }>(
      "select key, min_points from public.loyalty_tiers order by sort_order"
    );
    expect(r.rows.map((x) => x.key)).toEqual(["semilla", "brote", "raiz", "florecer"]);
    const umbrales = r.rows.map((x) => Number(x.min_points));
    expect(umbrales).toEqual([...umbrales].sort((a, b) => a - b));
    expect(umbrales[0]).toBe(0);
  });

  it("siembra la regla del Brand Book: cada dólar da un punto", async () => {
    const r = await db.query<{ points: number }>(
      "select points from public.loyalty_rules where key = 'por_dolar'"
    );
    expect(Number(r.rows[0].points)).toBe(1);
  });

  it("es legible sin sesión — son las reglas públicas del programa", async () => {
    await db.exec("set role anon");
    const r = await db.query("select key from public.loyalty_tiers");
    await db.exec("reset role");
    expect(r.rows.length).toBe(4);
  });
});

describe("favoritos", () => {
  it("el usuario añade y quita los suyos", async () => {
    await comoUsuario(db, ana, async () => {
      await db.query("insert into public.favorites (user_id, item_slug) values ($1, $2)", [
        ana,
        "matcha-clasico",
      ]);
      const r = await db.query("select item_slug from public.favorites");
      expect(r.rows).toHaveLength(1);

      await db.query("delete from public.favorites where item_slug = $1", ["matcha-clasico"]);
      const tras = await db.query("select item_slug from public.favorites");
      expect(tras.rows).toHaveLength(0);
    });
  });

  it("no puede añadir favoritos a nombre de otro", async () => {
    await comoUsuario(db, ana, async () => {
      await expect(
        db.query("insert into public.favorites (user_id, item_slug) values ($1, $2)", [
          bruno,
          "colado",
        ])
      ).rejects.toThrow(/row-level security/i);
    });
  });

  it("no ve los favoritos ajenos", async () => {
    await db.query("insert into public.favorites (user_id, item_slug) values ($1, $2)", [
      bruno,
      "cold-brew",
    ]);
    const vistos = await comoUsuario(db, ana, async () => {
      const r = await db.query("select item_slug from public.favorites");
      return r.rows;
    });
    expect(vistos).toHaveLength(0);
  });
});

describe("eventos y reservas", () => {
  beforeEach(async () => {
    await db.exec(`
      insert into public.events (slug, title, starts_at, published) values
        ('ceremonia-matcha', 'Ceremonia de Matcha', now() + interval '7 days', true),
        ('borrador-interno', 'Aún sin publicar', now() + interval '9 days', false);
    `);
  });

  it("solo muestra los eventos publicados", async () => {
    const vistos = await comoUsuario(db, ana, async () => {
      const r = await db.query<{ slug: string }>("select slug from public.events");
      return r.rows.map((x) => x.slug);
    });
    expect(vistos).toEqual(["ceremonia-matcha"]);
  });

  it("el usuario reserva y luego cancela", async () => {
    const evento = await db.query<{ id: string }>(
      "select id from public.events where slug = 'ceremonia-matcha'"
    );

    await comoUsuario(db, ana, async () => {
      await db.query("insert into public.event_bookings (user_id, event_id) values ($1, $2)", [
        ana,
        evento.rows[0].id,
      ]);
      await db.query("update public.event_bookings set status = 'cancelada' where user_id = $1", [
        ana,
      ]);
      const r = await db.query<{ status: string }>("select status from public.event_bookings");
      expect(r.rows[0].status).toBe("cancelada");
    });
  });

  it("no puede marcarse a sí mismo como asistente — eso lo hace el personal", async () => {
    const evento = await db.query<{ id: string }>(
      "select id from public.events where slug = 'ceremonia-matcha'"
    );
    await db.query("insert into public.event_bookings (user_id, event_id) values ($1, $2)", [
      ana,
      evento.rows[0].id,
    ]);

    await comoUsuario(db, ana, async () => {
      await expect(
        db.query("update public.event_bookings set status = 'asistio' where user_id = $1", [ana])
      ).rejects.toThrow(/row-level security/i);
    });
  });
});

describe("pedidos", () => {
  beforeEach(async () => {
    await db.query(
      "insert into public.orders (user_id, order_number, total_cents) values ($1, $2, $3)",
      [bruno, "SMB4821", 1250]
    );
  });

  it("no ve los pedidos ajenos", async () => {
    const vistos = await comoUsuario(db, ana, async () => {
      const r = await db.query("select order_number from public.orders");
      return r.rows;
    });
    expect(vistos).toHaveLength(0);
  });

  it("no puede fabricarse un pedido — no hay política de insert", async () => {
    await comoUsuario(db, ana, async () => {
      await expect(
        db.query(
          "insert into public.orders (user_id, order_number, total_cents) values ($1, $2, $3)",
          [ana, "FALSO-1", 99999]
        )
      ).rejects.toThrow(/row-level security/i);
    });
  });
});

describe("token del QR de miembro", () => {
  const pedirToken = (usuario: string) =>
    comoUsuario(db, usuario, async () => {
      const r = await db.query<{ obtener_qr_token: string }>("select public.obtener_qr_token()");
      return r.rows[0].obtener_qr_token;
    });

  it("se emite una vez y se reutiliza", async () => {
    const a = await pedirToken(ana);
    const b = await pedirToken(ana);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it("cada usuario recibe el suyo — no hay parámetro que manipular", async () => {
    const tokenAna = await pedirToken(ana);
    const tokenBruno = await pedirToken(bruno);
    expect(tokenAna).not.toBe(tokenBruno);
  });

  it("la tabla es inalcanzable desde el navegador", async () => {
    await pedirToken(ana);
    const vistos = await comoUsuario(db, ana, async () => {
      const r = await db
        .query("select token from public.member_qr_tokens")
        .catch(() => ({ rows: [] }));
      return r.rows;
    });
    expect(vistos).toHaveLength(0);
  });

  it("sin sesión, falla", async () => {
    await db.exec("set role authenticated");
    await expect(db.query("select public.obtener_qr_token()")).rejects.toThrow(/sesion_requerida/);
    await db.exec("reset role");
  });

  it("tras revocar, emite uno distinto", async () => {
    const antes = await pedirToken(ana);
    await db.query("update public.member_qr_tokens set revoked_at = now() where user_id = $1", [ana]);
    const despues = await pedirToken(ana);
    expect(despues).not.toBe(antes);
  });
});

describe("direcciones", () => {
  it("no ve las direcciones ajenas", async () => {
    await db.query(
      "insert into public.addresses (user_id, line1, city, postal_code) values ($1,$2,$3,$4)",
      [bruno, "1024 Ashford Ave", "San Juan", "00907"]
    );
    const vistos = await comoUsuario(db, ana, async () => {
      const r = await db.query("select line1 from public.addresses");
      return r.rows;
    });
    expect(vistos).toHaveLength(0);
  });
});
