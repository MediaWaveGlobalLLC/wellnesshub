import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SubpaginaShell } from "@/components/perfil/SubpaginaShell";
import { EditarPerfilForm } from "@/components/perfil/EditarPerfilForm";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { formatearTelefono } from "@/lib/telefono";

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
    .select("first_name, last_name, phone, member_id, marketing_email_opt_in")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil) redirect("/perfil");

  return (
    <SubpaginaShell
      titulo="Editar perfil"
      descripcion="Tus datos y cómo quieres que te escribamos."
    >
      <div className="max-w-xl">
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
