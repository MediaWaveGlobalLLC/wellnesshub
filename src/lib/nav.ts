/**
 * SIEMBRA — navegación canónica
 *
 * DEC-005 / plan D6. Los 4 mockups traen 4 headers distintos y varios enlaces sin
 * ruta en config/route-contracts.json. Se toma el header del mockup 03 (el más
 * completo) y se mapea contra rutas que existan de verdad.
 *
 * `fase` indica en qué fase del plan se construye el destino. Un ítem solo se
 * renderiza cuando su ruta ya está implementada: enlazar a un 404 sería peor que
 * no mostrarlo.
 */
export type NavItem = {
  href: string;
  es: string;
  en: string;
  /** Fase del plan en la que su destino queda disponible. */
  fase: number;
  disponible: boolean;
};

export const NAV_PRINCIPAL: NavItem[] = [
  { href: "/", es: "Inicio", en: "Home", fase: 1, disponible: true },
  { href: "/menu", es: "Menú", en: "Menu", fase: 1, disponible: true },
  { href: "/nosotros", es: "Nuestra historia", en: "Our story", fase: 1, disponible: true },
  { href: "/experiencia", es: "Experiencia", en: "Experience", fase: 1, disponible: true },
  { href: "/tienda", es: "Tienda", en: "Shop", fase: 1, disponible: true },
  { href: "/visitanos", es: "Contacto", en: "Contact", fase: 1, disponible: true },

  // Destinos del contrato aún no construidos. Se activan en su fase.
  { href: "/gift-cards", es: "Gift Cards & Créditos", en: "Gift Cards", fase: 5, disponible: false },
  { href: "/comunidad", es: "Comunidad", en: "Community", fase: 7, disponible: false },
];

/** Bottom nav móvil — plan D6, reconciliando los mockups 02 y 03. */
export const NAV_MOVIL: NavItem[] = [
  { href: "/", es: "Inicio", en: "Home", fase: 1, disponible: true },
  { href: "/menu", es: "Menú", en: "Menu", fase: 1, disponible: true },
  { href: "/wallet", es: "Wallet", en: "Wallet", fase: 4, disponible: false },
  { href: "/comunidad", es: "Comunidad", en: "Community", fase: 7, disponible: false },
  { href: "/perfil", es: "Perfil", en: "Profile", fase: 3, disponible: false },
];

export const navVisible = (items: NavItem[]) => items.filter((i) => i.disponible);
