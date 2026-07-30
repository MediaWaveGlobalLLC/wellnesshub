import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { fontClassNames } from "@/lib/fonts";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "Siembra Cafe — Wellness Hub | Coffee & Matcha Bar",
    template: "%s · Siembra Cafe",
  },
  description:
    "Siembra Cafe & Matcha Bar — Wellness Hub en Condado, Puerto Rico. Café, matcha, smoothies y experiencias de bienestar. Siembra bienestar, cosecha tu mejor versión.",
  metadataBase: new URL("https://wellnesshub.vercel.app"),
  openGraph: {
    title: "Siembra Cafe — Wellness Hub | Coffee & Matcha Bar",
    description:
      "Café, matcha y bienestar en Condado, Puerto Rico. Siembra bienestar, cosecha tu mejor versión.",
    url: "https://wellnesshub.vercel.app",
    siteName: "Siembra Cafe",
    locale: "es_PR",
    type: "website",
    images: [{ url: "/brand/fotos/siembra-promo-square.webp", width: 1080, height: 1080 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Siembra Cafe — Wellness Hub | Coffee & Matcha Bar",
    description: "Café, matcha y bienestar en Condado, Puerto Rico.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={fontClassNames} suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
        </Providers>

        {/*
          Vercel Web Analytics.

          Pasa la CSP sin tocarla, y conviene dejarlo escrito porque en `0016`
          afirmé lo contrario: el script NO viene de un dominio externo. Estando
          desplegado, Vercel lo sirve desde el propio origen
          (`/_vercel/insights/script.js`) y el beacon va a
          `/_vercel/insights/event`, así que `script-src 'self'` y
          `connect-src 'self'` ya lo cubren. Aquella objeción valía para un CDN
          de terceros; para esto, no.

          SOLO CUANDO ESTÁ DESPLEGADO EN VERCEL. Fuera de ahí el paquete carga
          un script de depuración desde `va.vercel-scripts.com` —ese sí externo,
          y la CSP lo bloquea— y avisa por consola de que «puede haber un
          bloqueador de anuncios activo», que manda a buscar el problema al
          sitio equivocado. Y no se pierde nada: en local no existe el endpoint
          que recoge los datos, así que no mediría nada de todos modos.

          Convive con el recuento propio de `/admin/visitas`, que cuenta desde
          el servidor. Miden cosas distintas y no hay que cuadrarlas: este
          cuenta lo que el navegador consigue reportar —y se pierde con
          bloqueadores—, aquel cuenta lo que el servidor sirve.
        */}
        {process.env.VERCEL === "1" && <Analytics />}
      </body>
    </html>
  );
}
