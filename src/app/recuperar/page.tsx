import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SolicitarResetForm } from "@/components/auth/ResetForms";

export const metadata: Metadata = {
  title: "Recupera tu contraseña",
  robots: { index: false, follow: false },
};

export default function RecuperarPage() {
  return (
    <AuthShell
      titulo="Recupera tu contraseña"
      descripcion="Escribe tu correo y te enviamos un enlace para crear una contraseña nueva."
      pie={
        <Link
          href="/iniciar-sesion"
          className="font-semibold text-terracota underline underline-offset-4"
        >
          Volver a iniciar sesión
        </Link>
      }
    >
      <SolicitarResetForm />
    </AuthShell>
  );
}
