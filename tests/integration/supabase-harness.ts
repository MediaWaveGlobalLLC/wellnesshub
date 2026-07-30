/**
 * Banco de pruebas de Postgres para el esquema de SIEMBRA.
 *
 * Levanta un Postgres real (PGlite, WASM) en memoria y aplica las migraciones
 * de `supabase/migrations/` tal cual. No hay Docker, ni servicio, ni
 * credenciales: las pruebas de esquema, trigger, ledger y RLS pueden correr en
 * CI y en local sin depender de un proyecto Supabase.
 *
 * Supabase aporta piezas que no vienen en un Postgres desnudo. Aquí se replican
 * las mínimas de las que dependen las migraciones:
 *
 *  - el esquema `auth` y la tabla `auth.users` a la que apuntan las FKs;
 *  - `auth.uid()`, que en Supabase lee el `sub` del JWT desde una GUC;
 *  - los roles `anon`, `authenticated` y `service_role`.
 *
 * La implementación de `auth.uid()` es la de Supabase, no una aproximación:
 * eso es lo que hace que las pruebas de RLS signifiquen algo.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

export type Db = PGlite;

const MIGRACIONES = path.join(process.cwd(), "supabase", "migrations");

const SHIM_SUPABASE = `
create schema if not exists auth;

-- Los roles que las migraciones usan en sus grant/revoke.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
end $$;

-- Subconjunto de auth.users: lo que tocan el trigger, las FKs y las métricas.
--
-- Sin acentos graves en este bloque: es una plantilla de JavaScript y cerrarían
-- la cadena a mitad.
--
-- email_confirmed_at y last_sign_in_at los mantiene Supabase, no nosotros, pero
-- existen en la tabla real y las consultas de administración los leen. Sin ellos
-- aquí, una métrica que funciona en producción falla en los tests — o peor, se
-- escribe dando por hecho que no están disponibles.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- auth.uid() tal como la define Supabase: lee el sub del JWT desde una GUC.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
`;

/** Postgres limpio con las migraciones aplicadas en orden. */
export async function crearBase(): Promise<Db> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SHIM_SUPABASE);

  const archivos = fs
    .readdirSync(MIGRACIONES)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (archivos.length === 0) {
    throw new Error(`No se encontraron migraciones en ${MIGRACIONES}`);
  }

  for (const archivo of archivos) {
    const sql = fs.readFileSync(path.join(MIGRACIONES, archivo), "utf8");
    try {
      await db.exec(sql);
    } catch (causa) {
      throw new Error(`Falló la migración ${archivo}: ${(causa as Error).message}`);
    }
  }

  /*
   * Crítico para que las pruebas de RLS signifiquen algo.
   *
   * Supabase concede por defecto todos los privilegios sobre las tablas de
   * `public` a anon/authenticated/service_role. Es decir: en producción esos
   * roles SÍ pueden alcanzar la tabla, y lo único que impide leer datos ajenos
   * es la política RLS.
   *
   * Sin estos grants, Postgres deniega antes en la capa de privilegios y las
   * pruebas pasarían sin llegar a evaluar una sola política — verde falso.
   */
  await db.exec(`
    grant all on all tables in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
  `);

  return db;
}

/**
 * Da de alta un usuario como lo haría Supabase Auth, para que dispare
 * `on_auth_user_created`.
 */
export async function crearUsuario(
  db: Db,
  datos: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    marketingOptIn?: boolean;
  }
): Promise<string> {
  const meta = {
    first_name: datos.firstName ?? null,
    last_name: datos.lastName ?? null,
    phone: datos.phone ?? null,
    marketing_email_opt_in: datos.marketingOptIn ?? false,
  };

  const res = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id",
    [datos.email, JSON.stringify(meta)]
  );
  return res.rows[0].id;
}

/**
 * Puntos con los que nace una cuenta — el bono de bienvenida de `0018`.
 *
 * Se LEE de `loyalty_rules` en vez de escribir 100 en cada test. El bono es
 * configurable desde el panel a propósito, así que el día que el negocio lo
 * cambie a 250 no puede romper media suite: lo que los tests comprueban es la
 * relación entre el saldo y lo que se sumó, no una cifra concreta.
 *
 * Devuelve 0 si la regla está desactivada, que es lo que pasaría de verdad.
 */
export async function bonoBienvenida(db: Db): Promise<number> {
  const r = await db.query<{ points: string }>(
    "select points from public.loyalty_rules where key = 'bienvenida' and active"
  );
  return r.rows.length > 0 ? Number(r.rows[0]!.points) : 0;
}

/**
 * Lectura que ignora la caché de sentencias de PGlite.
 *
 * PGlite reutiliza el resultado de una consulta parametrizada idéntica dentro de
 * la misma sesión. Si una prueba lee el mismo SQL antes y después de un cambio,
 * la segunda lectura devuelve el valor viejo y el fallo parece un bug del
 * esquema: costó un buen rato descubrir que el dato en la base era correcto y
 * quien mentía era la prueba.
 *
 * Un comentario único no basta: se normaliza antes de la caché. Envolver la
 * consulta con un alias distinto sí cambia el árbol de parseo y fuerza la
 * ejecución real. Úsalo siempre que compruebes un valor que acaba de cambiar.
 */
let contadorLecturas = 0;
export async function leerFresco<T>(
  db: Db,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const alias = `fresco_${contadorLecturas++}`;
  const r = await db.query<T>(`select ${alias}.* from (${sql}) as ${alias}`, params);
  return r.rows;
}

/**
 * Ejecuta `fn` como ese usuario autenticado: rol `authenticated` y el `sub` del
 * JWT puesto, que es exactamente el contexto en el que Postgres evalúa las
 * políticas RLS en producción.
 */
export async function comoUsuario<T>(db: Db, userId: string, fn: () => Promise<T>): Promise<T> {
  // A nivel de sesión, no `set local`: fuera de una transacción explícita
  // `set local` no tiene efecto y las políticas se evaluarían sin `sub`.
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', '', false)");
  }
}
