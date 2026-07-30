"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge, Card } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { CheckIcon, MasIcon } from "@/components/icons";
import { FormularioEvento } from "./FormularioEvento";
import { borrarEvento, publicarEvento, type Resultado } from "@/lib/admin/acciones";
import type { EventoAdmin } from "@/lib/services/operaciones";

/**
 * La lista de eventos con lo que se puede hacerles.
 *
 * Publicar y despublicar es lo que se toca a menudo, así que está en la fila.
 * Editar despliega el formulario debajo, sin cambiar de página: programar la
 * agenda del mes son cinco eventos seguidos, y cinco navegaciones de ida y
 * vuelta convierten un rato en una tarde.
 */

function cuando(iso: string, fin: string | null): string {
  const f = new Intl.DateTimeFormat("es-PR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Puerto_Rico",
  });
  if (!fin) return f.format(new Date(iso));

  const hora = new Intl.DateTimeFormat("es-PR", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Puerto_Rico",
  });
  return `${f.format(new Date(iso))} – ${hora.format(new Date(fin))}`;
}

export function PanelEventos({
  proximos,
  pasados,
  puedeGestionar,
}: {
  /*
    El reparto entre próximos y pasados llega HECHO desde el servidor.

    Aquí sería `Date.now()` en render, que el compilador de React rechaza por
    impuro y con razón: el corte dependería del reloj del navegador y de cuándo
    le toque volver a renderizar. Un evento que empieza dentro de un minuto
    saltaría de una lista a otra a mitad de una interacción.
  */
  proximos: EventoAdmin[];
  pasados: EventoAdmin[];
  /** Falso para un empleado: solo ve la lista y entra a marcar asistencia. */
  puedeGestionar: boolean;
}) {
  const [creando, setCreando] = useState(false);

  return (
    <>
      {puedeGestionar && (
        <div className="mt-5">
          {creando ? (
            <Card className="p-5 sm:p-6">
              <h2 className="font-display text-xl text-espresso">Evento nuevo</h2>
              <div className="mt-4">
                <FormularioEvento onListo={() => setCreando(false)} />
              </div>
            </Card>
          ) : (
            <Button type="button" onClick={() => setCreando(true)}>
              <MasIcon size={15} />
              Programar un evento
            </Button>
          )}
        </div>
      )}

      <Seccion
        titulo="Próximos"
        vacio="No hay ningún evento programado."
        eventos={proximos}
        puedeGestionar={puedeGestionar}
      />
      <Seccion
        titulo="Ya pasaron"
        vacio="Todavía no se ha celebrado ninguno."
        eventos={pasados}
        puedeGestionar={puedeGestionar}
      />
    </>
  );
}

function Seccion({
  titulo,
  vacio,
  eventos,
  puedeGestionar,
}: {
  titulo: string;
  vacio: string;
  eventos: EventoAdmin[];
  puedeGestionar: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
        {titulo}
      </h2>
      {eventos.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">{vacio}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {eventos.map((e) => (
            <FilaEvento key={e.id} evento={e} puedeGestionar={puedeGestionar} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FilaEvento({
  evento,
  puedeGestionar,
}: {
  evento: EventoAdmin;
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [abierto, setAbierto] = useState<"editar" | "publicar" | "borrar" | null>(null);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  const ocupadas = evento.confirmadas + evento.asistieron;
  const lleno = evento.aforo !== null && ocupadas >= evento.aforo;

  function ejecutar(fn: () => Promise<Resultado>) {
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      setAviso(r.ok ? { tono: "ok", texto: r.mensaje } : { tono: "error", texto: r.error });
      if (r.ok) {
        setAbierto(null);
        router.refresh();
      }
    });
  }

  return (
    <li>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-display text-lg text-espresso">
              {evento.titulo}
              <Badge tono={evento.publicado ? "exito" : "neutro"}>
                {evento.publicado ? "En la web" : "Borrador"}
              </Badge>
              {lleno && <Badge tono="aviso">Aforo completo</Badge>}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {cuando(evento.iniciaAt, evento.terminaAt)} · {evento.lugar}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {ocupadas} plaza{ocupadas === 1 ? "" : "s"} ocupada{ocupadas === 1 ? "" : "s"}
              {evento.aforo !== null ? ` de ${evento.aforo}` : " · sin límite"}
              {evento.asistieron > 0 ? ` · ${evento.asistieron} asistió/asistieron` : ""}
              {evento.ausentes > 0 ? ` · ${evento.ausentes} no vino` : ""}
              {evento.canceladas > 0 ? ` · ${evento.canceladas} canceló` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/eventos/${evento.id}`}
              className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-primary-hover underline underline-offset-4"
            >
              Lista de asistencia
            </Link>

            {puedeGestionar && (
              <>
                <Button
                  type="button"
                  size="md"
                  variant="secundario"
                  onClick={() => setAbierto(abierto === "editar" ? null : "editar")}
                  aria-expanded={abierto === "editar"}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant={evento.publicado ? "terciario" : "forest"}
                  onClick={() => setAbierto(abierto === "publicar" ? null : "publicar")}
                  aria-expanded={abierto === "publicar"}
                >
                  {evento.publicado ? "Quitar de la web" : "Publicar"}
                </Button>
                {ocupadas === 0 && evento.canceladas === 0 && (
                  <Button
                    type="button"
                    size="md"
                    variant="terciario"
                    onClick={() => setAbierto(abierto === "borrar" ? null : "borrar")}
                    aria-expanded={abierto === "borrar"}
                  >
                    Borrar
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {abierto === "editar" && (
          <div className="mt-4 border-t border-border pt-4">
            <FormularioEvento evento={evento} onListo={() => setAbierto(null)} />
          </div>
        )}

        {(abierto === "publicar" || abierto === "borrar") && (
          <form
            className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-surface-muted p-3"
            action={(fd) => {
              const reason = String(fd.get("motivo") ?? "");
              ejecutar(() =>
                abierto === "borrar"
                  ? borrarEvento({ eventoId: evento.id, reason })
                  : publicarEvento({
                      eventoId: evento.id,
                      publicado: !evento.publicado,
                      reason,
                    })
              );
            }}
          >
            <div className="min-w-[16rem] flex-1">
              <Field
                label={abierto === "borrar" ? "¿Por qué se borra?" : "Motivo"}
                name="motivo"
                required
                minLength={6}
                placeholder="Queda en la auditoría"
              />
            </div>
            <Button type="submit" size="md" cargando={pendiente}>
              {abierto === "borrar" ? "Borrar" : evento.publicado ? "Quitar" : "Publicar"}
            </Button>
            <Button type="button" size="md" variant="terciario" onClick={() => setAbierto(null)}>
              Cancelar
            </Button>
          </form>
        )}

        {aviso && (
          <p
            role={aviso.tono === "error" ? "alert" : "status"}
            className={`mt-2 flex items-start gap-1.5 text-xs ${aviso.tono === "error" ? "text-danger" : "text-olive"}`}
          >
            {aviso.tono === "ok" && <CheckIcon size={14} />}
            {aviso.texto}
          </p>
        )}
      </Card>
    </li>
  );
}
