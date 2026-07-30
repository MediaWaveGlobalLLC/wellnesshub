"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Select, CampoDinero } from "@/components/admin/ui/Campos";
import { Field } from "@/components/ui/Field";
import { CheckIcon, LapizIcon, PapeleraIcon } from "@/components/icons";
import { cambiarDisponibilidad, cambiarPrecio, archivarProducto } from "@/lib/catalogo/acciones";
import { MOTIVOS_DISPONIBILIDAD } from "@/lib/validation/catalogo";
import { precioLegible, type ProductoCatalogo } from "@/lib/catalogo/tipos";

/**
 * Una fila de producto en el catálogo, editable en el sitio.
 *
 * El trabajo de verdad de esta pantalla es de dos clics: marcar algo agotado y
 * corregir un precio. Sacar eso a otra página con su formulario largo convierte
 * una tarea de cinco segundos en una de treinta, y entonces nadie la hace y la
 * carta pública se queda desactualizada.
 *
 * Por eso el precio se edita en línea y el agotado es un botón. Lo que sí abre
 * confirmación es retirar un producto de la carta, que no es reversible de un
 * clic.
 */
export function FilaProducto({
  producto,
  puedeEditar,
}: {
  producto: ProductoCatalogo;
  /** Falso para un empleado: solo verá el botón de agotado. */
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  function ejecutar(fn: () => Promise<{ ok: boolean; error?: string; mensaje?: string }>) {
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      setAviso(
        r.ok
          ? { tono: "ok", texto: r.mensaje ?? "Guardado." }
          : { tono: "error", texto: r.error ?? "No se pudo guardar." }
      );
      if (r.ok) {
        setEditando(null);
        router.refresh();
      }
    });
  }

  return (
    <li className="border-b border-border py-3.5 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium text-espresso">
            {producto.nombre}
            {producto.destacado && <Badge tono="aviso">Destacado</Badge>}
            {!producto.disponible && <Badge tono="peligro">Agotado</Badge>}
            {producto.archivado && <Badge tono="neutro">Fuera de la carta</Badge>}
          </p>
          {producto.nota && (
            <p className="mt-0.5 text-xs italic text-text-muted">{producto.nota}</p>
          )}
          <p className="mt-0.5 font-mono text-[0.65rem] text-text-muted">{producto.slug}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Precios: uno por tamaño. */}
          {producto.variantes.map((v) => (
            <span key={v.id} className="flex items-center gap-1.5">
              {v.etiqueta && (
                <span className="text-[0.65rem] uppercase tracking-wider text-text-muted">
                  {v.etiqueta}
                </span>
              )}
              {puedeEditar ? (
                <button
                  type="button"
                  onClick={() => setEditando(editando === v.id ? null : v.id)}
                  aria-expanded={editando === v.id}
                  className="flex items-center gap-1 font-display text-base text-espresso underline decoration-terracota decoration-2 underline-offset-4 transition-colors hover:text-primary-hover"
                >
                  ${precioLegible(v.precioCents)}
                  <LapizIcon size={13} />
                </button>
              ) : (
                <span className="font-display text-base text-espresso">
                  ${precioLegible(v.precioCents)}
                </span>
              )}
            </span>
          ))}

          {/* Agotado: un clic, con motivo de lista. Lo puede hacer el mostrador. */}
          <AccionAgotado producto={producto} onEjecutar={ejecutar} pendiente={pendiente} />

          {puedeEditar && !producto.archivado && (
            <AccionArchivar producto={producto} onEjecutar={ejecutar} pendiente={pendiente} />
          )}
        </div>
      </div>

      {/* Edición de precio, desplegada bajo la fila. */}
      {editando && (
        <form
          className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-surface-muted p-3"
          action={(fd) =>
            ejecutar(() =>
              cambiarPrecio({
                varianteId: editando,
                precioCents: String(fd.get("precio") ?? ""),
                reason: String(fd.get("motivo") ?? ""),
              })
            )
          }
        >
          <div className="w-32">
            <CampoDinero
              label="Nuevo precio"
              name="precio"
              defaultValue={producto.variantes.find((v) => v.id === editando)?.precioCents}
              required
            />
          </div>
          <div className="min-w-[14rem] flex-1">
            <Field label="Motivo" name="motivo" required minLength={6} placeholder="Por qué cambia" />
          </div>
          <Button type="submit" size="md" cargando={pendiente}>
            Guardar
          </Button>
          <Button type="button" size="md" variant="terciario" onClick={() => setEditando(null)}>
            Cancelar
          </Button>
        </form>
      )}

      {aviso && (
        <p
          role={aviso.tono === "error" ? "alert" : "status"}
          className={`mt-2 flex items-center gap-1.5 text-xs ${aviso.tono === "error" ? "text-danger" : "text-olive"}`}
        >
          {aviso.tono === "ok" && <CheckIcon size={14} />}
          {aviso.texto}
        </p>
      )}
    </li>
  );
}

