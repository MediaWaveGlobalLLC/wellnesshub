import type { Metadata } from "next";
import tokens from "../../../config/design-tokens.json";
import { ICONS } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, PasswordField, Checkbox } from "@/components/ui/Field";
import { Alert, Badge, Card, ProgressBar, Skeleton } from "@/components/ui/Surface";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  SessionExpired,
  SuccessState,
} from "@/components/states";
import { LeafIcon } from "@/components/icons";

/**
 * Página interna del sistema de diseño — Fase 1.
 *
 * Es la evidencia visual del gate: reúne paleta, tipografía, iconos, primitivas y
 * los estados obligatorios de docs/02 en una sola pantalla comparable con los
 * mockups. No forma parte del producto público.
 */
export const metadata: Metadata = {
  title: "Sistema de diseño",
  robots: { index: false, follow: false },
};

const NOMBRES: Record<string, string> = {
  terracotta: "Terracota",
  mustard: "Mustard",
  oat: "Avena",
  milk: "Leche",
  espresso: "Espresso",
  teaTree: "Tea Tree",
  matcha: "Matcha",
  olive: "Olive",
  lightMatcha: "Light Matcha",
  forest: "Forest",
};

const VAR: Record<string, string> = {
  terracotta: "terracota",
  mustard: "mustard",
  oat: "avena",
  milk: "leche",
  espresso: "espresso",
  teaTree: "teatree",
  matcha: "matcha",
  olive: "olive",
  lightMatcha: "lightmatcha",
  forest: "forest",
};

