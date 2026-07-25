"use client";

import Image from "next/image";
import { useLang } from "@/lib/i18n";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { SITE } from "@/lib/site";

export default function VisitanosPage() {
  const { lang } = useLang();

  return (
    <>
      <PageHero
        eyebrow={lang === "es" ? "Te esperamos" : "We're waiting for you"}
        title={lang === "es" ? "Visítanos" : "Visit us"}
        subtitle={
          lang === "es"
            ? "En el corazón de Condado, a pasos de la playa de Escambrón."
            : "In the heart of Condado, steps from Escambrón beach."
        }
      />

      <section className="bg-leche pb-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-2">
          {/* Info */}
          <Reveal>
            <div className="space-y-8">
              {/* Dirección */}
              <div className="rounded-2xl border border-espresso/10 bg-white/60 p-7">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-terracota">
                  <span>📍</span> {lang === "es" ? "Dirección" : "Address"}
                </h3>
                <a
                  href={SITE.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block font-display text-2xl font-medium text-espresso underline-offset-4 hover:underline"
                >
                  {SITE.address}
                </a>
              </div>

              {/* Horario */}
              <div className="rounded-2xl border border-espresso/10 bg-white/60 p-7">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-terracota">
                  <span>🕙</span> {lang === "es" ? "Horario" : "Hours"}
                </h3>
                <p className="mt-3 font-display text-2xl font-medium text-espresso">{SITE.hours}</p>
                <p className="mt-1 text-sm text-espresso/55">
                  {lang === "es" ? "Todos los días" : "Every day"}
                </p>
              </div>

              {/* Contacto */}
              <div className="rounded-2xl border border-espresso/10 bg-white/60 p-7">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-terracota">
                  <span>✆</span> {lang === "es" ? "Contacto" : "Contact"}
                </h3>
                <div className="mt-3 space-y-2.5">
                  <a
                    href={`tel:${SITE.phone.replace(/[^\d]/g, "")}`}
                    className="block font-display text-2xl font-medium text-espresso underline-offset-4 hover:underline"
                  >
                    {SITE.phone}
                  </a>
                  <a
                    href={SITE.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-semibold text-olive underline-offset-4 hover:underline"
                  >
                    {SITE.instagram} ↗
                  </a>
                </div>
              </div>

              {/* CTA */}
              <a
                href={SITE.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-full bg-terracota px-8 py-4 text-center text-sm font-bold uppercase tracking-widest text-leche shadow-warm transition-all hover:scale-[1.02] hover:bg-espresso"
              >
                {lang === "es" ? "Abrir en Google Maps" : "Open in Google Maps"}
              </a>
            </div>
          </Reveal>

          {/* Mapa + foto */}
          <Reveal delay={0.12}>
            <div className="space-y-6">
              <div className="overflow-hidden rounded-3xl border border-espresso/10 shadow-soft">
                <iframe
                  title="Siembra Cafe — 1024 Ashford Avenue, Condado"
                  src="https://www.google.com/maps?q=1024+Ashford+Avenue+Condado+San+Juan+Puerto+Rico&output=embed"
                  width="100%"
                  height="380"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
              <Image
                src="/brand/fotos/Siembra Coffee & Matcha.webp"
                alt="Siembra Cafe & Matcha Bar"
                width={800}
                height={500}
                className="w-full rounded-3xl object-cover shadow-soft"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Franja The Wellness Hub ─── */}
      <section className="grain bg-forest py-16 text-center text-leche">
        <div className="mx-auto max-w-2xl px-6">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-matcha">
              {SITE.wellnessHub}
            </p>
            <p className="mt-4 font-display text-2xl font-light italic text-avena sm:text-3xl">
              {lang === "es"
                ? "Siembra es el corazón gastronómico del Wellness Hub en Escambrón."
                : "Siembra is the culinary heart of the Wellness Hub in Escambrón."}
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
