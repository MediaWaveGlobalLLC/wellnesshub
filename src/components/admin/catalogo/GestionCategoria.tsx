"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge, Card } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CampoDinero } from "@/components/admin/ui/Campos";
import { CheckIcon, LapizIcon, MasIcon, PapeleraIcon } from "@/components/icons";
import { FilaProducto } from "./FilaProducto";
import {
  borrarCategoria,
  crearCategoria,
  crearProducto,
  editarCategoria,
  reordenar,
} from "@/lib/catalogo/acciones";
import type { CategoriaCatalogo, Mundo } from "@/lib/catalogo/tipos";

/**
 * Una sección de la carta con todo lo que se le puede hacer.
 *
 * Hasta ahora el panel solo dejaba tocar el precio y marcar agotado: crear un
 * producto o una sección exigía SQL a mano. Las secciones ni siquiera tenían
 * función en la base hasta `0023`.
 *
 * Los formularios se despliegan en línea y no en modales, porque el resto de la
 * pantalla tampoco usa ninguno y porque así se ve el contexto de lo que se está
 * cambiando mientras se cambia.
 */

const MUNDOS: { valor: Mundo; etiqueta: string }[] = [
  { valor: "cafe", etiqueta: "Café" },
  { valor: "matcha", etiqueta: "Matcha" },
  { valor: "piel", etiqueta: "Piel" },
  { valor: "comida", etiqueta: "Comida" },
];

type Resultado = { ok: boolean; error?: string; mensaje?: string };

