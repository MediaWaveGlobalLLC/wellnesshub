import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import {
  BagIcon,
  HeartIcon,
  CalendarIcon,
  CardIcon,
  PinIcon,
  GearIcon,
  CupIcon,
  StarIcon,
  ChatIcon,
} from "@/components/icons";
// `PinIcon` sigue importado: lo usa la ficha del próximo taller para el lugar.
import { formatearPuntos } from "@/lib/loyalty";
import type { ActividadReciente, ProximoEvento } from "@/lib/services/profile-service";
import type { ItemDeMenu } from "@/lib/menu";
import { BRAND_ASSETS } from "@/lib/brand-assets.generated";

/* ── Formato de fechas ───────────────────────────────────────────────────── */

const ZONA = "America/Puerto_Rico";

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-PR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: ZONA,
  }).format(new Date(iso));
}

function fechaLarga(iso: string): string {
  const t = new Intl.DateTimeFormat("es-PR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONA,
  }).format(new Date(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-PR", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: ZONA,
  }).format(new Date(iso));
}

/* ── Grid de acciones — mockup 02 ────────────────────────────────────────── */

/*
  Las seis tarjetas del mockup 02 pasan a cinco, y dos de ellas eran mentira.

  · «Métodos de pago — Tarjetas y formas de pago guardadas» llevaba a `/wallet`
    y no guarda ninguna tarjeta: Stripe cobra en su propio checkout y aquí no se
    almacena ningún método. Prometía una pantalla que no existe.
  · «Direcciones — Gestiona tus direcciones de entrega» llevaba a
    `/perfil/editar`, que no tiene direcciones. Y no hace falta: no hay reparto.
    La tabla `addresses` sigue en la base por si algún día lo hay; lo que se
    retira es la promesa.

  En su lugar entra «Mis puntos», que existe desde `0020_recompensas.sql` y solo
  se alcanzaba desde la barra inferior del móvil: en un ordenador no había forma
  de llegar a las recompensas.
*/
const ACCIONES = [
  { href: "/perfil/pedidos", Icono: BagIcon, titulo: "Mis pedidos", detalle: "Consulta el estado de tus pedidos." },
  { href: "/puntos", Icono: StarIcon, titulo: "Mis puntos", detalle: "Tus puntos y lo que puedes canjear." },
  { href: "/perfil/favoritos", Icono: HeartIcon, titulo: "Mis favoritos", detalle: "Tus bebidas y productos favoritos." },
  { href: "/perfil/eventos", Icono: CalendarIcon, titulo: "Eventos y talleres", detalle: "Reserva y gestiona tus experiencias." },
  { href: "/wallet", Icono: CardIcon, titulo: "Mi crédito", detalle: "Saldo, movimientos y canjear una gift card." },
  { href: "/perfil/editar", Icono: GearIcon, titulo: "Configuración", detalle: "Tus datos y preferencias de la cuenta." },
];

