"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge, Card } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Field, Checkbox } from "@/components/ui/Field";
import { Celda, Fila, Tabla } from "@/components/admin/ui/Tabla";
import { CheckIcon } from "@/components/icons";
import { editarNivel, editarRegla, type Resultado } from "@/lib/admin/acciones";
import {
  NOMBRE_APLICACION,
  type NivelLealtad,
  type ReglaLealtad,
} from "@/lib/lealtad/tipos";
import { formatearPuntos } from "@/lib/loyalty";

/**
 * Las reglas y los niveles del programa, editables.
 *
 * `0005` declaró estas dos tablas «editables sin tocar código» y luego solo se
 * podían cambiar escribiendo SQL a mano. Esto es la pantalla que faltaba.
 *
 * La columna «cómo se aplica» es la parte importante: de las siete reglas del
 * Brand Book, hoy el sistema solo puede dar una sola. Enseñarlas todas iguales
 * haría creer que el programa funciona entero.
 */

const TONO: Record<string, "exito" | "aviso" | "peligro" | "neutro"> = {
  automatica: "exito",
  manual: "neutro",
  bloqueada: "aviso",
};

export function PanelLealtad({
  reglas,
  niveles,
  puedeConfigurar,
}: {
  reglas: ReglaLealtad[];
  niveles: NivelLealtad[];
  puedeConfigurar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [editando, setEditando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const campos = resultado && !resultado.ok ? (resultado.campos ?? {}) : {};

  function ejecutar(fn: () => Promise<Resultado>) {
    setResultado(null);
    iniciar(async () => {
      const r = await fn();
      setResultado(r);
      if (r.ok) {
        setEditando(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="font-display text-xl text-espresso">Cómo se ganan puntos</h2>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">
          La columna de la derecha dice si el sistema las aplica solo, si las das tú desde la ficha
          de la persona, o si todavía no se pueden aplicar.
        </p>

        <div className="mt-5">
          <Tabla
            descripcion="Reglas de acumulación de puntos"
            columnas={[
              { clave: "regla", titulo: "Regla" },
              { clave: "puntos", titulo: "Puntos", numerica: true },
              { clave: "uso", titulo: "Se ha dado", secundaria: true },
              { clave: "aplicacion", titulo: "Cómo se aplica" },
              { clave: "acciones", titulo: "", numerica: true },
            ]}
          >
            {reglas.map((r) => (
              <Fila key={r.clave}>
                <Celda principal>
                  {r.etiqueta}
                  {!r.activa && (
                    <span className="ml-2 align-middle">
                      <Badge tono="peligro">Desactivada</Badge>
                    </span>
                  )}
                  {r.nota && (
                    <span className="block text-xs font-normal leading-relaxed text-text-muted">
                      {r.nota}
                    </span>
                  )}
                </Celda>
                <Celda numerica>{formatearPuntos(r.puntos)}</Celda>
                <Celda secundaria>
                  {r.vecesAplicada === 0
                    ? "Nunca"
                    : `${r.vecesAplicada} vez${r.vecesAplicada === 1 ? "" : "es"} · ${formatearPuntos(r.puntosDados)} pts`}
                </Celda>
                <Celda>
                  <Badge tono={TONO[r.aplicacion] ?? "neutro"}>
                    {NOMBRE_APLICACION[r.aplicacion]}
                  </Badge>
                </Celda>
                <Celda numerica>
                  {puedeConfigurar && (
                    <Button
                      type="button"
                      size="md"
                      variant="terciario"
                      onClick={() => setEditando(editando === `r:${r.clave}` ? null : `r:${r.clave}`)}
                      aria-expanded={editando === `r:${r.clave}`}
                    >
                      Editar
                    </Button>
                  )}
                </Celda>
              </Fila>
            ))}
          </Tabla>
        </div>

        {reglas.map(
          (r) =>
            editando === `r:${r.clave}` && (
              <form
                key={r.clave}
                className="mt-4 space-y-4 rounded-lg bg-surface-muted p-4"
                action={(fd) =>
                  ejecutar(() =>
                    editarRegla({
                      clave: r.clave,
                      puntos: String(fd.get("puntos") ?? ""),
                      etiqueta: String(fd.get("etiqueta") ?? ""),
                      activa: fd.get("activa") === "on",
                      reason: String(fd.get("motivo") ?? ""),
                    })
                  )
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Nombre de la regla"
                    name="etiqueta"
                    required
                    defaultValue={r.etiqueta}
                    error={campos.etiqueta?.[0]}
                  />
                  <Field
                    label="Puntos"
                    name="puntos"
                    inputMode="numeric"
                    required
                    defaultValue={String(r.puntos)}
                    error={campos.puntos?.[0]}
                  />
                </div>
                <Checkbox name="activa" label="Regla activa" defaultChecked={r.activa} />
                <Field
                  label="Motivo del cambio"
                  name="motivo"
                  required
                  minLength={6}
                  error={campos.reason?.[0]}
                  ayuda="Queda en la auditoría."
                />
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" size="md" cargando={pendiente}>
                    Guardar
                  </Button>
                  <Button type="button" size="md" variant="terciario" onClick={() => setEditando(null)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )
        )}
      </Card>

      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="font-display text-xl text-espresso">Niveles</h2>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">
          El nivel de cada persona <strong>no se guarda</strong>: se calcula a partir de sus puntos y
          de estos umbrales. Cambiar uno recoloca a todo el mundo al momento, sin tocar los puntos de
          nadie.
        </p>

        <div className="mt-5">
          <Tabla
            descripcion="Niveles del programa de lealtad"
            columnas={[
              { clave: "nivel", titulo: "Nivel" },
              { clave: "minimo", titulo: "Desde", numerica: true },
              { clave: "miembros", titulo: "Personas", numerica: true },
              { clave: "acciones", titulo: "", numerica: true },
            ]}
          >
            {niveles.map((n) => (
              <Fila key={n.clave}>
                <Celda principal>
                  {n.etiqueta}
                  {n.descripcion && (
                    <span className="block text-xs font-normal italic text-text-muted">
                      {n.descripcion}
                    </span>
                  )}
                </Celda>
                <Celda numerica>{formatearPuntos(n.minimo)} pts</Celda>
                <Celda numerica>{formatearPuntos(n.miembros)}</Celda>
                <Celda numerica>
                  {puedeConfigurar && (
                    <Button
                      type="button"
                      size="md"
                      variant="terciario"
                      onClick={() => setEditando(editando === `n:${n.clave}` ? null : `n:${n.clave}`)}
                      aria-expanded={editando === `n:${n.clave}`}
                    >
                      Editar
                    </Button>
                  )}
                </Celda>
              </Fila>
            ))}
          </Tabla>
        </div>

        {niveles.map(
          (n) =>
            editando === `n:${n.clave}` && (
              <form
                key={n.clave}
                className="mt-4 space-y-4 rounded-lg bg-surface-muted p-4"
                action={(fd) =>
                  ejecutar(() =>
                    editarNivel({
                      clave: n.clave,
                      etiqueta: String(fd.get("etiqueta") ?? ""),
                      minimo: String(fd.get("minimo") ?? ""),
                      descripcion: String(fd.get("descripcion") ?? ""),
                      reason: String(fd.get("motivo") ?? ""),
                    })
                  )
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Nombre"
                    name="etiqueta"
                    required
                    defaultValue={n.etiqueta}
                    error={campos.etiqueta?.[0]}
                  />
                  <Field
                    label="Puntos mínimos"
                    name="minimo"
                    inputMode="numeric"
                    required
                    defaultValue={String(n.minimo)}
                    error={campos.minimo?.[0]}
                    ayuda={n.orden === 1 ? "El primero tiene que ser 0." : "Más que el nivel anterior."}
                  />
                </div>
                <Field
                  label="Descripción"
                  name="descripcion"
                  defaultValue={n.descripcion ?? ""}
                  error={campos.descripcion?.[0]}
                  ayuda="Se ve en el perfil de cada socia."
                />
                <Field
                  label="Motivo del cambio"
                  name="motivo"
                  required
                  minLength={6}
                  error={campos.reason?.[0]}
                />
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" size="md" cargando={pendiente}>
                    Guardar
                  </Button>
                  <Button type="button" size="md" variant="terciario" onClick={() => setEditando(null)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )
        )}
      </Card>

      {resultado && (
        <p
          role={resultado.ok ? "status" : "alert"}
          className={`mt-4 flex items-start gap-1.5 text-sm ${resultado.ok ? "text-olive" : "text-danger"}`}
        >
          {resultado.ok && <CheckIcon size={15} />}
          {resultado.ok ? resultado.mensaje : resultado.error}
        </p>
      )}
    </>
  );
}
