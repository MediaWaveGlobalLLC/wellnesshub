import type { Metadata } from "next";

import { Card } from "@/components/ui/Surface";
import { Alert } from "@/components/ui/Surface";
import { CompraForm } from "@/components/gift-cards/CompraForm";
import { TarjetaRegalo } from "@/components/gift-cards/TarjetaRegalo";
import { obtenerUsuario } from "@/lib/auth/session";
import { LeafIcon, GiftIcon, HeartIcon } from "@/components/icons";

/**
 * /gift-cards — mockup 03.
 *
 * Hero editorial con la tarjeta, tres razones y la columna de compra en cuatro
 * pasos. El arte de la tarjeta se compone en código (D13): no hay render entre
 * los assets entregados.
 */
export const metadata: Metadata = {
  title: "Gift cards",
  description:
    "Regala café de especialidad, matcha y momentos que nutren. Gift cards de SIEMBRA, digitales o físicas.",
};

export const dynamic = "force-dynamic";

const RAZONES = [
  { Icono: LeafIcon, titulo: "Válidas en todo", detalle: "Café, matcha y productos." },
  { Icono: GiftIcon, titulo: "Entrega inmediata", detalle: "Digital al instante o envío físico." },
  { Icono: HeartIcon, titulo: "Sin vencimiento", detalle: "Se usan cuando quieran." },
];

export default async function GiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelado?: string }>;
}) {
  const { cancelado } = await searchParams;
  const usuario = await obtenerUsuario();

  return (
    <>
      {/* Hero — mockup 03 */}
      <section className="grain bg-leche pb-14 pt-32 sm:pt-36">
        <div className="mx-auto grid max-w-[var(--container-content)] items-center gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-14">
          <div className="entrada entrada-1">
            <h1 className="font-display text-[clamp(2.5rem,5.5vw,4rem)] leading-[1.05] text-espresso">
              Regala bienestar
              <br />
              <em className="font-display italic text-terracota">en cada momento.</em>
            </h1>
            <p className="mt-5 max-w-md leading-relaxed text-text-muted">
              Nuestras gift cards son el detalle perfecto para compartir café, matcha y
              momentos que nutren el cuerpo, la mente y el alma.
            </p>

            <ul className="mt-9 grid gap-6 sm:grid-cols-3">
              {RAZONES.map(({ Icono, titulo, detalle }) => (
                <li key={titulo}>
                  <Icono size={26} className="text-espresso" />
                  <p className="mt-3 text-sm font-semibold text-espresso">{titulo}</p>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">{detalle}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="entrada entrada-2 mx-auto w-full max-w-md">
            <TarjetaRegalo tono="forest" />
          </div>
        </div>
      </section>

      {/* Compra */}
      <section className="bg-surface py-14 sm:py-20">
        <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <Card className="p-6 sm:p-8">
              <h2 className="font-display text-2xl text-espresso">Compra una gift card</h2>

              {cancelado && (
                <div className="mt-5">
                  <Alert>
                    Cancelaste el pago y no se cobró nada. Puedes volver a intentarlo cuando quieras.
                  </Alert>
                </div>
              )}

              <div className="mt-7">
                <CompraForm haySesion={Boolean(usuario)} />
              </div>
            </Card>

            <aside className="space-y-5">
              <TarjetaRegalo tono="terracota" />
              <Card className="p-6">
                <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Cómo funciona
                </h3>
                <ol className="mt-4 space-y-3 text-sm leading-relaxed text-text-muted">
                  <li>
                    <strong className="text-espresso">1.</strong> Eliges monto, formato y a quién va.
                  </li>
                  <li>
                    <strong className="text-espresso">2.</strong> Pagas de forma segura con Stripe.
                  </li>
                  <li>
                    <strong className="text-espresso">3.</strong> Recibe un código único por correo.
                  </li>
                  <li>
                    <strong className="text-espresso">4.</strong> Lo canjea desde su cuenta y el
                    saldo entra directo a sus créditos.
                  </li>
                </ol>
              </Card>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
