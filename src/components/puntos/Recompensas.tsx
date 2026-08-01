"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert, Card } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/icons";
import { canjearRecompensa } from "@/lib/recompensas/acciones";
import { formatearPuntos } from "@/lib/loyalty";
import type { Recompensa } from "@/lib/services/recompensas";
import { cn } from "@/lib/cn";

/**
 * «Canjea tus puntos» — `05-cuenta-movil-reference.png`.
 *
 * Dos columnas en móvil, cuatro en escritorio: la referencia enseña una fila de
 * tarjetas con foto, precio en puntos y poco más.
 *
 * Una recompensa sin foto se pinta tipográfica en vez de con una imagen de
 * relleno. `docs/01` prohíbe fotos inventadas o de banco, así que mientras no
 * haya asset de marca aprobado, no hay foto — y la tarjeta tiene que verse bien
 * igual.
 */
export function Recompensas({ recompensas }: { recompensas: Recompensa[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ganado, setGanado] = useState<{ codigo: string; nombre: string } | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  /*
    Identificador de este intento, igual que en el canje de gift cards: si el
    envío se reintenta tras un fallo de red, la función SQL lo reconoce y no
    descuenta los puntos dos veces. Se renueva solo tras un canje que sí salió.
  */
  const intento = useRef<string | null>(null);

  function canjear(id: string) {
    const idIntento = (intento.current ??= crypto.randomUUID());
    setError(null);

    iniciar(async () => {
      const r = await canjearRecompensa({ rewardId: id, clientRequestId: idIntento });
      if (!r.ok) {
        setError(r.error);
        setConfirmando(null);
        return;
      }
      setGanado({ codigo: r.codigo, nombre: r.nombre });
      setConfirmando(null);
      intento.current = crypto.randomUUID();
      router.refresh();
    });
  }

  if (recompensas.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-espresso">Canjea tus puntos</h2>

      {error && (
        <div className="mt-4">
          <Alert tono="error">{error}</Alert>
        </div>
      )}

      {ganado && (
        <div className="mt-4">
          <Alert tono="exito" titulo={`¡${ganado.nombre} es tuyo!`}>
            <p>
              Enseña este código en el mostrador:{" "}
              <strong className="font-display text-lg tracking-wide">{ganado.codigo}</strong>
            </p>
            <p className="mt-1 text-sm">
              Lo tienes guardado aquí abajo hasta que lo recojas. No hace falta que lo apuntes.
            </p>
          </Alert>
        </div>
      )}

      <ul className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {recompensas.map((r) => {
          const agotada = r.existencias !== null && r.existencias <= 0;
          const confirmar = confirmando === r.id;

          return (
            <li key={r.id}>
              <Card className="flex h-full flex-col overflow-hidden">
                {r.imagen ? (
                  <div className="relative aspect-square w-full">
                    <Image
                      src={r.imagen.src}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 45vw, 220px"
                      className={cn("object-cover", !r.alcanza && "opacity-50")}
                    />
                  </div>
                ) : (
                  /* Sin foto de marca: tarjeta tipográfica, no relleno. */
                  <div
                    className={cn(
                      "flex aspect-square w-full items-center justify-center bg-surface-muted p-4",
                      !r.alcanza && "opacity-50"
                    )}
                  >
                    <span className="text-center font-display text-xl leading-tight text-espresso/40">
                      {r.nombre}
                    </span>
                  </div>
                )}

                <div className="flex flex-1 flex-col p-4">
                  <p className="font-display text-lg leading-tight text-espresso">{r.nombre}</p>
                  {r.descripcion && (
                    <p className="mt-1 text-sm leading-snug text-text-muted">{r.descripcion}</p>
                  )}

                  <p className="mt-2 text-sm font-semibold text-terracota">
                    {formatearPuntos(r.costoPuntos)} pts
                  </p>

                  {r.existencias !== null && r.existencias > 0 && r.existencias <= 5 && (
                    <p className="mt-1 text-xs text-text-muted">
                      Quedan {r.existencias}
                    </p>
                  )}

                  <div className="mt-4 flex-1" />

                  {agotada ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
                      Agotada
                    </p>
                  ) : confirmar ? (
                    /* Dos toques: gastar puntos no se deshace solo. */
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="md"
                        cargando={pendiente}
                        onClick={() => canjear(r.id)}
                      >
                        Confirmar
                      </Button>
                      <Button
                        type="button"
                        size="md"
                        variant="terciario"
                        onClick={() => setConfirmando(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="md"
                      variant={r.alcanza ? "primario" : "terciario"}
                      disabled={!r.alcanza || pendiente}
                      onClick={() => setConfirmando(r.id)}
                    >
                      {r.alcanza ? "Canjear" : "Te faltan puntos"}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Los canjes que la persona todavía no ha recogido. */
export function CanjesPendientes({
  canjes,
}: {
  canjes: { id: string; codigo: string; nombre: string }[];
}) {
  if (canjes.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-espresso">Para recoger</h2>
      <p className="mt-1 text-sm text-text-muted">
        Enseña el código en el mostrador y te lo entregamos.
      </p>

      <ul className="mt-5 divide-y divide-border border-y border-border">
        {canjes.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <span className="flex items-center gap-2 text-espresso">
              <CheckIcon size={15} />
              {c.nombre}
            </span>
            <span className="font-display text-lg tracking-wide text-terracota">{c.codigo}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
