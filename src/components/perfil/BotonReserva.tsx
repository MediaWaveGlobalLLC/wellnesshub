"use client";

import { useTransition } from "react";
import { cancelarReserva, reservarEvento } from "@/lib/perfil/acciones";
import { CalendarIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Reserva o cancela la plaza en un taller.
 *
 * Solo alterna entre 'confirmada' y 'cancelada': marcar asistencia es cosa del
 * personal y RLS lo impide desde el cliente (migración 0005).
 */
export function BotonReserva({ eventId, reservado }: { eventId: string; reservado: boolean }) {
  const [pendiente, iniciar] = useTransition();

  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() =>
        iniciar(() => void (reservado ? cancelarReserva(eventId) : reservarEvento(eventId)))
      }
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors disabled:opacity-50",
        reservado
          ? "border-border bg-surface text-text-muted hover:border-danger hover:text-danger"
          : "border-terracota bg-terracota text-surface hover:bg-primary-hover"
      )}
    >
      <CalendarIcon size={15} />
      {pendiente ? "Un momento…" : reservado ? "Cancelar reserva" : "Reservar plaza"}
    </button>
  );
}
