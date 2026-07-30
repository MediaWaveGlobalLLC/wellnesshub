import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Inicia sesión",
  description: "Entra a tu cuenta SIEMBRA para ver tus puntos, tu saldo y tus eventos.",
};

export default async function IniciarSesionPage({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string }>;
}) {
  const { siguiente } = await searchParams;
  // Solo rutas internas: una URL absoluta aquí sería un open redirect (docs/06).
  const destino = siguiente?.startsWith("/") && !siguiente.startsWith("//") ? siguiente : undefined;

  return (
    <AuthShell
      titulo="Bienvenida de vuelta"
      descripcion="Entra para ver tus puntos, tu saldo y tus próximos talleres."
      pie={
        <>
          ¿Todavía no tienes cuenta?{" "}
          <Link
            href="/registro"
            className="font-semibold text-terracota underline underline-offset-4"
          >
            Crea la tuya
          </Link>
        </>
      }
    >
      <LoginForm siguiente={destino} />
    </AuthShell>
  );
}
