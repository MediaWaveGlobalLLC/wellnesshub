/**
 * SIEMBRA — sistema de iconos
 *
 * Origen: DEC-003. El material entregado no incluía set de iconos; se generó la
 * dirección con Higgsfield (referencia congelada en
 * docs/assets/iconos-referencia-higgsfield.png) y se vectorizó a mano aquí.
 *
 * Reglas del sistema:
 *  · viewBox 24×24, trazo 1.5, sin relleno.
 *  · `stroke="currentColor"` para heredar color sobre Leche, Terracota y Forest.
 *  · Cabos y uniones redondeados, coherente con el trazo de los mockups.
 *  · `aria-hidden` por defecto: son decorativos salvo que se les pase `title`.
 *
 * docs/01 prohíbe emojis como iconografía de UI. Este es su reemplazo.
 */
import type { SVGProps } from "react";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Tamaño en px. Por defecto 24. */
  size?: number;
  /** Si se pasa, el icono deja de ser decorativo y se anuncia a lectores. */
  title?: string;
};

function Icon({ size = 24, title, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Hoja — lealtad, bienestar, atributos de marca. */
export const LeafIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.2 18.2c0-6.8 4.9-11.6 11.6-11.6 0 6.8-4.8 11.6-11.6 11.6Z" />
    <path d="M6.2 18.2c2.9-2.9 6.7-6.7 9.6-9.6" />
    <path d="M4 21.5c.9-1.1 1.6-2.1 1.9-2.9" />
  </Icon>
);

/** Regalo — gift cards. */
export const GiftIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="7.5" width="18" height="4" rx="1" />
    <path d="M5 11.5v8.2c0 .5.4.8.9.8h12.2c.5 0 .9-.3.9-.8v-8.2" />
    <path d="M12 7.5v13" />
    <path d="M12 7.5C10.7 6 9.2 3.4 7.7 4c-1.4.6-.8 3 4.3 3.5Z" />
    <path d="M12 7.5c1.3-1.5 2.8-4.1 4.3-3.5 1.4.6.8 3-4.3 3.5Z" />
  </Icon>
);

/** Calendario — eventos y talleres. */
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5.5" width="18" height="15.5" rx="2" />
    <path d="M3 10.2h18" />
    <path d="M8 3v4.4M16 3v4.4" />
    <path d="M7 13.5h3.2M13.8 13.5H17M7 17h3.2M13.8 17H17" />
  </Icon>
);

/** Taza — menú, bebidas, ritual. */
export const CupIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 8.5h11.2v4.8a5.6 5.6 0 0 1-11.2 0V8.5Z" />
    <path d="M15.7 9.8h1.6a2.4 2.4 0 0 1 0 4.8h-1.6" />
    <path d="M2.8 19.8h15.6" />
    <path d="M8.6 5.6c0-1 .9-1.4.9-2.4M12 5.6c0-1 .9-1.4.9-2.4" />
  </Icon>
);

/** Usuario — cuenta y perfil. */
export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.2" r="4" />
    <path d="M4.6 20.4a7.4 7.4 0 0 1 14.8 0" />
  </Icon>
);

/** QR — código de miembro. */
export const QrIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.2" />
    <rect x="5.4" y="5.4" width="2.2" height="2.2" rx="0.4" />
    <rect x="14" y="3" width="7" height="7" rx="1.2" />
    <rect x="16.4" y="5.4" width="2.2" height="2.2" rx="0.4" />
    <rect x="3" y="14" width="7" height="7" rx="1.2" />
    <rect x="5.4" y="16.4" width="2.2" height="2.2" rx="0.4" />
    <path d="M14 14h2.4M19 14h2M14 17.4h2M18.4 17.4h2.6M14 20.8h3.4M20 20.8h1" />
  </Icon>
);

/** Wallet — saldo de crédito. */
export const WalletIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.2 7.6c0-1.1.9-2 2-2h11.4c1.1 0 2 .9 2 2" />
    <rect x="3.2" y="7.6" width="17.6" height="11.8" rx="2" />
    <path d="M20.8 11.6h-3.4a2 2 0 0 0 0 4h3.4" />
    <circle cx="17.6" cy="13.6" r="0.75" fill="currentColor" stroke="none" />
  </Icon>
);

/** Corona — nivel de membresía. */
export const CrownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8.4l4.6 3.6L12 5l4.4 7 4.6-3.6v8.2H3V8.4Z" />
    <path d="M4.6 20.4h14.8" />
  </Icon>
);

/** Tarjeta — métodos de pago referenciados. */
export const CardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="5.2" width="19" height="13.6" rx="2" />
    <path d="M2.5 9.4h19" />
    <path d="M2.5 12.4h19" />
  </Icon>
);

/** Pin — dirección y visítanos. */
export const PinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21.2c0 0 7-6.1 7-10.9a7 7 0 1 0-14 0c0 4.8 7 10.9 7 10.9Z" />
    <circle cx="12" cy="10.1" r="2.7" />
  </Icon>
);

/** Engranaje — configuración de cuenta. */
export const GearIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="7.1" />
    <circle cx="12" cy="12" r="3.1" />
    {[0, 60, 120, 180, 240, 300].map((deg) => (
      <path key={deg} d="M12 4.9V2.4" transform={`rotate(${deg} 12 12)`} />
    ))}
  </Icon>
);

/** Estrella — recompensas y favoritos destacados. */
export const StarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.4l2.6 5.4 6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.4 9.7l6-.9L12 3.4Z" />
  </Icon>
);