export function AccionesGrid() {
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-6">
      {ACCIONES.map(({ href, Icono, titulo, detalle }) => (
        <li key={titulo}>
          <Link
            href={href}
            className="flex h-full flex-col rounded-lg border border-border bg-surface p-5 transition-colors hover:border-terracota/40"
          >
            <Icono size={26} className="text-espresso" />
            <p className="mt-4 text-sm font-semibold text-espresso">{titulo}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{detalle}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ── Actividad reciente — el ledger de puntos, no una lista inventada ────── */

const ICONO_POR_TIPO: Record<string, typeof CupIcon> = {
  earn: CupIcon,
  redeem: StarIcon,
  promotion: StarIcon,
  admin_adjustment: ChatIcon,
  correction: ChatIcon,
  expiration: CalendarIcon,
};

export function Actividad({ movimientos }: { movimientos: ActividadReciente[] }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
          Actividad reciente
        </h2>
        {movimientos.length > 0 && (
          <Link
            href="/wallet"
            className="text-xs font-semibold text-terracota underline underline-offset-4"
          >
            Ver toda
          </Link>
        )}
      </div>

      {movimientos.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            titulo="Todavía sin movimientos"
            descripcion="Tu primera compra en tienda empieza a sumar puntos."
          />
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {movimientos.map((m) => {
            const Icono = ICONO_POR_TIPO[m.tipo] ?? CupIcon;
            const positivo = m.puntos > 0;
            return (
              <li key={m.id} className="flex items-start gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
                <span className="mt-0.5 text-espresso/70">
                  <Icono size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-espresso">{m.descripcion}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{fechaCorta(m.fecha)}</p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${positivo ? "text-olive" : "text-terracota"}`}
                >
                  {positivo ? "+" : "−"}
                  {formatearPuntos(Math.abs(m.puntos))} pts
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ── Favoritos ───────────────────────────────────────────────────────────── */

export function Favoritos({ items }: { items: ItemDeMenu[] }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
          Favoritos
        </h2>
        <Link
          href="/perfil/favoritos"
          className="text-xs font-semibold text-terracota underline underline-offset-4"
        >
          Ver todos
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            titulo="Aún no marcaste favoritos"
            descripcion="Guarda lo que más te gusta del menú para pedirlo más rápido."
            accion={{ href: "/menu", texto: "Explorar el menú" }}
          />
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-4">
          {items.slice(0, 2).map((item) => (
            <li key={item.slug}>
              <p className="text-sm font-semibold text-espresso">{item.nombre}</p>
              <p className="mt-0.5 text-xs text-text-muted">{item.seccionTitulo}</p>
              <p className="mt-1 text-sm text-terracota">${item.precio}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── Próximo taller reservado ────────────────────────────────────────────── */

export function ProximoTaller({ evento }: { evento: ProximoEvento | null }) {
  if (!evento) {
    return (
      <Card className="p-6">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
          Próximo taller
        </h2>
        <div className="mt-5">
          <EmptyState
            titulo="No tienes reservas"
            descripcion="Los talleres y experiencias de la comunidad se anuncian cada mes."
            accion={{ href: "/perfil/eventos", texto: "Ver eventos" }}
          />
        </div>
      </Card>
    );
  }

  const imagen = BRAND_ASSETS.siembraEmployeeStockPhoto;

  return (
    <Card className="overflow-hidden">
      <div className="grid sm:grid-cols-[minmax(0,140px)_1fr]">
        <div className="relative h-32 sm:h-full">
          <Image src={imagen.src} alt="" fill sizes="140px" className="object-cover" />
        </div>
        <div className="p-5">
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Próximo taller reservado
          </h2>
          <p className="mt-2 font-display text-lg text-espresso">{evento.titulo}</p>
          <ul className="mt-3 space-y-1.5 text-xs text-text-muted">
            <li className="flex items-center gap-2">
              <CalendarIcon size={14} /> {fechaLarga(evento.inicio)}
            </li>
            <li className="flex items-center gap-2">
              <CupIcon size={14} /> {hora(evento.inicio)}
              {evento.fin ? ` – ${hora(evento.fin)}` : ""}
            </li>
            <li className="flex items-center gap-2">
              <PinIcon size={14} /> {evento.lugar}
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

/* ── Código de miembro ───────────────────────────────────────────────────── */

export function CodigoMiembro({
  memberId,
  nivel,
  qrSvg,
}: {
  memberId: string;
  nivel: string;
  qrSvg: string | null;
}) {
  return (
    <Card className="flex flex-col items-center p-6 text-center">
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
        Tu código de miembro
      </h2>
      <p className="mt-2 text-sm font-semibold text-espresso">Nivel {nivel}</p>

      <div className="mt-5 rounded-sm border border-border bg-leche p-3">
        {qrSvg ? (
          // El QR lleva un token público revocable, nunca saldo ni correo (docs/04).
          <div className="h-[150px] w-[150px] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        ) : (
          <div className="flex h-[150px] w-[150px] items-center justify-center text-xs text-text-muted">
            Código no disponible
          </div>
        )}
      </div>

      <p className="mt-4 text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">Id miembro</p>
      <p className="font-display text-xl text-espresso">{memberId}</p>
      <p className="mt-3 text-xs leading-relaxed text-text-muted">
        Presenta este código en caja para acumular y canjear puntos.
      </p>
    </Card>
  );
}
