"use client";

import { useState, useTransition } from "react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Surface";
import { MailIcon, UserIcon, GiftIcon, CardIcon } from "@/components/icons";
import { MONTOS_PRESET, MONTO_MAXIMO, MONTO_MINIMO } from "@/lib/validation/gift-cards";
import { formatearDolares } from "@/lib/loyalty";
import { cn } from "@/lib/cn";

/**
 * Compra de gift card — columna izquierda del mockup 03.
 *
 * Los cuatro pasos del mockup: monto, formato, destinatario y mensaje. El
 * importe se vuelve a validar en el servidor: aquí solo se elige.
 */
export function CompraForm({ haySesion }: { haySesion: boolean }) {
  const [centavos, setCentavos] = useState<number>(5000);
  const [personalizado, setPersonalizado] = useState("");
  const [formato, setFormato] = useState<"digital" | "physical">("digital");
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string[]>>({});
  const [enviando, iniciar] = useTransition();

  const usandoPersonalizado = personalizado.trim().length > 0;
  const montoFinal = usandoPersonalizado
    ? Math.round(parseFloat(personalizado.replace(",", ".")) * 100)
    : centavos;
  const montoValido =
    Number.isFinite(montoFinal) && montoFinal >= MONTO_MINIMO && montoFinal <= MONTO_MAXIMO;

  function comprar(formData: FormData) {
    setError(null);
    setErrores({});

    iniciar(async () => {
      const res = await fetch("/api/gift-cards/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: montoFinal,
          format: formato,
          recipientName: String(formData.get("recipientName") ?? ""),
          recipientEmail: String(formData.get("recipientEmail") ?? ""),
          message: String(formData.get("message") ?? ""),
        }),
      });

      const json = await res.json();

      if (!json.ok) {
        if (json.error.fieldErrors) setErrores(json.error.fieldErrors);
        setError(json.error.fieldErrors ? null : json.error.message);
        return;
      }

      // Stripe cobra; el saldo solo se acredita desde el webhook.
      window.location.href = json.data.checkoutUrl;
    });
  }

  return (
    <form action={comprar} className="space-y-7" noValidate>
      {error && <Alert tono="error">{error}</Alert>}

      {/* 1. Monto */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-espresso">1. Elige el monto</legend>
        <div className="flex flex-wrap gap-2">
          {MONTOS_PRESET.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={!usandoPersonalizado && centavos === m}
              onClick={() => {
                setCentavos(m);
                setPersonalizado("");
              }}
              className={cn(
                "min-w-[4.5rem] rounded-lg border px-4 py-3 text-sm font-semibold transition-colors",
                !usandoPersonalizado && centavos === m
                  ? "border-terracota bg-terracota text-surface"
                  : "border-border bg-surface text-espresso hover:border-terracota"
              )}
            >
              ${m / 100}
            </button>
          ))}

          <div className="min-w-[9rem] flex-1">
            <Field
              label="Personalizado"
              labelOculto
              name="personalizado"
              inputMode="decimal"
              placeholder="Otro monto"
              value={personalizado}
              onChange={(e) => setPersonalizado(e.target.value)}
              icono={<CardIcon size={16} />}
            />
          </div>
        </div>
        {usandoPersonalizado && !montoValido && (
          <p role="alert" className="mt-2 text-xs font-semibold text-danger">
            Elige un monto entre ${MONTO_MINIMO / 100} y ${MONTO_MAXIMO / 100}.
          </p>
        )}
      </fieldset>

      {/* 2. Formato */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-espresso">2. Elige el formato</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { valor: "digital", titulo: "Digital", detalle: "Se envía al instante por correo." },
              { valor: "physical", titulo: "Física", detalle: "Envío a domicilio (2–4 días hábiles)." },
            ] as const
          ).map((o) => (
            <button
              key={o.valor}
              type="button"
              aria-pressed={formato === o.valor}
              onClick={() => setFormato(o.valor)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                formato === o.valor
                  ? "border-terracota bg-surface"
                  : "border-border bg-surface hover:border-terracota/50"
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-espresso">
                <GiftIcon size={17} />
                {o.titulo}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-text-muted">{o.detalle}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* 3. Destinatario */}
      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-semibold text-espresso">3. Destinatario</legend>
        <Field
          label="Nombre del destinatario"
          labelOculto
          name="recipientName"
          placeholder="Nombre del destinatario"
          required
          icono={<UserIcon size={18} />}
          error={errores.recipientName?.[0]}
        />
        <Field
          label="Correo electrónico del destinatario"
          labelOculto
          name="recipientEmail"
          type="email"
          inputMode="email"
          placeholder="Correo electrónico del destinatario"
          icono={<MailIcon size={18} />}
          error={errores.recipientEmail?.[0]}
          ayuda={formato === "digital" ? "Le enviaremos el código a esta dirección." : undefined}
        />
      </fieldset>

      {/* 4. Mensaje */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-espresso">
          4. Mensaje personal (opcional)
        </legend>
        <textarea
          name="message"
          maxLength={120}
          rows={3}
          placeholder="Escribe tu mensaje aquí…"
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-espresso placeholder:text-text-muted/60 focus:border-terracota focus:outline-none"
        />
        {errores.message?.[0] && (
          <p role="alert" className="mt-2 text-xs font-semibold text-danger">
            {errores.message[0]}
          </p>
        )}
      </fieldset>

      <div>
        <Button type="submit" cargando={enviando} disabled={!montoValido || !haySesion} className="w-full">
          {montoValido ? `Comprar gift card — ${formatearDolares(montoFinal)}` : "Elige un monto"}
        </Button>
        {!haySesion && (
          <p className="mt-3 text-center text-sm text-text-muted">
            Inicia sesión para completar la compra.
          </p>
        )}
        <p className="mt-3 text-center text-xs text-text-muted">
          Pago seguro con Stripe. Aceptamos tarjetas, Apple Pay y Google Pay.
        </p>
      </div>
    </form>
  );
}