/** Burbuja — mensajes y soporte. */
export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.2c5 0 9 3.1 9 6.9s-4 6.9-9 6.9c-.9 0-1.8-.1-2.6-.3l-4.4 2.4.8-3.2C3.9 15.6 3 13.5 3 11.1c0-3.8 4-6.9 9-6.9Z" />
  </Icon>
);

/** Bolsa — pedidos y tienda. */
export const BagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.2 8.4h13.6l1.1 11.3c.1.6-.4 1.1-1 1.1H5.1c-.6 0-1.1-.5-1-1.1L5.2 8.4Z" />
    <path d="M9 8.4V6.6a3 3 0 0 1 6 0v1.8" />
    <circle cx="9" cy="10.2" r="0.7" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10.2" r="0.7" fill="currentColor" stroke="none" />
  </Icon>
);

/** Corazón — favoritos. */
export const HeartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20.4S3.6 15.1 3.6 9.3A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.4 2.7c0 5.8-8.4 11.1-8.4 11.1Z" />
  </Icon>
);

/** Campana — avisos y notificaciones. */
export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 16.6V11a6 6 0 0 0-12 0v5.6L4.4 19h15.2L18 16.6Z" />
    <path d="M9.9 21.4a2.2 2.2 0 0 0 4.2 0" />
    <circle cx="12" cy="3.8" r="1.2" />
  </Icon>
);

/** Sobre — campo de correo electrónico (mockup 01). */
export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.6" y="5.2" width="18.8" height="13.6" rx="2" />
    <path d="M3.4 6.6 12 12.8l8.6-6.2" />
  </Icon>
);

/** Auricular — campo de teléfono (mockup 01). */
export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7.6 3.4H5.2a1.8 1.8 0 0 0-1.8 2c.5 4.3 2.3 8.1 5.2 11s6.7 4.7 11 5.2a1.8 1.8 0 0 0 2-1.8v-2.4a1.5 1.5 0 0 0-1.3-1.5 12 12 0 0 1-2.6-.6 1.5 1.5 0 0 0-1.6.35l-1 1a15.4 15.4 0 0 1-6.15-6.15l1-1a1.5 1.5 0 0 0 .35-1.6 12 12 0 0 1-.6-2.6 1.5 1.5 0 0 0-1.5-1.3Z" />
  </Icon>
);

/** Candado — campos de contraseña (mockup 01). */
export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.2" y="10.2" width="15.6" height="10.6" rx="2" />
    <path d="M7.8 10.2V7.4a4.2 4.2 0 0 1 8.4 0v2.8" />
    <circle cx="12" cy="15.5" r="1.15" fill="currentColor" stroke="none" />
  </Icon>
);

/* ── Iconos de administración ─────────────────────────────────────────────
   Los de arriba son de marca: hablan de café, lealtad y comunidad. Estos son
   de herramienta —editar, borrar, ordenar— y solo aparecen en el panel. Mismo
   trazo y mismas reglas para que no se note la costura. */

/** Chevron. Apunta abajo; se gira con rotate para las demás direcciones. */
export const ChevronIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9.5 12 15.5 18 9.5" />
  </Icon>
);

/** Lupa — buscar. */
export const LupaIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icon>
);

/** Lápiz — editar. */
export const LapizIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4.2l10-10a2.1 2.1 0 0 0-3-3l-10 10V20Z" />
    <path d="m14.5 6.5 3 3" />
  </Icon>
);

/** Papelera — archivar o retirar. */
export const PapeleraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6.5h16" />
    <path d="M9.5 6.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
    <path d="M6.5 6.5 7.4 20a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1l.9-13.5" />
    <path d="M10.5 10.5v6.5M13.5 10.5v6.5" />
  </Icon>
);

/** Check — confirmación. */
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

/** Cerrar. */
export const CerrarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </Icon>
);

/** Más — añadir. */
export const MasIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

/** Flechas arriba/abajo — reordenar. */
export const OrdenarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 4.5v15M8 4.5 4.5 8M8 4.5 11.5 8" />
    <path d="M16 19.5v-15M16 19.5 12.5 16M16 19.5 19.5 16" />
  </Icon>
);

/** Descarga — exportar. */
export const DescargaIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </Icon>
);

/** Barras — métricas. */
export const GraficaIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h16" />
    <path d="M7 20v-6M12 20V6M17 20v-9" />
  </Icon>
);

/** Índice para la página interna /_design y para render dinámico. */
export const ICONS = {
  leaf: LeafIcon,
  gift: GiftIcon,
  calendar: CalendarIcon,
  cup: CupIcon,
  user: UserIcon,
  qr: QrIcon,
  wallet: WalletIcon,
  crown: CrownIcon,
  card: CardIcon,
  pin: PinIcon,
  gear: GearIcon,
  star: StarIcon,
  chat: ChatIcon,
  bag: BagIcon,
  heart: HeartIcon,
  bell: BellIcon,
  mail: MailIcon,
  phone: PhoneIcon,
  lock: LockIcon,
  chevron: ChevronIcon,
  lupa: LupaIcon,
  lapiz: LapizIcon,
  papelera: PapeleraIcon,
  check: CheckIcon,
  cerrar: CerrarIcon,
  mas: MasIcon,
  ordenar: OrdenarIcon,
  descarga: DescargaIcon,
  grafica: GraficaIcon,
} as const;

export type IconName = keyof typeof ICONS;
