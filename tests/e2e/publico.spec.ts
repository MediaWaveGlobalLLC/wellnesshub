import { expect, test } from "@playwright/test";

/**
 * Gate 4 — E2E de la web pública (docs/07).
 *
 * Este archivo existe porque el gate estaba vacío: `playwright test
 * --grep-invert visual` no encontraba ningún spec y terminaba en verde sin
 * ejecutar nada. Un gate que no corre nada no es un gate.
 *
 * Cubre lo que se puede comprobar sin credenciales de Stripe ni Resend: que las
 * páginas cargan, que la navegación lleva a donde dice, que los formularios
 * validan en el servidor y que la aplicación hidrata. Los flujos con dinero se
 * verifican en `tests/integration`, contra Postgres real.
 */

const PUBLICAS = [
  { ruta: "/", titulo: /Siembra bienestar/i },
  { ruta: "/menu", titulo: /Café que eleva/i },
  { ruta: "/comunidad", titulo: /.+/ },
  { ruta: "/gift-cards", titulo: /.+/ },
  { ruta: "/terminos", titulo: /Términos y Condiciones/i },
  { ruta: "/privacidad", titulo: /Política de Privacidad/i },
];

for (const { ruta, titulo } of PUBLICAS) {
  test(`${ruta} carga con su encabezado visible`, async ({ page }) => {
    const respuesta = await page.goto(ruta);
    expect(respuesta?.status()).toBe(200);

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText(titulo);

    // La home se desplegó una vez con el contenido en el DOM y la opacidad a 0.
    // Nada de eso lo detecta un assert de texto: hay que mirar el estilo.
    const opacidad = await h1.evaluate((e) => getComputedStyle(e).opacity);
    expect(opacidad).toBe("1");
  });
}

test("los enlaces legales del pie no están rotos", async ({ page }) => {
  // El formulario de registro obligaba a aceptar dos documentos que devolvían
  // 404. Esta comprobación es para que no vuelva a pasar inadvertido.
  await page.goto("/");

  for (const destino of ["/terminos", "/privacidad"]) {
    const respuesta = await page.request.get(destino);
    expect(respuesta.status(), `${destino} debería existir`).toBe(200);
  }
});

test("el registro rechaza en el servidor un formulario inválido", async ({ page }) => {
  await page.goto("/registro");

  // Sin JavaScript de por medio: se fuerza el envío saltando la validación del
  // navegador, que es justo lo que haría alguien atacando el endpoint.
  await page.locator("form").evaluate((f: HTMLFormElement) => (f.noValidate = true));
  await page.locator('input[name="email"]').fill("esto-no-es-un-correo");
  await page.locator('button[type="submit"]').click();

  // Sigue en /registro y con un mensaje de error: el servidor no lo aceptó.
  await expect(page).toHaveURL(/\/registro/);
  await expect(page.locator("form")).toContainText(/correo|revisa/i);
});

test("iniciar sesión no revela si la cuenta existe", async ({ page }) => {
  await page.goto("/iniciar-sesion");
  // Por `name`, no por etiqueta: «contraseña» casa también con el botón de
  // mostrarla, y el selector resolvía a dos elementos.
  await page.locator('input[name="email"]').fill("nadie-tiene-este-correo@example.com");
  await page.locator('input[name="password"]').fill("UnaClaveCualquiera123");
  await page.locator('button[type="submit"]').click();

  // El aviso se pinta como hermano del <form>, no dentro: se busca en la página.
  // Mismo mensaje que para una contraseña incorrecta: sin oráculo de cuentas.
  await expect(page.locator("main")).toContainText(/incorrectos/i);
  await expect(page.locator("main")).not.toContainText(/no existe|no encontrad/i);
});

test("el menú móvil abre y cierra", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Solo aplica al viewport móvil.");

  await page.goto("/");
  const boton = page.locator('button[aria-controls="menu-movil"]');

  // Es la prueba de que React hidrató: si la CSP bloquea los chunks, la página
  // se pinta igual pero este botón no hace nada.
  await boton.click();
  await expect(page.locator("#menu-movil")).toBeVisible();

  await boton.click();
  await expect(page.locator("#menu-movil")).toBeHidden();
});

test("las rutas privadas redirigen a iniciar sesión", async ({ page }) => {
  for (const privada of ["/perfil", "/wallet"]) {
    await page.goto(privada);
    await expect(page).toHaveURL(/\/iniciar-sesion/);
    // Y guarda el destino para volver después de entrar.
    expect(page.url()).toContain(`siguiente=${encodeURIComponent(privada)}`);
  }
});
