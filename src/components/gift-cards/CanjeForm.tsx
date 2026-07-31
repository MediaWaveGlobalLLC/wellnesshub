"use client";

import { useRef, useState, useTransition } from "react";
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
 *
 * El importe es opcional: en blanco pasa todo el saldo de la tarjeta, que es lo
 * que hacía siempre. Escribiendo una cantidad se pasa solo esa y el resto queda
 * en la tarjeta para otra vez.
 */
export function CanjeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<{
    acreditado: number;
    saldo: number;
    quedaEnTarjeta: number;
  } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [enviando, iniciar] = useTransition();

  /*
    Identificador de este intento de canje.

    Se mantiene mientras el formulario siga en pie, así que reintentar tras un
    fallo de red reenvía el mismo y el servidor no acredita dos veces. Solo se
    renueva después de un canje que sí salió, porque a partir de ahí el
    siguiente es un canje distinto y tiene que acreditar de verdad.
  */
  const intento = useRef<string | null>(null);

  function enviar(formData: FormData) {
    setError(null);
    setExito(null);

    const idIntento = (intento.current ??= crypto.randomUUID());

    const escrito = String(formData.get("importe") ?? "").trim();
    const dolares = Number(escrito.replace(",", "."));

    if (escrito && (!Number.isFinite(dolares) || dolares <= 0)) {
      setError("El importe tiene que ser un número mayor que cero.");
      return;
    }

    iniciar(async () => {
      const res = await fetch("/api/gift-cards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: String(formData.get("code") ?? ""),
          // Ausente = todo el saldo. Nunca se manda 0.
          ...(escrito ? { amountCents: Math.round(dolares * 100) } : {}),
          clientRequestId: idIntento,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        setError(json.error.message);
        return;
      }

      setExito({
        acreditado: json.data.creditedCents,
        saldo: json.data.newBalanceCents,
        quedaEnTarjeta: json.data.cardBalanceCents,
      });
      setCodigo("");
      intento.current = crypto.randomUUID();
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
        {exito.quedaEnTarjeta > 0 && (
          <p className="mt-1">
            Quedan <strong>{formatearDolares(exito.quedaEnTarjeta)}</strong> en la tarjeta. Guarda
            el código para usarlos más adelante.
          </p>
        )}
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

      <Field
        label="Cuánto quieres pasar a tu saldo"
        name="importe"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Déjalo en blanco para pasar todo"
        ayuda="Si pasas solo una parte, el resto se queda en la tarjeta y puedes usarlo después con el mismo código."
      />

      <Button type="submit" cargando={enviando} variant="forest" className="w-full">
        Canjear código
      </Button>
    </form>
  );
}
