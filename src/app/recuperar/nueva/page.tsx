import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { NuevaPasswordForm } from "@/components/auth/ResetForms";

export const metadata: Metadata = {
  title: "Nueva contraseña",
  robots: { index: false, follow: false },
};

/**
 * Se llega aquí desde el enlace del correo, que pasa por /auth/callback y deja
 * una sesión de recuperación activa. La server action vuelve a comprobar esa
 * sesión antes de cambiar nada (docs/06).
 */
export default function NuevaPasswordPage() {
  return (
    <AuthShell
      titulo="Crea tu contraseña nueva"
      descripcion="Elige una contraseña que no uses en otro sitio."
    >
      <NuevaPasswordForm />
    </AuthShell>
  );
}
