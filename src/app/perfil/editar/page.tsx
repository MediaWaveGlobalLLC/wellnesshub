import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SubpaginaShell } from "@/components/perfil/SubpaginaShell";
import { EditarPerfilForm } from "@/components/perfil/EditarPerfilForm";
import { FotoDePerfil } from "@/components/perfil/FotoDePerfil";
import { Card } from "@/components/ui/Surface";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { formatearTelefono } from "@/lib/telefono";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";

export const metadata: Metadata = {
  title: "Editar perfil",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditarPerfilPage() {
  if (!supabaseConfigurado()) redirect("/iniciar-sesion?siguiente=%2Fperfil%2Feditar");

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/iniciar-sesion?siguiente=%2Fperfil%2Feditar");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone, member_id, avatar_url, marketing_email_opt_in")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil) redirect("/perfil");

  return (
    <SubpaginaShell
      titulo="Editar perfil"
      descripcion="Tus datos y cómo quieres que te escribamos."
    >
      <div className="max-w-xl">
        {/* La foto va primero: es lo que se ve arriba en el perfil. */}
        <Card className="mb-5 p-5 sm:p-6">
          <FotoDePerfil
            urlInicial={perfil.avatar_url}
            respaldo={BRAND_ASSETS.duenaDeSiembraTransparente.src}
            nombre={perfil.first_name ?? "tu cuenta"}
          />
        </Card>

        <EditarPerfilForm
          inicial={{
            firstName: perfil.first_name ?? "",
            lastName: perfil.last_name ?? "",
            phone: formatearTelefono(perfil.phone),
            marketingOptIn: perfil.marketing_email_opt_in,
          }}
          email={user.email ?? ""}
          memberId={perfil.member_id}
        />
      </div>
    </SubpaginaShell>
  );
}
