"use client";

import { useActionState } from "react";
import {
  actualizarPasswordForm,
  solicitarResetForm,
  type ResultadoAccion,
} from "@/lib/auth/acciones";
import { Field, PasswordField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Surface";
import { MailIcon, LockIcon } from "@/components/icons";

/** Paso 1 — pedir el enlace de recuperación. */
export function SolicitarResetForm() {
  const [estado, accion, enviando] = useActionState<ResultadoAccion | null, FormData>(
    solicitarResetForm,
    null
  );

  // Respuesta idéntica exista o no la cuenta: no se filtra qué correos están
  // registrados (docs/06).
  if (estado?.ok) {
    return <Alert tono="exito" titulo="Revisa tu correo">{estado.mensaje}</Alert>;
  }

  const errores = estado && !estado.ok ? (estado.error.fieldErrors ?? {}) : {};
  const errorGeneral =
    estado && !estado.ok && !estado.error.fieldErrors ? estado.error.message : undefined;

  return (
    <>
      {errorGeneral && (
        <div className="mb-5">
          <Alert tono="error">{errorGeneral}</Alert>
        </div>
      )}
      <form action={accion} className="space-y-4" noValidate>
        <Field
          label="Correo electrónico"
          name="email"
          type="email"
          inputMode="email"
          placeholder="Correo electrónico"
          autoComplete="email"
          required
          icono={<MailIcon size={18} />}
          error={errores.email?.[0]}
        />
        <Button type="submit" cargando={enviando} className="w-full">
          Enviar enlace
        </Button>
      </form>
    </>
  );
}

/** Paso 2 — definir la contraseña nueva, ya con la sesión del enlace. */
export function NuevaPasswordForm() {
  const [estado, accion, enviando] = useActionState<ResultadoAccion | null, FormData>(
    actualizarPasswordForm,
    null
  );

  const errores = estado && !estado.ok ? (estado.error.fieldErrors ?? {}) : {};
  const errorGeneral =
    estado && !estado.ok && !estado.error.fieldErrors ? estado.error.message : undefined;

  return (
    <>
      {errorGeneral && (
        <div className="mb-5">
          <Alert tono="error">{errorGeneral}</Alert>
        </div>
      )}
      <form action={accion} className="space-y-4" noValidate>
        <PasswordField
          label="Contraseña nueva"
          name="password"
          placeholder="Contraseña nueva"
          autoComplete="new-password"
          required
          icono={<LockIcon size={18} />}
          error={errores.password?.[0]}
          ayuda="Mínimo 8 caracteres, con al menos una letra y un número."
        />
        <PasswordField
          label="Confirmar contraseña"
          name="confirmPassword"
          placeholder="Confirmar contraseña"
          autoComplete="new-password"
          required
          icono={<LockIcon size={18} />}
          error={errores.confirmPassword?.[0]}
        />
        <Button type="submit" cargando={enviando} className="w-full">
          Guardar contraseña
        </Button>
      </form>
    </>
  );
}
