import { describe, expect, it } from "vitest";
import {
  loginSchema,
  nuevaPasswordSchema,
  registroSchema,
  solicitarResetSchema,
} from "@/lib/validation/auth";

const base = {
  firstName: "Valeria",
  lastName: "Ramos",
  email: "Valeria.Ramos@Example.com",
  phone: "(939) 835-0044",
  password: "siembra2026",
  confirmPassword: "siembra2026",
  acceptTerms: true,
};

describe("registroSchema", () => {
  it("acepta un alta válida", () => {
    const r = registroSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("normaliza el correo a minúsculas", () => {
    const r = registroSchema.parse(base);
    expect(r.email).toBe("valeria.ramos@example.com");
  });

  it.each([
    ["(939) 835-0044", "+19398350044"],
    ["939-835-0044", "+19398350044"],
    ["+1 939 835 0044", "+19398350044"],
    ["9398350044", "+19398350044"],
  ])("normaliza el teléfono %s a E.164", (entrada, esperado) => {
    expect(registroSchema.parse({ ...base, phone: entrada }).phone).toBe(esperado);
  });

  it("rechaza un teléfono corto", () => {
    const r = registroSchema.safeParse({ ...base, phone: "939835" });
    expect(r.success).toBe(false);
  });

  it("acepta nombres con acentos y ñ", () => {
    expect(registroSchema.safeParse({ ...base, firstName: "Begoña" }).success).toBe(true);
    expect(registroSchema.safeParse({ ...base, lastName: "Núñez-Peña" }).success).toBe(true);
  });

  it("rechaza nombres con dígitos", () => {
    expect(registroSchema.safeParse({ ...base, firstName: "Val3ria" }).success).toBe(false);
  });

  it("exige contraseñas coincidentes y señala el campo correcto", () => {
    const r = registroSchema.safeParse({ ...base, confirmPassword: "otra12345" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.confirmPassword?.[0]).toMatch(/no coinciden/i);
    }
  });

  it.each([
    ["corta", "abc123"],
    ["sin número", "siembrabienestar"],
    ["sin letra", "12345678"],
  ])("rechaza una contraseña %s", (_caso, password) => {
    const r = registroSchema.safeParse({ ...base, password, confirmPassword: password });
    expect(r.success).toBe(false);
  });

  it("exige el consentimiento de términos", () => {
    const r = registroSchema.safeParse({ ...base, acceptTerms: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.acceptTerms?.[0]).toMatch(/términos/i);
    }
  });

  it("deja el opt-in de marketing en false si no se envía", () => {
    expect(registroSchema.parse(base).marketingOptIn).toBe(false);
  });
});

describe("loginSchema — protección de open redirect", () => {
  const cred = { email: "a@b.com", password: "x" };

  it.each(["/perfil", "/wallet/canjear"])("acepta la ruta interna %s", (siguiente) => {
    expect(loginSchema.safeParse({ ...cred, siguiente }).success).toBe(true);
  });

  it.each([
    "https://evil.example.com",
    "//evil.example.com",
    "http://localhost:3000/perfil",
  ])("rechaza el destino externo %s", (siguiente) => {
    expect(loginSchema.safeParse({ ...cred, siguiente }).success).toBe(false);
  });
});

describe("solicitarResetSchema", () => {
  it("rechaza un correo inválido", () => {
    expect(solicitarResetSchema.safeParse({ email: "no-es-un-correo" }).success).toBe(false);
  });
});

describe("nuevaPasswordSchema", () => {
  it("exige que ambas coincidan", () => {
    const r = nuevaPasswordSchema.safeParse({
      password: "siembra2026",
      confirmPassword: "siembra2027",
    });
    expect(r.success).toBe(false);
  });
});
