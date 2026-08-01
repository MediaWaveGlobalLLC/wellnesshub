"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge, Card } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { EmptyState } from "@/components/states";
import { CheckIcon, LapizIcon, MasIcon } from "@/components/icons";
import { entregarCanje, guardarRecompensa, type Resultado } from "@/lib/admin/acciones";
import { formatearPuntos } from "@/lib/loyalty";
import type { CanjePendiente, RecompensaAdmin } from "@/lib/services/lealtad-admin";

/**
 * Catálogo de recompensas y cola del mostrador.
 *
 * Dos trabajos distintos en una pantalla porque se miran a la vez: quien está
 * en barra despacha la cola, y la dueña además decide qué hay en el catálogo.
 * El permiso los separa —`entregar_recompensa` lo tiene el empleado,
 * `configurar_recompensas` solo la dueña—, así que el mostrador ve la cola y no
 * el formulario.
 */

type Foto = { clave: string; src: string };

function fecha(iso: string): string {
  return new Intl.DateTimeFormat("es-PR", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Puerto_Rico",
  }).format(new Date(iso));
}

export function PanelRecompensas({
  recompensas,
  pendientes,
  fotos,
  puedeConfigurar,
  puedeEntregar,
}: {
  recompensas: RecompensaAdmin[];
  pendientes: CanjePendiente[];
  fotos: Foto[];
  puedeConfigurar: boolean;
  puedeEntregar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [editando, setEditando] = useState<RecompensaAdmin | "nueva" | null>(null);

  function ejecutar(fn: () => Promise<Resultado>) {
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      if (r.ok) {
        setAviso({ tono: "ok", texto: r.mensaje });
        setEditando(null);
        router.refresh();
      } else {
        setAviso({ tono: "error", texto: r.error });
      }
    });
  }

  return (
    <>
      {aviso && (
        <p
          role={aviso.tono === "error" ? "alert" : "status"}
          className={`mt-5 flex items-start gap-1.5 text-sm ${
            aviso.tono === "error" ? "text-danger" : "text-olive"
          }`}
        >
          {aviso.tono === "ok" && <CheckIcon size={15} />}
          {aviso.texto}
        </p>
      )}

      {/* ── La cola ────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="font-display text-xl text-espresso">
          Por entregar {pendientes.length > 0 && `(${pendientes.length})`}
        </h2>

        {pendientes.length === 0 ? (
          <Card className="mt-4 p-8">
            <EmptyState
              titulo="Nada pendiente"
              descripcion="Cuando alguien canjee una recompensa, aparecerá aquí con su código."
            />
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {pendientes.map((c) => (
              <li key={c.id}>
                <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-display text-lg text-espresso">
                      {c.nombre}
                      <span className="ml-3 font-display text-base tracking-wide text-terracota">
                        {c.codigo}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-text-muted">
                      {c.persona ?? c.email ?? "Sin nombre"} · {formatearPuntos(c.costoPuntos)} pts
                      · {fecha(c.creado)}
                    </p>
                  </div>

                  {puedeEntregar && (
                    <Button
                      type="button"
                      size="md"
                      variant="forest"
                      cargando={pendiente}
                      onClick={() => ejecutar(() => entregarCanje({ redemptionId: c.id }))}
                    >
                      Entregar
                    </Button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── El catálogo ────────────────────────────────────────────────── */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl text-espresso">Catálogo</h2>
          {puedeConfigurar && editando === null && (
            <Button type="button" size="md" onClick={() => setEditando("nueva")}>
              <MasIcon size={14} />
              Añadir recompensa
            </Button>
          )}
        </div>

        {editando !== null && puedeConfigurar && (
          <FormularioRecompensa
            recompensa={editando === "nueva" ? null : editando}
            fotos={fotos}
            pendiente={pendiente}
            onCancelar={() => setEditando(null)}
            onGuardar={(datos) => ejecutar(() => guardarRecompensa(datos))}
          />
        )}

        {recompensas.length === 0 ? (
          <Card className="mt-4 p-8">
            <EmptyState
              titulo="El catálogo está vacío"
              descripcion="Mientras no haya recompensas, los puntos de tus clientes no se pueden gastar en nada."
            />
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {recompensas.map((r) => {
              const foto = fotos.find((f) => f.clave === r.imagenClave);
              return (
                <li key={r.id}>
                  <Card className="flex flex-wrap items-center gap-4 p-4">
                    {foto ? (
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
                        <Image src={foto.src} alt="" fill sizes="64px" className="object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-[0.6rem] uppercase tracking-[0.1em] text-text-muted">
                        Sin foto
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg text-espresso">
                        {r.nombre}
                        <span className="ml-3 text-sm font-normal text-terracota">
                          {formatearPuntos(r.costoPuntos)} pts
                        </span>
                      </p>
                      {r.descripcion && (
                        <p className="mt-0.5 text-sm text-text-muted">{r.descripcion}</p>
                      )}
                      <p className="mt-1 text-xs text-text-muted">
                        {r.existencias === null ? "Sin límite" : `${r.existencias} disponibles`} ·
                        Canjeada {r.vecesCanjeada} {r.vecesCanjeada === 1 ? "vez" : "veces"}
                        {r.pendientes > 0 && ` · ${r.pendientes} por entregar`}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge tono={r.activa ? "exito" : "neutro"}>
                        {r.activa ? "Publicada" : "Retirada"}
                      </Badge>
                      {puedeConfigurar && (
                        <Button
                          type="button"
                          size="md"
                          variant="secundario"
                          onClick={() => setEditando(r)}
                        >
                          <LapizIcon size={14} />
                          Editar
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

/**
 * Alta y edición.
 *
 * La foto se elige de una lista cerrada —el manifiesto de marca—, no se sube ni
 * se pega una URL: `docs/01` prohíbe imágenes remotas o inventadas, y una
 * recompensa sin foto se pinta tipográfica, que también es válido.
 */
function FormularioRecompensa({
  recompensa,
  fotos,
  pendiente,
  onGuardar,
  onCancelar,
}: {
  recompensa: RecompensaAdmin | null;
  fotos: Foto[];
  pendiente: boolean;
  onGuardar: (datos: Record<string, unknown>) => void;
  onCancelar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function enviar(fd: FormData) {
    setError(null);

    const costo = Number(String(fd.get("costo") ?? "").trim());
    if (!Number.isFinite(costo) || costo <= 0) {
      setError("Escribe cuántos puntos cuesta.");
      return;
    }

    // Vacío = sin límite. Es lo normal: una bebida gratis no se agota.
    const stockEscrito = String(fd.get("existencias") ?? "").trim();
    const existencias = stockEscrito === "" ? null : Number(stockEscrito);
    if (existencias !== null && (!Number.isInteger(existencias) || existencias < 0)) {
      setError("Las existencias tienen que ser un número entero, o vacío para sin límite.");
      return;
    }

    onGuardar({
      rewardId: recompensa?.id,
      nombre: String(fd.get("nombre") ?? ""),
      descripcion: String(fd.get("descripcion") ?? ""),
      costoPuntos: Math.round(costo),
      imagenClave: String(fd.get("imagen") ?? ""),
      existencias,
      orden: Number(String(fd.get("orden") ?? "0").trim()) || 0,
      activa: fd.get("activa") === "on",
      reason: String(fd.get("motivo") ?? ""),
    });
  }

  return (
    <Card className="mt-4 p-5">
      <form action={enviar} className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nombre"
          name="nombre"
          required
          defaultValue={recompensa?.nombre ?? ""}
          placeholder="Bebida gratis"
        />
        <Field
          label="Cuesta (puntos)"
          name="costo"
          type="text"
          inputMode="numeric"
          required
          defaultValue={recompensa ? String(recompensa.costoPuntos) : ""}
          placeholder="500"
          error={error ?? undefined}
        />

        <div className="sm:col-span-2">
          <Field
            label="Descripción (opcional)"
            name="descripcion"
            defaultValue={recompensa?.descripcion ?? ""}
            placeholder="Cualquier bebida de la carta, de la casa."
          />
        </div>

        <div>
          <label
            htmlFor="imagen"
            className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted"
          >
            Foto
          </label>
          <select
            id="imagen"
            name="imagen"
            defaultValue={recompensa?.imagenClave ?? ""}
            className="min-h-[var(--control-height)] w-full rounded-lg border border-border bg-surface px-4 text-espresso focus:border-terracota focus:outline-none"
          >
            <option value="">Sin foto</option>
            {fotos.map((f) => (
              <option key={f.clave} value={f.clave}>
                {f.clave}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-text-muted">
            Solo fotos de marca aprobadas. Sin foto se ve el nombre en grande.
          </p>
        </div>

        <Field
          label="Existencias (vacío = sin límite)"
          name="existencias"
          type="text"
          inputMode="numeric"
          defaultValue={recompensa?.existencias === null ? "" : String(recompensa?.existencias ?? "")}
          placeholder="Sin límite"
        />

        <Field
          label="Orden"
          name="orden"
          type="text"
          inputMode="numeric"
          defaultValue={String(recompensa?.orden ?? 0)}
        />

        <label className="flex items-center gap-2.5 self-end pb-3 text-sm text-espresso">
          <input
            type="checkbox"
            name="activa"
            defaultChecked={recompensa?.activa ?? true}
            className="h-4 w-4 accent-[var(--color-terracota)]"
          />
          Publicada
        </label>

        <div className="sm:col-span-2">
          <Field
            label="Motivo (obligatorio)"
            name="motivo"
            required
            minLength={6}
            placeholder="Queda en la auditoría"
          />
        </div>

        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <Button type="submit" size="md" cargando={pendiente}>
            {recompensa ? "Guardar cambios" : "Crear recompensa"}
          </Button>
          <Button type="button" size="md" variant="terciario" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
