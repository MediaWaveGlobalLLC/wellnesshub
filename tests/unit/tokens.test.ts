import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tokens = JSON.parse(
  fs.readFileSync(path.join(root, "config", "design-tokens.json"), "utf8")
);
const css = fs.readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");

/** Los 10 colores oficiales del Brand Book p3, por su nombre de marca. */
const BRAND_COLORS: Record<string, string> = {
  terracota: tokens.colors.terracotta,
  mustard: tokens.colors.mustard,
  avena: tokens.colors.oat,
  leche: tokens.colors.milk,
  espresso: tokens.colors.espresso,
  teatree: tokens.colors.teaTree,
  matcha: tokens.colors.matcha,
  olive: tokens.colors.olive,
  lightmatcha: tokens.colors.lightMatcha,
  forest: tokens.colors.forest,
};

describe("design tokens", () => {
  it("globals.css está sincronizado con config/design-tokens.json", () => {
    // El generador sale con 1 si el CSS quedó desincronizado.
    expect(() =>
      execFileSync("node", ["scripts/generate-tokens.mjs", "--check"], { cwd: root })
    ).not.toThrow();
  });

  it.each(Object.entries(BRAND_COLORS))(
    "declara --color-%s con el hex oficial",
    (name, hex) => {
      expect(css).toContain(`--color-${name}: ${hex.toUpperCase()}`);
    }
  );

  it("no introduce ningún hex fuera de la paleta oficial", () => {
    const allowed = new Set(
      (JSON.stringify(tokens).match(/#[0-9a-fA-F]{6}/g) ?? []).map((h) => h.toUpperCase())
    );
    const used = (css.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toUpperCase());
    expect([...new Set(used)].filter((h) => !allowed.has(h))).toEqual([]);
  });

  it("respeta el radio máximo aprobado de 24px", () => {
    expect(tokens.radius.maxApproved).toBe(24);
    expect(css).toContain("--radius-lg: 16px");
    expect(css).toContain("--radius-max-approved: 24px");
  });

  it("mantiene la altura mínima de botón en 48px", () => {
    expect(css).toContain(`--button-min-height: ${tokens.controls.buttonMinHeight}px`);
  });

  it("no cae a una fuente no autorizada cuando falta The Seasons", () => {
    // docs/01: si The Seasons no está disponible se usa Droid Serif, nunca otra.
    const displayLine = css.split("\n").find((l) => l.includes("--font-display:"))!;
    expect(displayLine).toContain("--font-droid");
    for (const forbidden of tokens.forbidden.fontFamilies) {
      expect(displayLine).not.toContain(forbidden);
    }
  });
});
