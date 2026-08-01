/**
 * Normalización de la URL base — el fallo que tumbó la compra en producción.
 *
 * `NEXT_PUBLIC_APP_URL` se puso como «thewellnesshubpr.com», sin esquema, y
 * Stripe rechazó la sesión con `url_invalid`: *An explicit scheme (such as
 * https) must be provided*. El pedido se creaba, el cobro no se abría y en
 * pantalla solo salía «No pudimos abrir el pago».
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { urlBaseDelSitio } from "@/lib/url-base";

const ALTERNATIVA = "https://ejemplo.test";
let previo: string | undefined;

beforeEach(() => {
  previo = process.env.NEXT_PUBLIC_APP_URL;
});

afterEach(() => {
  if (previo === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = previo;
});

describe("urlBaseDelSitio", () => {
  it("le pone https a un dominio pelado", () => {
    process.env.NEXT_PUBLIC_APP_URL = "thewellnesshubpr.com";
    expect(urlBaseDelSitio(ALTERNATIVA)).toBe("https://thewellnesshubpr.com");
  });

  it("respeta el esquema cuando ya viene", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://thewellnesshubpr.com";
    expect(urlBaseDelSitio(ALTERNATIVA)).toBe("https://thewellnesshubpr.com");

    // http se conserva: hace falta para desarrollo en local.
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(urlBaseDelSitio(ALTERNATIVA)).toBe("http://localhost:3000");
  });

  it("quita la barra final, que duplicaría la del path", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://thewellnesshubpr.com/";
    expect(urlBaseDelSitio(ALTERNATIVA)).toBe("https://thewellnesshubpr.com");

    process.env.NEXT_PUBLIC_APP_URL = "thewellnesshubpr.com//";
    expect(urlBaseDelSitio(ALTERNATIVA)).toBe("https://thewellnesshubpr.com");
  });

  it("aguanta espacios de sobra al pegar", () => {
    process.env.NEXT_PUBLIC_APP_URL = "  thewellnesshubpr.com  ";
    expect(urlBaseDelSitio(ALTERNATIVA)).toBe("https://thewellnesshubpr.com");
  });

  it("sin variable usa la del request, que siempre trae esquema", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(urlBaseDelSitio(ALTERNATIVA)).toBe(ALTERNATIVA);

    process.env.NEXT_PUBLIC_APP_URL = "   ";
    expect(urlBaseDelSitio("https://ejemplo.test/")).toBe("https://ejemplo.test");
  });
});
