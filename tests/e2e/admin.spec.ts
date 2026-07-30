import { expect, test } from "@playwright/test";

import contrato from "../../config/route-contracts.json";

/**
 * El panel, desde fuera y sin sesión.
 *
 * No había NI UN test e2e de `/admin`. Los tests de integración prueban que las
 * funciones SQL rechazan a quien no debe, y los unitarios prueban la matriz de
 * permisos, pero nada comprobaba lo primero de todo: que ninguna superficie
 * administrativa responde a quien llega de la calle.
 *
 * Las rutas se toman de `config/route-contracts.json`, no de una lista escrita
 * aquí. Añadir una pantalla nueva al panel sin protegerla rompe este gate solo,
 * que es exactamente lo que tiene que pasar. Una lista copiada a mano se queda
 * desactualizada justo cuando importa.
 *
 * Estos tests corren SIN credenciales a propósito: no hay usuario de prueba, y
 * crear cuentas en la base real desde el gate sería peor que no tenerlo. Lo que
 * se puede verificar sin sesión —que la puerta está cerrada— es justamente lo
 * más importante.
 */

/** Una ruta con `[id]` no se puede visitar tal cual: se le pone un id real. */
function concretar(ruta: string): string {
  return ruta.replace("[id]", "00000000-0000-4000-8000-000000000000");
}

const RUTAS_ADMIN = contrato.admin.map(concretar);

test("ninguna pantalla del panel se abre sin sesión", async ({ page }) => {
  for (const ruta of RUTAS_ADMIN) {
    await page.goto(ruta);

    await expect(page, `${ruta} se abrió sin sesión`).toHaveURL(/\/iniciar-sesion/);
    // Y guarda el destino, para volver ahí después de entrar.
    expect(page.url()).toContain(`siguiente=${encodeURIComponent(ruta)}`);
  }
});

test("el panel no filtra nada por el título de la página", async ({ page }) => {
  // Un `<title>` con el nombre de la sección confirmaría que la ruta existe. No
  // es grave, pero la redirección tiene que ocurrir ANTES de renderizar nada.
  for (const ruta of RUTAS_ADMIN.slice(0, 4)) {
    await page.goto(ruta);
    await expect(page).toHaveTitle(/Inicia sesión/);
  }
});

test("la exportación de la lista de correo no se descarga sin sesión", async ({ request }) => {
  /*
    Esta ruta devuelve TODOS los correos del negocio en un CSV. Es la superficie
    con más datos personales de todo el proyecto y no pasa por el proxy —no
    empieza por `/admin`—, así que su única defensa es el `exigirDuena()` que
    tiene dentro. Si alguien lo quita, este test lo caza.
  */
  const r = await request.get("/api/admin/newsletter");

  expect(r.status()).toBe(404);
  expect(r.headers()["content-disposition"]).toBeUndefined();
  expect(await r.text()).not.toContain("@");
});

test("los endpoints de ajuste rechazan a quien no tiene sesión", async ({ request }) => {
  // Mueven dinero y puntos de una cuenta ajena. Son POST, así que el proxy no
  // los redirige: responden ellos.
  const uuid = "00000000-0000-4000-8000-000000000000";

  for (const endpoint of [
    `/api/admin/users/${uuid}/wallet-adjustment`,
    `/api/admin/users/${uuid}/points-adjustment`,
  ]) {
    const r = await request.post(endpoint, {
      data: { amountCents: 100000, reason: "prueba de acceso" },
    });

    expect(r.status(), `${endpoint} no rechazó la petición`).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  }
});

test("el contrato de rutas cubre el panel entero", async () => {
  /*
    El test que sostiene a los de arriba.

    Todos recorren `contrato.admin`, así que si esa lista se quedara vacía o
    perdiera entradas pasarían igual sin comprobar nada. Esto fija el mínimo:
    las secciones que existen hoy tienen que seguir estando.
  */
  for (const imprescindible of [
    "/admin",
    "/admin/usuarios",
    "/admin/gift-cards",
    "/admin/auditoria",
    "/admin/eventos",
    "/admin/newsletter",
    "/admin/equipo",
    "/admin/lealtad",
    "/admin/salud",
  ]) {
    expect(contrato.admin, `falta ${imprescindible} en el contrato`).toContain(imprescindible);
  }
});
