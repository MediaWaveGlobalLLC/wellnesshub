import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert } from "@/components/ui/Surface";

export const metadata: Metadata = {
  title: "Confirma tu correo",
  robots: { index: false, follow: false },
};

/**
 * docs/03: tras el alta no se asume sesión verificada. Se redirige aquí y el
 * usuario entra solo después de pulsar el enlace del correo.
 */
export default function ConfirmarPage() {
  return (
    <AuthShell
      titulo="Revisa tu correo"
      descripcion="Te enviamos un enlace para confirmar tu cuenta. Al abrirlo quedarás dentro."
      pie={
        <>
          ¿No te llegó?{" "}
          <Link
            href="/recuperar"
            className="font-semibold text-terracota underline underline-offset-4"
          >
            Vuelve a intentarlo
          </Link>
        </>
      }
    >
      <Alert>
        El enlace caduca por seguridad. Si expira, puedes pedir uno nuevo desde la
        pantalla de recuperación.
      </Alert>
    </AuthShell>
  );
}
