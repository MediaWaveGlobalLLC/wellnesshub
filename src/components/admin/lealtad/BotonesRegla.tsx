"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/icons";
import { aplicarRegla } from "@/lib/admin/acciones";
import type { ReglaLealtad } from "@/lib/lealtad/tipos";
import { formatearPuntos } from "@/lib/loyalty";

/**
 * Los puntos de una regla, a un clic, desde la ficha de la persona.
 *
 * Esto es lo que convierte `loyalty_rules` en algo que existe. «Vaso reusable,
 * 5 puntos» deja de ser una fila en una tabla y pasa a ser un botón que se
 * pulsa cuando alguien trae su vaso.
 *
 * Lo usa el MOSTRADOR, y por eso no hay ni importe ni motivo que escribir: los
 * puntos salen de la regla. Un empleado no puede regalar mil puntos porque no
 * existe el campo donde escribir mil; para una cantidad arbitraria sigue
 * haciendo falta el ajuste de puntos, que es de la dueña.
 */
export function BotonesRegla({
  userId,
  reglas,
}: {
  userId: string;
  /** Ya filtradas a las manuales y activas por la página. */
  reglas: ReglaLealtad[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  if (reglas.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-text-muted">
        Ninguna regla se puede dar a mano ahora mismo. Las de compras esperan al punto de venta.
      </p>
    );
  }

  function dar(clave: string) {
    setAviso(null);
    iniciar(async () => {
      const r = await aplicarRegla({ userId, clave });
      setAviso(r.ok ? { tono: "ok", texto: r.mensaje } : { tono: "error", texto: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {reglas.map((r) => (
          <Button
            key={r.clave}
            type="button"
            size="md"
            variant="secundario"
            disabled={pendiente}
            onClick={() => dar(r.clave)}
          >
            {r.etiqueta} · +{formatearPuntos(r.puntos)}
          </Button>
        ))}
      </div>

      {aviso && (
        <p
          role={aviso.tono === "error" ? "alert" : "status"}
          className={`mt-3 flex items-start gap-1.5 text-sm ${aviso.tono === "error" ? "text-danger" : "text-olive"}`}
        >
          {aviso.tono === "ok" && <CheckIcon size={15} />}
          {aviso.texto}
        </p>
      )}
    </>
  );
}
