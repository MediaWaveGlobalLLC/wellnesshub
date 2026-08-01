/**
 * SIEMBRA — navegación canónica
 *
 * DEC-005 / plan D6. Los 4 mockups traen 4 headers distintos y varios enlaces
 * sin ruta en `config/route-contracts.json`. Se toma el header del mockup 03
 * —el más completo— y se mapea contra rutas que existan de verdad.
 *
 * El flag `disponible` de la Fase 1 se retira: quedó obsoleto y dejó `/gift-cards`
 * viva y sin enlazar desde ninguna parte durante varias fases. Ahora la regla es
 * más simple y no puede desincronizarse: aquí solo aparecen rutas construidas.
 */
export type NavItem = {
  href: string;
  es: string;
  en: string;
};

/**
 * Header y footer.
 *
 * `/experiencia` y `/tienda` salen de la navegación: no están en el contrato de
 * rutas y la segunda anunciaba una tienda que no existe. El contenido de
 * `/experiencia` —el día en SIEMBRA— vive ahora dentro de `/comunidad`, que es
 * su sitio natural.
 */
export const NAV_PRINCIPAL: NavItem[] = [
  { href: "/", es: "Inicio", en: "Home" },
  { href: "/menu", es: "Menú", en: "Menu" },
  { href: "/nosotros", es: "Nuestra historia", en: "Our story" },
  { href: "/comunidad", es: "Comunidad", en: "Community" },
  { href: "/gift-cards", es: "Gift Cards", en: "Gift Cards" },
  { href: "/visitanos", es: "Contacto", en: "Contact" },
];

/**
 * Bottom nav móvil, para las pantallas de cuenta.
 *
 * Solo se muestra con sesión: sin ella, tres de los cinco destinos rebotarían
 * al login y la barra sería una trampa.
 *
 * Los destinos salen de `05-cuenta-movil-reference.png` —Inicio, Puntos, Tienda
 * y Perfil— más Wallet, que la referencia no lleva. Se añade a propósito: ahí
 * viven el crédito y las gift cards, y dejarlos a dos toques de distancia
 * escondería lo único de la cuenta que mueve dinero.
 *
 * Sustituye a la barra del mockup 02 (Inicio · Menú · Wallet · Comunidad ·
 * Perfil), que estuvo declarada aquí desde la Fase 5 sin que la pintara nadie.
 */
export const NAV_MOVIL: NavItem[] = [
  { href: "/", es: "Inicio", en: "Home" },
  { href: "/puntos", es: "Puntos", en: "Points" },
  { href: "/tienda", es: "Tienda", en: "Shop" },
  { href: "/wallet", es: "Wallet", en: "Wallet" },
  { href: "/perfil", es: "Perfil", en: "Profile" },
];
