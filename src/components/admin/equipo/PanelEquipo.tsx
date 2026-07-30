"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge, Card } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/admin/ui/Campos";
import { Celda, Fila, Tabla } from "@/components/admin/ui/Tabla";
import { CheckIcon, MasIcon } from "@/components/icons";
import { concederAdmin, revocarAdmin, type Resultado } from "@/lib/admin/acciones";
import { ETIQUETA_ROL } from "@/lib/services/permisos";
import type { Administradora } from "@/lib/services/operaciones";

/**
 * Quién puede entrar al panel.
 *
 * Hasta ahora solo se nombraba editando `ADMIN_EMAIL_ALLOWLIST` y
 * redesplegando, aunque `admin_users` tiene `granted_by` y `note` desde `0008`
 * justamente para esto.
 */

function fecha(iso: string): string {
  return new Intl.DateTimeFormat("es-PR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Puerto_Rico",
  }).format(new Date(iso));
}

export function PanelEquipo({
  admins,
  actorId,
}: {
  admins: Administradora[];
  /** Para no ofrecerse a una misma el botón de quitarse el acceso. */
  actorId: string;
}) {
  const router = useRouter();
  const [anadiendo, setAnadiendo] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [revocando, setRevocando] = useState<string | null>(null);

  const campos = resultado && !resultado.ok ? (resultado.campos ?? {}) : {};

  function ejecutar(fn: () => Promise<Resultado>, alTerminar?: () => void) {
    setResultado(null);
    iniciar(async () => {
      const r = await fn();
      setResultado(r);
      if (r.ok) {
        alTerminar?.();
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="mt-5">
        {anadiendo ? (
          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-xl text-espresso">Dar acceso a alguien</h2>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">
              La persona tiene que <strong>tener ya cuenta en la web</strong>: el acceso se cuelga de
              su cuenta, no se crea una nueva desde aquí.
            </p>

            <form
              className="mt-4 space-y-4"
              action={(fd) =>
                ejecutar(
                  () =>
                    concederAdmin({
                      email: String(fd.get("email") ?? ""),
                      rol: String(fd.get("rol") ?? "empleado"),
                      nota: String(fd.get("nota") ?? ""),
                    }),
                  () => setAnadiendo(false)
                )
              }
            >
              <Field
                label="Correo de su cuenta"
                name="email"
                type="email"
                required
                error={campos.email?.[0]}
              />

              <Select label="Rol" name="rol" defaultValue="empleado" error={campos.rol?.[0]}>
                <option value="empleado">Empleado — consulta clientes y pasa lista</option>
                <option value="duena">Dueña — puede hacerlo todo</option>
              </Select>

              <Field
                label="Nota"
                name="nota"
                placeholder="Barista de tarde, socia, contable…"
                error={campos.nota?.[0]}
                ayuda="Para acordarte de por qué tiene acceso."
              />

              <div className="flex flex-wrap gap-3">
                <Button type="submit" cargando={pendiente}>
                  Dar acceso
                </Button>
                <Button type="button" variant="terciario" onClick={() => setAnadiendo(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Button type="button" onClick={() => setAnadiendo(true)}>
            <MasIcon size={15} />
            Dar acceso a alguien
          </Button>
        )}
      </div>

      <Card className="mt-6 p-5 sm:p-6">
        <Tabla
          descripcion="Personas con acceso al panel de administración"
          columnas={[
            { clave: "persona", titulo: "Persona" },
            { clave: "rol", titulo: "Rol" },
            { clave: "nota", titulo: "Nota", secundaria: true },
            { clave: "alta", titulo: "Desde", secundaria: true },
            { clave: "acciones", titulo: "", numerica: true },
          ]}
        >
          {admins.map((a) => (
            <Fila key={a.userId}>
              <Celda principal>
                {a.nombre}
                {a.email && (
                  <span className="block text-xs font-normal text-text-muted">{a.email}</span>
                )}
              </Celda>
              <Celda>
                <Badge tono={a.rol === "duena" ? "exito" : "neutro"}>{ETIQUETA_ROL[a.rol]}</Badge>
              </Celda>
              <Celda secundaria>
                {a.nota ?? "—"}
                {a.concedidoPor && (
                  <span className="block text-xs text-text-muted">Lo dio {a.concedidoPor}</span>
                )}
              </Celda>
              <Celda secundaria>{fecha(a.altaAt)}</Celda>
              <Celda numerica>
                {a.userId === actorId ? (
                  <span className="text-xs text-text-muted">Eres tú</span>
                ) : (
                  <Button
                    type="button"
                    size="md"
                    variant="terciario"
                    onClick={() => setRevocando(revocando === a.userId ? null : a.userId)}
                    aria-expanded={revocando === a.userId}
                  >
                    Quitar acceso
                  </Button>
                )}
              </Celda>
            </Fila>
          ))}
        </Tabla>

        {revocando && (
          <form
            className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-surface-muted p-3"
            action={(fd) =>
              ejecutar(
                () =>
                  revocarAdmin({
                    userId: revocando,
                    reason: String(fd.get("motivo") ?? ""),
                  }),
                () => setRevocando(null)
              )
            }
          >
            <div className="min-w-[16rem] flex-1">
              <Field
                label="¿Por qué se le quita el acceso?"
                name="motivo"
                required
                minLength={6}
                placeholder="Queda en la auditoría"
              />
            </div>
            <Button type="submit" size="md" cargando={pendiente}>
              Quitar acceso
            </Button>
            <Button type="button" size="md" variant="terciario" onClick={() => setRevocando(null)}>
              Cancelar
            </Button>
          </form>
        )}

        {resultado && (
          <p
            role={resultado.ok ? "status" : "alert"}
            className={`mt-3 flex items-start gap-1.5 text-sm ${resultado.ok ? "text-olive" : "text-danger"}`}
          >
            {resultado.ok && <CheckIcon size={15} />}
            {resultado.ok ? resultado.mensaje : resultado.error}
          </p>
        )}
      </Card>
    </>
  );
}
