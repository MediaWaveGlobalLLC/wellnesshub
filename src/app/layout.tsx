import type { Metadata } from "next";
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
    images: [{ url: "/brand/fotos/Siembra Promo Square.webp", width: 1080, height: 1080 }],
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
    <html lang="es" suppressHydrationWarning>
      <body className={`${fontClassNames} antialiased`}>
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
