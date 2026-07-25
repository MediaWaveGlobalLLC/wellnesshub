import { Fraunces, Poppins } from "next/font/google";
import localFont from "next/font/local";

/*
  Tipografía — Siembra Brand Book (pág. 4)
  · Display: "The Seasons" en el brand book. Ese archivo no está en ningún CDN
    ni package manager (descarga gratuita directa del diseñador), así que se usa
    Fraunces — la alternativa libre más cercana (serif de alto contraste con
    itálicas, mismo espíritu editorial-orgánico).
    ➜ Para usar The Seasons real: colocar el .woff2 en src/app/fonts/ y
      reemplazar `display` aquí con next/font/local. Único cambio necesario.
  · Serif: Droid Serif — self-hosted con los archivos reales de Google Fonts
    (src/app/fonts/droid-serif-*.woff2), tal como pide el brand book.
  · Sans: Poppins — Google Fonts, tal como pide el brand book.
*/

// Display — titulares grandes, wordmark (The Seasons → Fraunces)
export const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

// Serif — títulos secundarios, citas, manifiesto (Droid Serif real)
export const serif = localFont({
  src: [
    { path: "../app/fonts/droid-serif-regular.woff2", weight: "400", style: "normal" },
    { path: "../app/fonts/droid-serif-bold.woff2", weight: "700", style: "normal" },
    { path: "../app/fonts/droid-serif-italic.woff2", weight: "400", style: "italic" },
    { path: "../app/fonts/droid-serif-bold-italic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-droid",
  display: "swap",
});

// Sans — UI, botones, labels, navegación (Poppins)
export const sans = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const fontClassNames = `${display.variable} ${serif.variable} ${sans.variable}`;
