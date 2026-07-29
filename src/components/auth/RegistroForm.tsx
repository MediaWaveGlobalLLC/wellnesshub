"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registrarseForm, type ResultadoAccion } from "@/lib/auth/acciones";
import { Field, PasswordField, Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Surface";
import { SunBean } from "@/components/SunBean";
import { UserIcon, MailIcon, PhoneIcon, LockIcon } from "@/components/icons";

/**
 * Card de registro — mockup 01, columna derecha.
 *
 * Usa `<form action>` + useActionState: el alta funciona aunque el JS no cargue,
 * y los errores del servidor se pintan por campo sin perder lo escrito.
 */
export function RegistroForm() {
  const [estado, accion, enviando] = useActionState<ResultadoAccion | null, FormData>(
    registrarseForm,
    null
  );

  const errores = estado && !estado.ok ? (estado.error.fieldErrors ?? {}) : {};
  const primerError = (campo: string) => errores[campo]?.[0];
  const errorGeneral =
    estado && !estado.ok && !estado.error.fieldErrors ? estado.error.message : undefined;

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-warm sm:p-8">
      <div className="mb-6 text-center">
        <span className="inline-block text-terracota">
          <SunBean size={44} color="currentColor" />
        </span>
        <h2 className="mt-3 font-display text-2xl text-espresso sm:text-[1.75rem]">
          Únete a la comunidad
        </h2>
      </div>

      {errorGeneral && (
        <div className="mb-5">
          <Alert tono="error">{errorGeneral}</Alert>
        </div>
      )}

      <form action={accion} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombre"
            name="firstName"
            placeholder="Nombre"
            autoComplete="given-name"
            required
            icono={<UserIcon size={18} />}
            error={primerError("firstName")}
          />
          <Field
            label="Apellido"
            name="lastName"
            placeholder="Apellido"
            autoComplete="family-name"
            required
            icono={<UserIcon size={18} />}
            error={primerError("lastName")}
          />
        </div>

        <Field
          label="Correo electrónico"
          name="email"
          type="email"
          inputMode="email"
          placeholder="Correo electrónico"
          autoComplete="email"
          required
          icono={<MailIcon size={18} />}
          error={primerError("email")}
        />

        <Field
          label="Teléfono"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="Teléfono"
          autoComplete="tel"
          required
          icono={<PhoneIcon size={18} />}
          error={primerError("phone")}
        />

        <PasswordField
          label="Contraseña"
          name="password"
          placeholder="Contraseña"
          autoComplete="new-password"
          required
          icono={<LockIcon size={18} />}
          error={primerError("password")}
          ayuda="Mínimo 8 caracteres, con al menos una letra y un número."
        />

        <PasswordField
          label="Confirmar contraseña"
          name="confirmPassword"
          placeholder="Confirmar contraseña"
          autoComplete="new-password"
          required
          icono={<LockIcon size={18} />}
          error={primerError("confirmPassword")}
        />

        <Checkbox
          name="acceptTerms"
          error={primerError("acceptTerms")}
          label={
            <>
              Acepto los{" "}
              <Link
                href="/terminos"
                className="font-semibold text-terracota underline underline-offset-2"
              >
                Términos y Condiciones
              </Link>{" "}
              y la{" "}
              <Link
                href="/privacidad"
                className="font-semibold text-terracota underline underline-offset-2"
              >
                Política de Privacidad
              </Link>
              .
            </>
          }
        />

        {/* El mockup 01 solo trae el consentimiento de términos. Las preferencias
            de comunicación viven en /perfil/editar, que es donde docs/00 las
            sitúa ("Edición de perfil · Preferencias de comunicación"). */}

        <Button type="submit" cargando={enviando} className="w-full">
          Crear cuenta
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/iniciar-sesion"
          className="font-semibold text-terracota underline underline-offset-4"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