type Ejecutar = (fn: () => Promise<{ ok: boolean; error?: string; mensaje?: string }>) => void;

function AccionAgotado({
  producto,
  onEjecutar,
  pendiente,
}: {
  producto: ProductoCatalogo;
  onEjecutar: Ejecutar;
  pendiente: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  // Volver a ponerlo disponible no necesita elegir motivo: solo hay uno que
  // tenga sentido, y pedirlo sería fricción por fricción.
  if (producto.disponible === false) {
    return (
      <Button
        type="button"
        size="md"
        variant="forest"
        cargando={pendiente}
        onClick={() =>
          onEjecutar(() =>
            cambiarDisponibilidad({
              productoId: producto.id,
              disponible: true,
              reason: "Vuelve a estar disponible",
            })
          )
        }
      >
        Reponer
      </Button>
    );
  }

  if (!abierto) {
    return (
      <Button type="button" size="md" variant="secundario" onClick={() => setAbierto(true)}>
        Agotado
      </Button>
    );
  }

  return (
    <form
      className="flex items-end gap-2"
      action={(fd) => {
        onEjecutar(() =>
          cambiarDisponibilidad({
            productoId: producto.id,
            disponible: false,
            reason: String(fd.get("motivo") ?? ""),
          })
        );
        setAbierto(false);
      }}
    >
      <div className="w-52">
        <Select label="Motivo" labelOculto name="motivo" defaultValue={MOTIVOS_DISPONIBILIDAD[0]}>
          {MOTIVOS_DISPONIBILIDAD.filter((m) => m !== "Vuelve a estar disponible").map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" size="md" cargando={pendiente}>
        Marcar
      </Button>
    </form>
  );
}

function AccionArchivar({
  producto,
  onEjecutar,
  pendiente,
}: {
  producto: ProductoCatalogo;
  onEjecutar: Ejecutar;
  pendiente: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button
        type="button"
        size="md"
        variant="terciario"
        onClick={() => setConfirmando(true)}
        aria-label={`Retirar ${producto.nombre} de la carta`}
      >
        <PapeleraIcon size={15} />
      </Button>
    );
  }

  return (
    <form
      className="flex items-end gap-2"
      action={(fd) =>
        onEjecutar(() =>
          archivarProducto({
            productoId: producto.id,
            archivar: true,
            reason: String(fd.get("motivo") ?? ""),
          })
        )
      }
    >
      <div className="w-52">
        <Field
          label="Motivo para retirarlo"
          labelOculto
          name="motivo"
          required
          minLength={6}
          placeholder="Por qué se retira"
        />
      </div>
      <Button type="submit" size="md" cargando={pendiente}>
        Retirar
      </Button>
      <Button type="button" size="md" variant="terciario" onClick={() => setConfirmando(false)}>
        No
      </Button>
    </form>
  );
}
