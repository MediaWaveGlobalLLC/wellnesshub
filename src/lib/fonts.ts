import { Poppins } from "next/font/google";
import localFont from "next/font/local";

/*
  Tipografía — Siembra Brand Book pág. 4

  El Brand Book declara tres familias: The Seasons, Droid Serif y Poppins.

  · Display — "The Seasons". Es de licencia comercial y NO viene en el kit.
    docs/01: «Si The Seasons no está disponible, usar Droid Serif; no reemplazarla
    silenciosamente por otra fuente.» Por eso el display cae a Droid Serif y no a
    una alternativa parecida. La variable --font-seasons queda deliberadamente sin
    definir; globals.css hace `var(--font-seasons, var(--font-droid))`.
    ➜ Para activar The Seasons: colocar el .woff2 en src/app/fonts/, declararlo con
      localFont({ variable: "--font-seasons" }) y añadirlo a fontClassNames.
      Es el único cambio necesario; el resto del sistema ya lo consume.

  · Serif — Droid Serif, self-hosted con los archivos reales
    (src/app/fonts/droid-serif-*.woff2).

  · Sans — Poppins, para UI, formularios, navegación y cuerpo.
*/

/*
  Ojo: next/font deriva el nombre de la familia CSS del identificador exportado.
  Un export llamado `serif` producía una familia llamada literalmente "serif", que
  choca con la palabra clave genérica de CSS y hacía que el navegador la descartara.
  Por eso los nombres son explícitos.
*/

// Serif editorial — títulos, display por fallback contractual, citas y manifiesto.
export const droidSerif = localFont({
  src: [
    { path: "../app/fonts/droid-serif-regular.woff2", weight: "400", style: "normal" },
    { path: "../app/fonts/droid-serif-bold.woff2", weight: "700", style: "normal" },
    { path: "../app/fonts/droid-serif-italic.woff2", weight: "400", style: "italic" },
    { path: "../app/fonts/droid-serif-bold-italic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-droid",
  display: "swap",
});

// Sans — UI, botones, labels, navegación (Poppins).
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

/**
 * Estas clases DEBEN ir en <html>, no en <body>.
 *
 * El bloque @theme de Tailwind declara --font-sans/--font-serif en :root
 * referenciando estas variables. Una custom property cuyo var() apunta a algo no
 * definido en ese mismo elemento queda inválida en tiempo de cómputo, y entonces
 * toda la tipografía cae al sans del sistema. Definiéndolas en <html> quedan
 * disponibles en :root.
 */
export const fontClassNames = `${droidSerif.variable} ${poppins.variable}`;
