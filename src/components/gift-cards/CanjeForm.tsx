"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Surface";
import { GiftIcon } from "@/components/icons";
import { formatearDolares } from "@/lib/loyalty";

/**
 * Canje de un código — mockup 03, "Canjear código".
 *
 * El código no se guarda ni se registra en ningún sitio del cliente: se envía,
 * se canjea y se limpia el campo.
 */
export function CanjeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<{ acreditado: number; saldo: number } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [enviando, iniciar] = useTransition();

  function enviar(formData: FormData) {
    setError(null);
    setExito(null);

    iniciar(async () => {
      const res = await fetch("/api/gift-cards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: String(formData.get("code") ?? "") }),
      });
      const json = await res.json();

      if (!json.ok) {
        setError(json.error.message);
        return;
      }

      setExito({ acreditado: json.data.creditedCents, saldo: json.data.newBalanceCents });
      setCodigo("");
      // Refresca el saldo y el historial que pinta el servidor.
      router.refresh();
    });
  }

  if (exito) {
    return (
      <Alert tono="exito" titulo={`Se acreditaron ${formatearDolares(exito.acreditado)}`}>
        <p>
          Tu saldo ahora es <strong>{formatearDolares(exito.saldo)}</strong>.
        </p>
        <button
          type="button"
          onClick={() => setExito(null)}
          className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] underline underline-offset-4"
        >
          Canjear otra
        </button>
      </Alert>
    );
  }

  return (
    <form action={enviar} className="space-y-4" noValidate>
      {error && <Alert tono="error">{error}</Alert>}

      <Field
        label="Código de tu gift card"
        name="code"
        placeholder="SMB-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-X"
        autoComplete="off"
        spellCheck={false}
        required
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        icono={<GiftIcon size={18} />}
        ayuda="Puedes pegarlo tal cual llegó en el correo, con o sin guiones."
      />

      <Button type="submit" cargando={enviando} variant="forest" className="w-full">
        Canjear código
      </Button>
    </form>
  );
}
