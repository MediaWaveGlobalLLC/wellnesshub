"use client";

import { useState, useTransition } from "react";

import { Celda, Fila, Tabla } from "@/components/admin/ui/Tabla";
import { Badge } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { CheckIcon, CerrarIcon } from "@/components/icons";
import { marcarAsistencia } from "@/lib/admin/acciones";
import type { ReservaAdmin } from "@/lib/services/operaciones";

/**
 * La lista de la puerta.
 *
 * Los estados 'asistio' y 'ausente' están en el CHECK de `event_bookings` desde
 * `0005` y no los escribía nadie: no existía ninguna pantalla que los pusiera.
 *
 * Un clic por persona, sin motivo escrito. Pedir seis caracteres por cada
 * alguien que entra, veinte veces en una tarde, garantiza un «xxxxxx»: la
 * auditoría existiría y no diría nada. La acción y el estado ya cuentan la
 * historia entera, y quedan igualmente en `audit_logs`.
 *
 * El estado se pinta al momento sin esperar al servidor —y se revierte si la
 * llamada falla— porque esto se usa con gente esperando en la puerta.
 */

const TONO: Record<ReservaAdmin["estado"], "exito" | "aviso" | "peligro" | "neutro"> = {
  confirmada: "neutro",
  asistio: "exito",
  ausente: "peligro",
  cancelada: "aviso",
};

const NOMBRE: Record<ReservaAdmin["estado"], string> = {
  confirmada: "Confirmada",
  asistio: "Asistió",
  ausente: "No vino",
  cancelada: "Canceló",
};

export function ListaAsistencia({
  reservas,
  puedeMarcar,
}: {
  reservas: ReservaAdmin[];
  puedeMarcar: boolean;
}) {
  const [estados, setEstados] = useState<Record<string, ReservaAdmin["estado"]>>(
    Object.fromEntries(reservas.map((r) => [r.id, r.estado]))
  );
  const [error, setError] = useState<string | null>(null);

  if (reservas.length === 0) {
    return <p className="mt-4 text-sm text-text-muted">Todavía no se ha apuntado nadie.</p>;
  }

  return (
    <>
      <Tabla
        descripcion="Personas apuntadas al evento y su asistencia"
        columnas={[
          { clave: "persona", titulo: "Persona" },
          { clave: "socia", titulo: "Nº de socia", secundaria: true },
          { clave: "estado", titulo: "Estado" },
          { clave: "acciones", titulo: "Pasar lista", numerica: true },
        ]}
      >
        {reservas.map((r) => (
          <Fila key={r.id}>
            <Celda principal>
              {r.nombre}
              {r.email && <span className="block text-xs font-normal text-text-muted">{r.email}</span>}
            </Celda>
            <Celda secundaria>{r.memberId ?? "—"}</Celda>
            <Celda>
              <Badge tono={TONO[estados[r.id] ?? r.estado]}>
                {NOMBRE[estados[r.id] ?? r.estado]}
              </Badge>
            </Celda>
            <Celda numerica>
              {puedeMarcar && (estados[r.id] ?? r.estado) !== "cancelada" ? (
                <Marcadores
                  reservaId={r.id}
                  actual={estados[r.id] ?? r.estado}
                  onCambio={(estado) => setEstados((e) => ({ ...e, [r.id]: estado }))}
                  onError={setError}
                />
              ) : (
                <span className="text-xs text-text-muted">—</span>
              )}
            </Celda>
          </Fila>
        ))}
      </Tabla>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}

function Marcadores({
  reservaId,
  actual,
  onCambio,
  onError,
}: {
  reservaId: string;
  actual: ReservaAdmin["estado"];
  onCambio: (estado: ReservaAdmin["estado"]) => void;
  onError: (mensaje: string | null) => void;
}) {
  const [pendiente, iniciar] = useTransition();

  function marcar(estado: "asistio" | "ausente") {
    // Si ya está en ese estado, el clic lo devuelve a «confirmada»: pasar lista
    // a mano incluye equivocarse.
    const destino = actual === estado ? "confirmada" : estado;
    const previo = actual;

    onError(null);
    onCambio(destino);

    iniciar(async () => {
      const r = await marcarAsistencia({ reservaId, estado: destino });
      if (!r.ok) {
        onCambio(previo);
        onError(r.error);
      }
    });
  }

  return (
    <span className="flex justify-end gap-1.5">
      <Button
        type="button"
        size="md"
        variant={actual === "asistio" ? "forest" : "terciario"}
        aria-pressed={actual === "asistio"}
        aria-label="Marcar que asistió"
        disabled={pendiente}
        onClick={() => marcar("asistio")}
      >
        <CheckIcon size={15} />
      </Button>
      <Button
        type="button"
        size="md"
        variant={actual === "ausente" ? "secundario" : "terciario"}
        aria-pressed={actual === "ausente"}
        aria-label="Marcar que no vino"
        disabled={pendiente}
        onClick={() => marcar("ausente")}
      >
        <CerrarIcon size={15} />
      </Button>
    </span>
  );
}
