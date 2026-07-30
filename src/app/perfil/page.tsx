import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { obtenerDashboard } from "@/lib/services/profile-service";
import { ErrorState } from "@/components/states";
import { TarjetaCredito, TarjetaMembresia } from "@/components/perfil/TarjetasResumen";
import {
  AccionesGrid,
  Actividad,
  CodigoMiembro,
  Favoritos,
  ProximoTaller,
} from "@/components/perfil/ModulosPerfil";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";

/**
 * /perfil — mockup 02.
 *
 * Server Component: llama al servicio directamente en vez de pasar por
 * /api/profile/dashboard, ahorrándose un salto de red. La sesión se vuelve a
 * verificar aquí (docs/06); el proxy solo redirige de forma optimista.
 */
export const metadata: Metadata = {
  title: "Mi perfil",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** El QR lleva un token público revocable, nunca saldo ni correo (docs/04). */
async function generarQr(token: string | null): Promise<string | null> {
  if (!token) return null;
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  try {
    return await QRCode.toString(`${base}/m/${token}`, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      // Espresso sobre Leche: los colores de marca, no el negro por defecto.
      color: { dark: "#45200a", light: "#f4ece3" },
    });
  } catch {
    return null;
  }
}

export default async function PerfilPage() {
  const dashboard = await obtenerDashboard();

  // Sin sesión no hay perfil que enseñar. `siguiente` permite volver aquí.
  if (!dashboard) redirect("/iniciar-sesion?siguiente=%2Fperfil");

  const { perfil, membresia, walletCents, actividad, favoritos, proximoEvento } = dashboard;
  const qrSvg = await generarQr(dashboard.qrToken);
  const nombreCompleto = [perfil.nombre, perfil.apellido].filter(Boolean).join(" ");

  return (
    <div className="grain min-h-screen bg-leche pb-20 pt-28 sm:pt-32">
      <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
        {/* Saludo — mockup 02, encabezado */}
        <section className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-5">
              {/* El radio completo está permitido en el avatar; el validador lo
                  reconoce por el nombre en la misma línea de la clase. */}
              <div className="avatar relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border sm:h-24 sm:w-24">
                <Image
                  src={perfil.avatarUrl ?? BRAND_ASSETS.duenaDeSiembraTransparente.src}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-xl text-espresso">
                  {nombreCompleto || "Tu cuenta"}
                </p>
                {perfil.email && (
                  <p className="truncate text-sm text-text-muted">{perfil.email}</p>
                )}
                <Link
                  href="/perfil/editar"
                  className="mt-1 inline-block text-sm font-semibold text-terracota underline underline-offset-4"
                >
                  Editar perfil
                </Link>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <h1 className="font-display text-3xl leading-tight text-espresso sm:text-4xl">
              Hola, <span className="text-terracota">{perfil.nombre ?? "bienvenida"}.</span>
            </h1>
            <p className="mt-2 font-display text-lg italic leading-snug text-terracota sm:text-xl">
              Aquí gestionas tu cuenta, recompensas y experiencias.
            </p>
          </div>
        </section>

        {/* Módulos prioritarios */}
        <section className="mt-10 grid gap-5 lg:grid-cols-2">
          <TarjetaMembresia membresia={membresia} />
          <TarjetaCredito centavos={walletCents} />
        </section>

        {/* Acciones de cuenta */}
        <section className="mt-5">
          <AccionesGrid />
        </section>

        {/* Actividad, favoritos, taller y código */}
        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <Actividad movimientos={actividad} />

          <div className="space-y-5">
            <Favoritos items={favoritos} />
            <ProximoTaller evento={proximoEvento} />
          </div>

          <CodigoMiembro
            memberId={perfil.memberId}
            nivel={membresia.actual.label}
            qrSvg={qrSvg}
          />
        </section>

        {!qrSvg && (
          <div className="mt-5">
            <ErrorState descripcion="No pudimos generar tu código de miembro. Recarga la página o pídelo en caja." />
          </div>
        )}
      </div>
    </div>
  );
}
