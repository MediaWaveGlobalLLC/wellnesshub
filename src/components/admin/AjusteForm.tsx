"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Surface";

/**
 * Ajuste manual de crédito o puntos.
 *
 * El motivo es obligatorio y también lo exige la función SQL, así que no hay
 * forma de saltárselo desde aquí. El importe se escribe en la unidad natural
 * —dólares o puntos— y se convierte a centavos antes de enviarlo: pedirle
 * centavos a una persona es una invitación a equivocarse por cien.
 */
export function AjusteForm({
  userId,
  tipo,
}: {
  userId: string;
  tipo: "wallet" | "puntos";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const esWallet = tipo === "wallet";
  const ruta = esWallet ? "wallet-adjustment" : "points-adjustment";

  function enviar(formData: FormData) {
    setError(null);
    setExito(null);

    const crudo = String(formData.get("cantidad") ?? "").replace(",", ".");
    const numero = parseFloat(crudo);

    if (!Number.isFinite(numero) || numero === 0) {
      setError("Escribe una cantidad distinta de cero. Usa negativo para restar.");
      return;
    }

    const payload = esWallet
      ? { amountCents: Math.round(numero * 100) }
      : { points: Math.round(numero) };

    iniciar(async () => {
      const res = await fetch(`/api/admin/users/${userId}/${ruta}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          reason: String(formData.get("reason") ?? ""),
          reference: String(formData.get("reference") ?? ""),
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        const porCampo = json.error.fieldErrors
          ? Object.values(json.error.fieldErrors).flat().join(" ")
          : null;
        setError(porCampo || json.error.message);
        return;
      }

      setExito(
        esWallet
          ? `Nuevo saldo: $${(json.data.newBalanceCents / 100).toFixed(2)}`
          : `Nuevo balance: ${json.data.newPointsBalance} pts`
      );
      router.refresh();
    });
  }

  return (
    <form action={enviar} className="space-y-4" noValidate>
      {error && <Alert tono="error">{error}</Alert>}
      {exito && <Alert tono="exito">{exito}</Alert>}

      <Field
        label={esWallet ? "Cantidad en dólares" : "Cantidad en puntos"}
        name="cantidad"
        inputMode="decimal"
        placeholder={esWallet ? "10.00  ·  -5.50 para restar" : "500  ·  -100 para restar"}
        required
        ayuda="Un valor negativo resta."
      />

      <Field
        label="Motivo (obligatorio)"
        name="reason"
        placeholder="Crédito de servicio al cliente"
        required
        minLength={6}
        ayuda="Queda en la auditoría. Escríbelo pensando en quien lo lea dentro de seis meses."
      />

      <Field
        label="Referencia (opcional)"
        name="reference"
        placeholder="TICKET-123"
        ayuda="Reenviar el mismo ticket no duplica el ajuste."
      />

      <Button type="submit" cargando={enviando} variant={esWallet ? "primario" : "forest"}>
        Aplicar ajuste
      </Button>
    </form>
  );
}