export function GestionCategoria({
  categoria,
  puedeEditar,
  fotos,
}: {
  categoria: CategoriaCatalogo;
  puedeEditar: boolean;
  fotos: { clave: string; src: string }[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [panel, setPanel] = useState<"editar" | "producto" | "borrar" | null>(null);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  const visibles = categoria.productos.filter((p) => !p.archivado);

  function ejecutar(fn: () => Promise<Resultado>) {
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      setAviso(
        r.ok
          ? { tono: "ok", texto: r.mensaje ?? "Guardado." }
          : { tono: "error", texto: r.error ?? "No se pudo guardar." }
      );
      if (r.ok) {
        setPanel(null);
        router.refresh();
      }
    });
  }

  /**
   * Mueve un producto dentro de su sección.
   *
   * `admin_catalogo_reordenar` recibe la lista COMPLETA de ids en el orden
   * nuevo, no un «sube uno»: así el índice único de la tabla nunca ve dos
   * productos en la misma posición a mitad de la operación.
   */
  function mover(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion;
    if (destino < 0 || destino >= visibles.length) return;

    const ids = visibles.map((p) => p.id);
    [ids[indice], ids[destino]] = [ids[destino]!, ids[indice]!];

    ejecutar(() =>
      reordenar({
        tipo: "producto",
        ids,
        reason: `Se reordena ${visibles[indice]!.nombre} dentro de ${categoria.nombre}`,
      })
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
        <h2 className="font-display text-xl text-espresso">{categoria.nombre}</h2>

        <div className="flex flex-wrap items-center gap-2">
          {categoria.etiquetaTamanos && (
            <span className="text-xs uppercase tracking-wider text-text-muted">
              {categoria.etiquetaTamanos}
            </span>
          )}
          <Badge tono={categoria.estado === "hoy" ? "exito" : "aviso"}>
            {categoria.estado === "hoy" ? "En carta" : "Próximamente"}
          </Badge>

          {puedeEditar && (
            <>
              <Button
                type="button"
                size="md"
                variant="secundario"
                onClick={() => setPanel(panel === "producto" ? null : "producto")}
                aria-expanded={panel === "producto"}
              >
                <MasIcon size={13} />
                Producto
              </Button>
              <Button
                type="button"
                size="md"
                variant="terciario"
                onClick={() => setPanel(panel === "editar" ? null : "editar")}
                aria-expanded={panel === "editar"}
              >
                <LapizIcon size={13} />
                Sección
              </Button>
              <Button
                type="button"
                size="md"
                variant="terciario"
                onClick={() => setPanel(panel === "borrar" ? null : "borrar")}
                aria-expanded={panel === "borrar"}
              >
                <PapeleraIcon size={13} />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Editar la sección ──────────────────────────────────────────── */}
      {panel === "editar" && puedeEditar && (
        <FormularioCategoria
          categoria={categoria}
          pendiente={pendiente}
          onCancelar={() => setPanel(null)}
          onGuardar={(datos) =>
            ejecutar(() => editarCategoria({ categoriaId: categoria.id, ...datos }))
          }
        />
      )}

      {/* ── Borrar la sección ──────────────────────────────────────────── */}
      {panel === "borrar" && puedeEditar && (
        <form
          className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-surface-muted p-3"
          action={(fd) =>
            ejecutar(() =>
              borrarCategoria({
                categoriaId: categoria.id,
                reason: String(fd.get("motivo") ?? ""),
              })
            )
          }
        >
          <p className="w-full text-sm leading-relaxed text-text-muted">
            Solo se puede borrar una sección <strong>vacía</strong>. Si todavía tiene productos
            dentro —archivados incluidos— hay que moverlos o archivarlos antes: borrarla se los
            llevaría por delante, y alguno puede estar en los favoritos de alguien.
          </p>
          <div className="min-w-[16rem] flex-1">
            <Field label="Motivo" name="motivo" required minLength={6} placeholder="Por qué se borra" />
          </div>
          <Button type="submit" size="md" cargando={pendiente}>
            Borrar sección
          </Button>
          <Button type="button" size="md" variant="terciario" onClick={() => setPanel(null)}>
            Cancelar
          </Button>
        </form>
      )}

      {/* ── Alta de producto ───────────────────────────────────────────── */}
      {panel === "producto" && puedeEditar && (
        <FormularioProducto
          categoriaId={categoria.id}
          pendiente={pendiente}
          onCancelar={() => setPanel(null)}
          onCrear={(datos) => ejecutar(() => crearProducto(datos))}
        />
      )}

      {aviso && (
        <p
          role={aviso.tono === "error" ? "alert" : "status"}
          className={`mt-3 flex items-start gap-1.5 text-sm ${
            aviso.tono === "error" ? "text-danger" : "text-olive"
          }`}
        >
          {aviso.tono === "ok" && <CheckIcon size={15} />}
          {aviso.texto}
        </p>
      )}

      <ul className="mt-1">
        {visibles.map((p, i) => (
          <FilaProducto
            key={p.id}
            producto={p}
            puedeEditar={puedeEditar}
            fotos={fotos}
            mover={
              puedeEditar && visibles.length > 1
                ? {
                    puedeSubir: i > 0,
                    puedeBajar: i < visibles.length - 1,
                    subir: () => mover(i, -1),
                    bajar: () => mover(i, 1),
                  }
                : undefined
            }
          />
        ))}
      </ul>

      {visibles.length === 0 && (
        <p className="py-4 text-sm text-text-muted">
          Esta sección no tiene productos. Añade uno, o bórrala si sobra.
        </p>
      )}
    </Card>
  );
}

/** Campos de una sección, compartidos por el alta y la edición. */
function FormularioCategoria({
  categoria,
  pendiente,
  onGuardar,
  onCancelar,
}: {
  /** Ausente al crear. */
  categoria?: CategoriaCatalogo;
  pendiente: boolean;
  onGuardar: (datos: Record<string, unknown>) => void;
  onCancelar: () => void;
}) {
  return (
    <form
      className="mt-3 grid gap-3 rounded-lg bg-surface-muted p-3 sm:grid-cols-2"
      action={(fd) =>
        onGuardar({
          nombreEs: String(fd.get("nombre") ?? ""),
          nombreEn: String(fd.get("nombreEn") ?? ""),
          mundo: String(fd.get("mundo") ?? "cafe"),
          estado: String(fd.get("estado") ?? "hoy"),
          etiquetaTamanos: String(fd.get("etiqueta") ?? ""),
          reason: String(fd.get("motivo") ?? ""),
        })
      }
    >
      <Field
        label="Nombre"
        name="nombre"
        required
        minLength={2}
        defaultValue={categoria?.nombre ?? ""}
        placeholder="Barra de Matcha"
      />
      <Field
        label="Nombre en inglés (opcional)"
        name="nombreEn"
        placeholder="Matcha Bar"
      />

      <div>
        <label
          htmlFor="mundo"
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted"
        >
          Mundo
        </label>
        <select
          id="mundo"
          name="mundo"
          defaultValue={categoria?.mundo ?? "cafe"}
          className="min-h-[var(--control-height)] w-full rounded-lg border border-border bg-surface px-4 text-espresso focus:border-terracota focus:outline-none"
        >
          {MUNDOS.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.etiqueta}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-text-muted">Decide el color de la sección en la carta.</p>
      </div>

      <div>
        <label
          htmlFor="estado"
          className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted"
        >
          Estado
        </label>
        <select
          id="estado"
          name="estado"
          defaultValue={categoria?.estado ?? "hoy"}
          className="min-h-[var(--control-height)] w-full rounded-lg border border-border bg-surface px-4 text-espresso focus:border-terracota focus:outline-none"
        >
          <option value="hoy">En carta</option>
          <option value="pronto">Próximamente</option>
        </select>
      </div>

      <Field
        label="Rótulo de tamaños (opcional)"
        name="etiqueta"
        defaultValue={categoria?.etiquetaTamanos ?? ""}
        placeholder="16 oz"
      />
      <Field label="Motivo" name="motivo" required minLength={6} placeholder="Por qué cambia" />

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" size="md" cargando={pendiente}>
          Guardar
        </Button>
        <Button type="button" size="md" variant="terciario" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/**
 * Alta de producto.
 *
 * Pide al menos un precio porque un producto sin ningún tamaño no se puede
 * pedir ni pintar en la carta. El segundo es opcional y cubre el caso normal
 * del café: 12 oz y 16 oz.
 */
function FormularioProducto({
  categoriaId,
  pendiente,
  onCrear,
  onCancelar,
}: {
  categoriaId: string;
  pendiente: boolean;
  onCrear: (datos: Record<string, unknown>) => void;
  onCancelar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function enviar(fd: FormData) {
    setError(null);

    const variantes: { etiqueta?: string; precioCents: string }[] = [];
    for (const n of ["1", "2"]) {
      const precio = String(fd.get(`precio${n}`) ?? "").trim();
      if (!precio) continue;
      variantes.push({
        etiqueta: String(fd.get(`etiqueta${n}`) ?? "").trim() || undefined,
        precioCents: precio,
      });
    }

    if (variantes.length === 0) {
      setError("Hace falta al menos un precio.");
      return;
    }

    onCrear({
      categoriaId,
      nombre: String(fd.get("nombre") ?? ""),
      nota: String(fd.get("nota") ?? ""),
      destacado: fd.get("destacado") === "on",
      variantes,
      reason: String(fd.get("motivo") ?? ""),
    });
  }

  return (
    <form className="mt-3 grid gap-3 rounded-lg bg-surface-muted p-3 sm:grid-cols-2" action={enviar}>
      <Field label="Nombre" name="nombre" required minLength={2} placeholder="Matcha Clásico" />
      <Field label="Nota (opcional)" name="nota" placeholder="Suave, cremoso y energizante" />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tamaño 1" name="etiqueta1" placeholder="12 oz" />
        <CampoDinero label="Precio 1" name="precio1" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tamaño 2 (opcional)" name="etiqueta2" placeholder="16 oz" />
        <CampoDinero label="Precio 2" name="precio2" />
      </div>

      <label className="flex items-center gap-2.5 self-end pb-3 text-sm text-espresso">
        <input
          type="checkbox"
          name="destacado"
          className="h-4 w-4 accent-[var(--color-terracota)]"
        />
        Destacado en la carta
      </label>
      <Field label="Motivo" name="motivo" required minLength={6} placeholder="Por qué se añade" />

      {error && (
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" size="md" cargando={pendiente}>
          Crear producto
        </Button>
        <Button type="button" size="md" variant="terciario" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Alta de sección, desde la cabecera de la pantalla. */
export function NuevaCategoria() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  return (
    <div className="mt-5">
      {!abierto ? (
        <Button type="button" size="md" onClick={() => setAbierto(true)}>
          <MasIcon size={14} />
          Nueva sección
        </Button>
      ) : (
        <Card className="p-5">
          <h2 className="font-display text-xl text-espresso">Nueva sección de la carta</h2>
          <FormularioCategoria
            pendiente={pendiente}
            onCancelar={() => setAbierto(false)}
            onGuardar={(datos) => {
              setAviso(null);
              iniciar(async () => {
                const r = await crearCategoria(datos);
                setAviso(
                  r.ok
                    ? { tono: "ok", texto: r.mensaje }
                    : { tono: "error", texto: r.error }
                );
                if (r.ok) {
                  setAbierto(false);
                  router.refresh();
                }
              });
            }}
          />
        </Card>
      )}

      {aviso && (
        <p
          role={aviso.tono === "error" ? "alert" : "status"}
          className={`mt-3 flex items-start gap-1.5 text-sm ${
            aviso.tono === "error" ? "text-danger" : "text-olive"
          }`}
        >
          {aviso.tono === "ok" && <CheckIcon size={15} />}
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
