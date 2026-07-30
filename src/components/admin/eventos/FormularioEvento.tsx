"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Field, Checkbox } from "@/components/ui/Field";
import { Textarea } from "@/components/admin/ui/Campos";
import { CheckIcon } from "@/components/icons";
import { crearEvento, editarEvento, type Resultado } from "@/lib/admin/acciones";
import type { EventoAdmin } from "@/lib/services/operaciones";

/**
 * Alta y edición de un evento.
 *
 * Las fechas se escriben con `datetime-local`, que NO lleva zona horaria: lo
 * que teclea la persona es hora de pared. El servidor la interpreta siempre en
 * hora de Puerto Rico (`validation/operaciones.ts`), no en la del navegador —la
 * diferencia entre programar un taller a las seis de la tarde en Condado y a
 * las seis de la tarde de donde esté quien lo crea.
 */

/** ISO → «2026-08-14T18:00» en hora de Puerto Rico, que es lo que espera el campo. */
function paraCampo(iso: string | null): string {
  if (!iso) return "";
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));

  const v = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  // `en-CA` da la hora 24 como «24» a medianoche; se normaliza a «00».
  const hora = v("hour") === "24" ? "00" : v("hour");
  return `${v("year")}-${v("month")}-${v("day")}T${hora}:${v("minute")}`;
}

export function FormularioEvento({
  evento,
  onListo,
}: {
  /** Sin evento, es un alta. */
  evento?: EventoAdmin;
  onListo?: () => void;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const campos = resultado && !resultado.ok ? (resultado.campos ?? {}) : {};

  function enviar(fd: FormData) {
    setResultado(null);
    iniciar(async () => {
      const comun = {
        titulo: String(fd.get("titulo") ?? ""),
        descripcion: String(fd.get("descripcion") ?? ""),
        iniciaAt: String(fd.get("iniciaAt") ?? ""),
        terminaAt: String(fd.get("terminaAt") ?? ""),
        lugar: String(fd.get("lugar") ?? ""),
        aforo: String(fd.get("aforo") ?? ""),
        reason: String(fd.get("motivo") ?? ""),
      };

      const r = evento
        ? await editarEvento({ ...comun, eventoId: evento.id })
        : await crearEvento({ ...comun, publicado: fd.get("publicado") === "on" });

      setResultado(r);
      if (r.ok) {
        router.refresh();
        onListo?.();
      }
    });
  }

  return (
    <form action={enviar} className="space-y-4">
      <Field
        label="Título"
        name="titulo"
        required
        defaultValue={evento?.titulo}
        error={campos.titulo?.[0]}
        ayuda={
          evento
            ? "Cambiar el título NO cambia la dirección del evento: quien ya lo compartió sigue llegando."
            : "La dirección del evento se saca de aquí."
        }
      />

      <Textarea
        label="Descripción"
        name="descripcion"
        rows={3}
        defaultValue={evento?.descripcion ?? ""}
        error={campos.descripcion?.[0]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Empieza"
          name="iniciaAt"
          type="datetime-local"
          required
          defaultValue={paraCampo(evento?.iniciaAt ?? null)}
          error={campos.iniciaAt?.[0]}
          ayuda="Hora de Puerto Rico."
        />
        <Field
          label="Termina"
          name="terminaAt"
          type="datetime-local"
          defaultValue={paraCampo(evento?.terminaAt ?? null)}
          error={campos.terminaAt?.[0]}
          ayuda="Opcional."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Lugar"
          name="lugar"
          defaultValue={evento?.lugar ?? "SIEMBRA Condado"}
          error={campos.lugar?.[0]}
        />
        <Field
          label="Aforo"
          name="aforo"
          inputMode="numeric"
          defaultValue={evento?.aforo != null ? String(evento.aforo) : ""}
          error={campos.aforo?.[0]}
          ayuda="Vacío = sin límite de plazas."
        />
      </div>

      <Field
        label="Motivo del cambio"
        name="motivo"
        required
        minLength={6}
        error={campos.reason?.[0]}
        ayuda="Queda en la auditoría."
      />

      {!evento && (
        <Checkbox name="publicado" label="Publicarlo ya en la web" defaultChecked={false} />
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" cargando={pendiente}>
          {evento ? "Guardar cambios" : "Crear evento"}
        </Button>
        {onListo && (
          <Button type="button" variant="terciario" onClick={onListo}>
            Cancelar
          </Button>
        )}
      </div>

      {resultado && (
        <p
          role={resultado.ok ? "status" : "alert"}
          className={`flex items-start gap-1.5 text-sm ${resultado.ok ? "text-olive" : "text-danger"}`}
        >
          {resultado.ok && <CheckIcon size={15} />}
          {resultado.ok ? resultado.mensaje : resultado.error}
        </p>
      )}
    </form>
  );
}