function Seccion({ n, titulo, nota, children }: { n: string; titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-14">
      <div className="mb-8 flex items-baseline gap-4">
        <span className="text-xs font-bold tracking-[0.2em] text-terracota">{n}</span>
        <div>
          <h2 className="font-display text-3xl text-espresso">{titulo}</h2>
          {nota && <p className="mt-1 text-sm text-text-muted">{nota}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-leche pb-24 pt-32">
      <div className="mx-auto max-w-[var(--container-content)] px-5 sm:px-8">
        <header className="pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-terracota">
            Fase 1 · Foundation
          </p>
          <h1 className="mt-3 font-display text-5xl text-espresso sm:text-6xl">
            Sistema de diseño SIEMBRA
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-text-muted">
            Valores derivados de <code>config/design-tokens.json</code>, que coincide 1:1
            con la paleta y la tipografía del Brand Book oficial (págs. 3 y 4). Ninguna
            pantalla puede introducir un color, una fuente o un radio fuera de esta página.
          </p>
        </header>

        {/* ── Paleta ─────────────────────────────────────────────── */}
        <Seccion n="01" titulo="Paleta" nota="Brand Book pág. 3 — los 10 colores oficiales.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(tokens.colors).map(([key, hex]) => (
              <div key={key} className="overflow-hidden rounded-lg border border-border">
                {/* El valor viene del token protegido en tiempo de ejecución; no hay
                    ningún hex literal en este archivo. */}
                <div className="h-24" style={{ background: hex }} />
                <div className="bg-surface px-3 py-2.5">
                  <p className="text-sm font-semibold text-espresso">{NOMBRES[key]}</p>
                  <p className="font-mono text-xs uppercase text-text-muted">{hex}</p>
                  <p className="mt-1 font-mono text-[0.65rem] text-text-muted">
                    --color-{VAR[key]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Seccion>

        {/* ── Tipografía ─────────────────────────────────────────── */}
        <Seccion
          n="02"
          titulo="Tipografía"
          nota="The Seasons no está licenciada en el kit; el display cae a Droid Serif, el fallback que fija docs/01."
        >
          <div className="space-y-8">
            <div>
              <p className="mb-2 font-mono text-xs text-text-muted">font-display · Droid Serif</p>
              <p className="font-display text-5xl text-espresso">Siembra bienestar.</p>
              <p className="font-display text-3xl italic text-terracota">
                Cosecha tu mejor versión.
              </p>
            </div>
            <div>
              <p className="mb-2 font-mono text-xs text-text-muted">font-serif · Droid Serif</p>
              <p className="font-serif text-xl leading-relaxed text-espresso">
                Las mejores cosas se siembran con intención. Un buen día comienza con una
                taza de café, pero florece con hábitos y comunidad.
              </p>
            </div>
            <div>
              <p className="mb-2 font-mono text-xs text-text-muted">font-sans · Poppins</p>
              <div className="space-y-1 text-espresso">
                <p className="font-normal">Regular 400 · cuerpo, formularios y navegación</p>
                <p className="font-medium">Medium 500 · énfasis suave</p>
                <p className="font-semibold">Semibold 600 · labels y encabezados de módulo</p>
                <p className="font-bold">Bold 700 · botones y etiquetas</p>
              </div>
            </div>
          </div>
        </Seccion>

        {/* ── Iconos ─────────────────────────────────────────────── */}
        <Seccion
          n="03"
          titulo="Iconografía"
          nota="DEC-003 — dirección generada con Higgsfield y vectorizada a SVG. Heredan color con currentColor."
        >
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {Object.entries(ICONS).map(([name, Componente]) => (
              <div
                key={name}
                className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface py-5 text-espresso"
              >
                <Componente size={26} />
                <span className="font-mono text-[0.65rem] text-text-muted">{name}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center justify-center gap-4 rounded-lg bg-terracota py-6 text-leche">
              {["leaf", "gift", "wallet", "crown"].map((k) => {
                const C = ICONS[k as keyof typeof ICONS];
                return <C key={k} size={24} />;
              })}
            </div>
            <div className="flex items-center justify-center gap-4 rounded-lg bg-forest py-6 text-avena">
              {["cup", "qr", "star", "heart"].map((k) => {
                const C = ICONS[k as keyof typeof ICONS];
                return <C key={k} size={24} />;
              })}
            </div>
            <div className="flex items-center justify-center gap-4 rounded-lg border border-border bg-avena py-6 text-espresso">
              {["calendar", "pin", "card", "bag"].map((k) => {
                const C = ICONS[k as keyof typeof ICONS];
                return <C key={k} size={24} />;
              })}
            </div>
          </div>
        </Seccion>

        {/* ── Botones ────────────────────────────────────────────── */}
        <Seccion n="04" titulo="Botones" nota="Altura mínima 48px. Radio 16px, o píldora para el CTA del header.">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primario">Crear cuenta</Button>
            <Button variant="secundario">Ver beneficios</Button>
            <Button variant="forest">Canjear código</Button>
            <Button variant="terciario">Conoce más</Button>
            <ButtonLink href="/menu" shape="pill" size="md">
              Ordena online
            </ButtonLink>
            <Button variant="primario" disabled>
              Deshabilitado
            </Button>
            <Button variant="primario" cargando>
              Procesando
            </Button>
          </div>
        </Seccion>

        {/* ── Formularios ────────────────────────────────────────── */}
        <Seccion n="05" titulo="Formularios" nota="Composición del mockup 01 — Registro. Labels reales y errores asociados.">
          <Card className="max-w-md p-7">
            <div className="space-y-5">
              <Field label="Nombre" placeholder="Nombre" icono={<ICONS.user size={18} />} />
              <Field
                label="Correo electrónico"
                type="email"
                placeholder="Correo electrónico"
                icono={<ICONS.chat size={18} />}
                ayuda="Te enviaremos un enlace de verificación."
              />
              <Field
                label="Teléfono"
                type="tel"
                placeholder="Teléfono"
                icono={<ICONS.bell size={18} />}
                error="Introduce un teléfono válido de 10 dígitos."
              />
              <PasswordField
                label="Contraseña"
                placeholder="Contraseña"
                icono={<ICONS.qr size={18} />}
              />
              <Checkbox
                label={
                  <>
                    Acepto los{" "}
                    <span className="font-semibold text-terracota underline underline-offset-2">
                      Términos y Condiciones
                    </span>{" "}
                    y la{" "}
                    <span className="font-semibold text-terracota underline underline-offset-2">
                      Política de Privacidad
                    </span>
                    .
                  </>
                }
              />
              <Button variant="primario" className="w-full">
                Crear cuenta
              </Button>
            </div>
          </Card>
        </Seccion>

        {/* ── Superficies ────────────────────────────────────────── */}
        <Seccion n="06" titulo="Superficies" nota="Borde fino y sombra mínima, nunca glow.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                Superficie clara
              </p>
              <p className="mt-2 font-display text-2xl text-espresso">Actividad reciente</p>
            </Card>
            <Card tono="avena" className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-espresso/70">
                Avena
              </p>
              <p className="mt-2 font-display text-2xl">Gift card</p>
            </Card>
            <Card tono="terracota" className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-leche/80">
                Créditos disponibles
              </p>
              <p className="mt-2 font-display text-3xl">$68.40</p>
            </Card>
            <Card tono="forest" className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-avena/80">
                Mi membresía
              </p>
              <p className="mt-2 font-display text-2xl">Nivel Brote</p>
              <div className="mt-4">
                <ProgressBar valor={750} total={2000} etiqueta="750 / 2,000 pts" />
              </div>
            </Card>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Badge tono="exito">Completado</Badge>
            <Badge tono="aviso">En camino</Badge>
            <Badge tono="peligro">Cancelado</Badge>
            <Badge>Neutro</Badge>
            <span className="pill text-espresso">
              <LeafIcon size={14} /> Natural
            </span>
            <span className="pill text-olive">Tropical</span>
          </div>
        </Seccion>

        {/* ── Estados obligatorios ───────────────────────────────── */}
        <Seccion
          n="07"
          titulo="Estados obligatorios"
          nota="docs/02 los exige en toda pantalla: loading, empty, error, success, disabled y sesión expirada."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-3 font-mono text-xs text-text-muted">loading</p>
              <LoadingSkeleton />
            </div>
            <div>
              <p className="mb-3 font-mono text-xs text-text-muted">empty</p>
              <EmptyState
                icono={<ICONS.bag size={32} />}
                titulo="Todavía no tienes pedidos"
                descripcion="Cuando hagas tu primera compra en tienda, aparecerá aquí con los puntos que ganaste."
                accion={{ href: "/menu", texto: "Ver el menú" }}
              />
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-3 font-mono text-xs text-text-muted">error</p>
                <ErrorState descripcion="No pudimos cargar tu actividad. Revisa tu conexión e inténtalo de nuevo." />
              </div>
              <div>
                <p className="mb-3 font-mono text-xs text-text-muted">success</p>
                <SuccessState
                  titulo="Código canjeado"
                  descripcion="Acreditamos $50.00 a tu wallet. Ya puedes usarlos en tienda."
                />
              </div>
              <div>
                <p className="mb-3 font-mono text-xs text-text-muted">info</p>
                <Alert>Tu correo aún no está verificado. Revisa tu bandeja de entrada.</Alert>
              </div>
            </div>
            <div>
              <p className="mb-3 font-mono text-xs text-text-muted">session expired</p>
              <SessionExpired />
              <p className="mb-3 mt-6 font-mono text-xs text-text-muted">skeleton suelto</p>
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/5" />
              </div>
            </div>
          </div>
        </Seccion>

        {/* ── Medidas ────────────────────────────────────────────── */}
        <Seccion n="08" titulo="Medidas" nota="Valores implementables desde los tokens.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Radio normal", `${tokens.radius.lg}px`],
              ["Radio máximo aprobado", `${tokens.radius.maxApproved}px`],
              ["Altura de control", `${tokens.controls.height}px`],
              ["Altura mínima de botón", `${tokens.controls.buttonMinHeight}px`],
              ["Ancho de contenido", `${tokens.layout.contentMax}px`],
              ["Sección desktop", `${tokens.spacing.sectionDesktop}px`],
              ["Sección mobile", `${tokens.spacing.sectionMobile}px`],
              ["Movimiento normal", `${tokens.motion.normalMs}ms`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-surface px-4 py-3">
                <p className="text-xs uppercase tracking-[0.1em] text-text-muted">{k}</p>
                <p className="mt-1 font-display text-2xl text-espresso">{v}</p>
              </div>
            ))}
          </div>
        </Seccion>
      </div>
    </main>
  );
}
