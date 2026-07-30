"use client";

import Link from "next/link";
import { useActionState } from "react";
import { iniciarSesionForm, type ResultadoAccion } from "@/lib/auth/acciones";
import { Field, PasswordField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Surface";
import { MailIcon, LockIcon } from "@/components/icons";

export function LoginForm({ siguiente }: { siguiente?: string }) {
  const [estado, accion, enviando] = useActionState<ResultadoAccion | null, FormData>(
    iniciarSesionForm,
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
        {/* Destino tras entrar. El schema solo acepta rutas internas. */}
        {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}

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

        <PasswordField
          label="Contraseña"
          name="password"
          placeholder="Contraseña"
          autoComplete="current-password"
          required
          icono={<LockIcon size={18} />}
          error={errores.password?.[0]}
        />

        <div className="text-right">
          <Link
            href="/recuperar"
            className="text-sm font-semibold text-terracota underline underline-offset-4"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <Button type="submit" cargando={enviando} className="w-full">
          Iniciar sesión
        </Button>
      </form>
    </>
  );
}
