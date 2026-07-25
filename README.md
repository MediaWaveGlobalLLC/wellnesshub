# Siembra Cafe & Matcha Bar — Wellness Hub

Sitio web oficial de **Siembra Cafe & Matcha Bar** (Wellness Hub | Coffee & Matcha Bar), Condado, Puerto Rico.

> *Siembra bienestar. Cosecha tu mejor versión.*

## 🌿 El proyecto

Web pública bilingüe (español / inglés) para el café & matcha bar de Siembra:

- **Home** — hero editorial, manifiesto, barras de Café y Matcha, mezclas funcionales, "Un día en Siembra" y Club Siembra
- **Menú** — carta oficial con precios verificados
- **Experiencia** — eventos y comunidad (yoga, running, bienestar)
- **Nosotros** — historia y pilares de la marca
- **Tienda** — catálogo de productos
- **Visítanos** — ubicación, horario y contacto

**Próximamente (Parte 2):** Club Siembra — programa de lealtad, pedidos y experiencias exclusivas para miembros.

## ☕ El negocio

| | |
|---|---|
| **Nombre** | Siembra Cafe & Matcha Bar (Wellness Hub) |
| **Dirección** | 1024 Ashford Avenue, Condado, San Juan, Puerto Rico |
| **Horario** | 10:00 AM – 7:00 PM |
| **Teléfono** | (939) 835-0044 |
| **Instagram** | [@thewellnesshubpr](https://instagram.com/thewellnesshubpr) |

**Pilares:** Nutre tu cuerpo ✦ Fortalece tu bienestar ✦ Eleva tu comunidad

## 🛠️ Stack

- [Next.js](https://nextjs.org) 16 (App Router) + React 19
- TypeScript
- [Tailwind CSS](https://tailwindcss.com) 4 (CSS-first, tokens de la paleta oficial de 10 colores de la marca)
- Framer Motion (animaciones)
- Tipografías: Fraunces (display) + Droid Serif + Poppins

## 🚀 Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # build de producción
npm run lint    # ESLint
```

## 🌐 Producción

Desplegado en Vercel (Media Wave Global). Alias estable:

**https://wellnesshub-media-wave-global.vercel.app**

Los pushes a `main` despliegan automáticamente.

## 📁 Estructura

```
src/
  app/            # rutas públicas (/, /menu, /experiencia, /nosotros, /tienda, /visitanos)
  components/     # UI compartida (Header, Footer, animaciones)
  lib/            # datos del sitio (site.ts), i18n, fuentes
public/brand/     # logos, fotos y elementos de marca (WebP)
```

---

*Siembra Cafe & Matcha Bar · Veinte de Diez LLC*
