"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Select, CampoDinero } from "@/components/admin/ui/Campos";
import { Field } from "@/components/ui/Field";
import { CheckIcon, LapizIcon, MasIcon, PapeleraIcon } from "@/components/icons";
import {
  archivarProducto,
  borrarVariante,
  cambiarDisponibilidad,
  cambiarFoto,
  cambiarPrecio,
  crearVariante,
  editarProducto,
} from "@/lib/catalogo/acciones";
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
  fotos,
  mover,
}: {
  producto: ProductoCatalogo;
  /** Falso para un empleado: solo verá el botón de agotado. */
  puedeEditar: boolean;
  /** Claves elegibles del manifiesto de marca. Nunca URLs libres. */
  fotos: { clave: string; src: string }[];
  /**
   * Flechas de orden. Las gestiona el padre porque reordenar necesita la lista
   * completa de hermanos, no solo esta fila.
   */
  mover?: {
    puedeSubir: boolean;
    puedeBajar: boolean;
    subir: () => void;
    bajar: () => void;
  };
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);
  /*
    Qué formulario está abierto bajo la fila. El precio va aparte porque su
    estado guarda QUÉ tamaño se edita; los demás son uno solo por fila.
  */
  const [panel, setPanel] = useState<"datos" | "foto" | "tamano" | null>(null);
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
        setPanel(null);
        router.refresh();
      }
    });
  }

  return (
    <li className="border-b border-border py-3.5 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/*
          Miniatura. Con foto se ve; sin foto, un hueco punteado que dice qué
          falta. Es el mismo tratamiento del panel de recompensas, y el estado
          «sin foto» es el normal: hay más productos que fotos aprobadas.
        */}
        {producto.imagen ? (
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border">
            <Image src={producto.imagen.src} alt="" fill sizes="48px" className="object-cover" />
          </span>
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-[0.55rem] uppercase tracking-[0.08em] text-text-muted">
            Sin foto
          </span>
        )}

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

          {mover && (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={mover.subir}
                disabled={!mover.puedeSubir || pendiente}
                aria-label={`Subir ${producto.nombre}`}
                className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-espresso transition-colors hover:border-terracota disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={mover.bajar}
                disabled={!mover.puedeBajar || pendiente}
                aria-label={`Bajar ${producto.nombre}`}
                className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-espresso transition-colors hover:border-terracota disabled:opacity-30"
              >
                ↓
              </button>
            </span>
          )}

          {puedeEditar && (
            <>
              <Button
                type="button"
                size="md"
                variant="terciario"
                onClick={() => setPanel(panel === "datos" ? null : "datos")}
                aria-expanded={panel === "datos"}
              >
                Datos
              </Button>
              <Button
                type="button"
                size="md"
                variant="terciario"
                onClick={() => setPanel(panel === "foto" ? null : "foto")}
                aria-expanded={panel === "foto"}
              >
                Foto
              </Button>
              <Button
                type="button"
                size="md"
                variant="terciario"
                onClick={() => setPanel(panel === "tamano" ? null : "tamano")}
                aria-expanded={panel === "tamano"}
              >
                <MasIcon size={13} />
                Tamaño
              </Button>
            </>
          )}

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

      {/* Datos del producto: nombre, nota y si va destacado. */}
      {panel === "datos" && (
        <form
          className="mt-3 grid gap-3 rounded-lg bg-surface-muted p-3 sm:grid-cols-2"
          action={(fd) =>
            ejecutar(() =>
              editarProducto({
                productoId: producto.id,
                nombre: String(fd.get("nombre") ?? ""),
                nota: String(fd.get("nota") ?? ""),
                destacado: fd.get("destacado") === "on",
                reason: String(fd.get("motivo") ?? ""),
              })
            )
          }
        >
          <Field label="Nombre" name="nombre" defaultValue={producto.nombre} required minLength={2} />
          <Field
            label="Nota (opcional)"
            name="nota"
            defaultValue={producto.nota ?? ""}
            placeholder="Suave, cremoso y energizante"
          />
          <label className="flex items-center gap-2.5 self-end pb-3 text-sm text-espresso">
            <input
              type="checkbox"
              name="destacado"
              defaultChecked={producto.destacado}
              className="h-4 w-4 accent-[var(--color-terracota)]"
            />
            Destacado en la carta
          </label>
          <Field label="Motivo" name="motivo" required minLength={6} placeholder="Por qué cambia" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" size="md" cargando={pendiente}>
              Guardar
            </Button>
            <Button type="button" size="md" variant="terciario" onClick={() => setPanel(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* Foto: solo claves del manifiesto de marca, nunca una URL. */}
      {panel === "foto" && (
        <form
          className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-surface-muted p-3"
          action={(fd) =>
            ejecutar(() =>
              cambiarFoto({
                productoId: producto.id,
                imagenClave: String(fd.get("imagen") ?? ""),
                reason: String(fd.get("motivo") ?? ""),
              })
            )
          }
        >
          <div className="min-w-[14rem]">
            <label
              htmlFor={`foto-${producto.id}`}
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted"
            >
              Foto de marca
            </label>
            <select
              id={`foto-${producto.id}`}
              name="imagen"
              defaultValue={producto.imagenClave ?? ""}
              className="min-h-[var(--control-height)] w-full rounded-lg border border-border bg-surface px-4 text-espresso focus:border-terracota focus:outline-none"
            >
              <option value="">Sin foto</option>
              {fotos.map((f) => (
                <option key={f.clave} value={f.clave}>
                  {f.clave}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[14rem] flex-1">
            <Field label="Motivo" name="motivo" required minLength={6} placeholder="Por qué cambia" />
          </div>
          <Button type="submit" size="md" cargando={pendiente}>
            Guardar
          </Button>
          <Button type="button" size="md" variant="terciario" onClick={() => setPanel(null)}>
            Cancelar
          </Button>
        </form>
      )}

      {/* Tamaños: añadir uno nuevo, o borrar los que sobren. */}
      {panel === "tamano" && (
        <div className="mt-3 rounded-lg bg-surface-muted p-3">
          <form
            className="flex flex-wrap items-end gap-3"
            action={(fd) =>
              ejecutar(() =>
                crearVariante({
                  productoId: producto.id,
                  etiqueta: String(fd.get("etiqueta") ?? ""),
                  precioCents: String(fd.get("precio") ?? ""),
                  reason: String(fd.get("motivo") ?? ""),
                })
              )
            }
          >
            <div className="w-32">
              <Field label="Etiqueta" name="etiqueta" placeholder="16 oz" />
            </div>
            <div className="w-32">
              <CampoDinero label="Precio" name="precio" required />
            </div>
            <div className="min-w-[12rem] flex-1">
              <Field label="Motivo" name="motivo" required minLength={6} placeholder="Por qué se añade" />
            </div>
            <Button type="submit" size="md" cargando={pendiente}>
              Añadir
            </Button>
            <Button type="button" size="md" variant="terciario" onClick={() => setPanel(null)}>
              Cerrar
            </Button>
          </form>

          {/* Borrar solo tiene sentido con más de uno: sin ningún tamaño el
              producto se queda sin precio, y SQL lo rechaza igualmente. */}
          {producto.variantes.length > 1 && (
            <ul className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {producto.variantes.map((v) => (
                <li key={v.id}>
                  <Button
                    type="button"
                    size="md"
                    variant="terciario"
                    cargando={pendiente}
                    onClick={() =>
                      ejecutar(() =>
                        borrarVariante({
                          varianteId: v.id,
                          reason: `Se retira el tamaño ${v.etiqueta ?? "único"} de ${producto.nombre}`,
                        })
                      )
                    }
                  >
                    <PapeleraIcon size={13} />
                    {v.etiqueta ?? "único"} · ${precioLegible(v.precioCents)}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
