"use client";

import { useActionState } from "react";
import { actualizarPerfil } from "@/lib/perfil/acciones";
import type { ResultadoAccion } from "@/lib/auth/acciones";
import { Field, Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert, Card } from "@/components/ui/Surface";
import { UserIcon, PhoneIcon, MailIcon } from "@/components/icons";

/**
 * Datos personales y preferencias de comunicación — `docs/00`.
 *
 * El correo y el ID de miembro se muestran pero no se editan: cambiar el correo
 * es un flujo de verificación aparte, y el member_id es identidad —el trigger
 * `protect_profile_columns` lo restauraría igualmente.
 */
export function EditarPerfilForm({
  inicial,
  email,
  memberId,
}: {
  inicial: { firstName: string; lastName: string; phone: string; marketingOptIn: boolean };
  email: string;
  memberId: string;
}) {
  const [estado, accion, enviando] = useActionState<ResultadoAccion | null, FormData>(
    actualizarPerfil,
    null
  );

  const errores = estado && !estado.ok ? (estado.error.fieldErrors ?? {}) : {};
  const errorGeneral =
    estado && !estado.ok && !estado.error.fieldErrors ? estado.error.message : undefined;

  return (
    <Card className="p-6 sm:p-8">
      {estado?.ok && (
        <div className="mb-6">
          <Alert tono="exito">{estado.mensaje ?? "Datos actualizados."}</Alert>
        </div>
      )}
      {errorGeneral && (
        <div className="mb-6">
          <Alert tono="error">{errorGeneral}</Alert>
        </div>
      )}

      <form action={accion} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Nombre"
            name="firstName"
            defaultValue={inicial.firstName}
            autoComplete="given-name"
            required
            icono={<UserIcon size={18} />}
            error={errores.firstName?.[0]}
          />
          <Field
            label="Apellido"
            name="lastName"
            defaultValue={inicial.lastName}
            autoComplete="family-name"
            required
            icono={<UserIcon size={18} />}
            error={errores.lastName?.[0]}
          />
        </div>

        <Field
          label="Teléfono"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={inicial.phone}
          autoComplete="tel"
          required
          icono={<PhoneIcon size={18} />}
          error={errores.phone?.[0]}
        />

        {/* Solo lectura: cambiar el correo exige verificar el nuevo. */}
        <Field
          label="Correo electrónico"
          name="emailLectura"
          defaultValue={email}
          readOnly
          disabled
          icono={<MailIcon size={18} />}
          ayuda="Para cambiar tu correo, escríbenos y lo verificamos contigo."
        />

        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Id de miembro
          </p>
          <p className="mt-1 font-display text-lg text-espresso">{memberId}</p>
        </div>

        <fieldset className="border-t border-border pt-5">
          <legend className="sr-only">Preferencias de comunicación</legend>
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
            Preferencias de comunicación
          </p>
          <Checkbox
            name="marketingOptIn"
            defaultChecked={inicial.marketingOptIn}
            label="Quiero recibir novedades, eventos y ofertas de SIEMBRA por correo."
          />
        </fieldset>

        <Button type="submit" cargando={enviando}>
          Guardar cambios
        </Button>
      </form>
    </Card>
  );
}
