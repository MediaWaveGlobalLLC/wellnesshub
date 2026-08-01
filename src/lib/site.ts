/*
  ─────────────────────────────────────────────
  SIEMBRA CAFE · Datos reales del negocio
  Fuentes: Brand Book, deck "The Wellness Hub at Escambrón",
  menú oficial (PDF del link de Instagram), bio de Instagram.
  CERO contenido inventado.
  ─────────────────────────────────────────────
*/

export const SITE = {
  name: "Siembra Cafe",
  tagline: { es: "Wellness Hub | Coffee & Matcha Bar", en: "Wellness Hub | Coffee & Matcha Bar" },
  address: "1024 Ashford Avenue, Condado, San Juan, Puerto Rico",
  phone: "(939) 835-0044",
  hours: "10:00 AM – 7:00 PM",
  instagram: "@thewellnesshubpr",
  instagramUrl: "https://www.instagram.com/thewellnesshubpr/",
  mapsUrl: "https://maps.app.goo.gl/fX6koRezmfwqy8ue8",
  ceo: "Erika Beatriz Ramón",
  legal: "Veinte de Diez LLC",
  wellnessHub: "The Wellness Hub",
};

/* Manifiesto oficial — Brand Book pág. 1 */
export const MANIFIESTO = {
  completo: {
    es: "Las mejores cosas se siembran con intención. Un buen día comienza con una taza de café, pero florece con hábitos, comunidad y momentos que nutren el cuerpo y el alma.",
    en: "The best things are sown with intention. A good day begins with a cup of coffee, but it blossoms with habits, community and moments that nourish body and soul.",
  },
  corto: {
    es: "Siembra bienestar. Cosecha tu mejor versión.",
    en: "Sow wellbeing. Harvest your best version.",
  },
};

/* Voz de marca oficial — Brand Book pág. 2 */
export const VOZ_MARCA = {
  es: "Siembra habla con calma. Inspira sin imponer. Invita a detenerse, respirar y reconectar con uno mismo. Su voz es cercana, optimista y auténtica; transmite bienestar, comunidad y equilibrio a través de una estética cálida y minimalista.",
  en: "Siembra speaks calmly. It inspires without imposing. It invites you to pause, breathe and reconnect with yourself. Its voice is warm, optimistic and authentic — conveying wellbeing, community and balance through a warm, minimalist aesthetic.",
};

/* Atributos oficiales — Brand Book (píldoras) */
export const ATRIBUTOS = [
  { es: "Natural", en: "Natural" },
  { es: "Auténtica", en: "Authentic" },
  { es: "Tropical", en: "Tropical" },
  { es: "Bienestar", en: "Wellness" },
  { es: "Revitalizante", en: "Revitalizing" },
  { es: "Premium", en: "Premium" },
];

/* Pilares oficiales — pie del menú oficial */
export const PILARES = [
  { es: "Nutre tu cuerpo", en: "Nourish your body" },
  { es: "Fortalece tu bienestar", en: "Strengthen your wellbeing" },
  { es: "Eleva tu comunidad", en: "Elevate your community" },
];

/* Frases de marca verificadas en piezas oficiales (stories, deck, tarjetas) */
export const FRASES = {
  cafe: { es: "Café que te eleva", en: "Coffee that elevates you" },
  matcha: { es: "Clean energy. Pure taste.", en: "Clean energy. Pure taste." },
  comunidad: {
    es: "No construiremos solamente clientes. Construiremos comunidad.",
    en: "We won't just build customers. We'll build community.",
  },
  habitos: { es: "Pequeños hábitos, gran bienestar", en: "Small habits, great wellbeing" },
};

/* Métricas reales — deck pág. 21 */
export const METRICAS = [
  { valor: 300, sufijo: "+", es: "Eventos realizados", en: "Events hosted" },
  { valor: 50, sufijo: "K+", es: "Alcance en redes", en: "Social reach" },
  { valor: 40, sufijo: "+", es: "Alianzas estratégicas", en: "Strategic alliances" },
];

/*
  ─────────────────────────────────────────────
  MENÚ — transcrito del PDF oficial (link de Instagram)
  Precios verificados. "12oz/16oz" = dos tamaños.
  status: "hoy" = disponible hoy · "pronto" = próximamente
  ─────────────────────────────────────────────
*/
export type MenuItem = {
  nombre: string;
  precio: string; // "8.75" o "4.25 / 4.75" (12oz/16oz)
  destacado?: boolean; // ★ en el menú oficial
  nota?: { es: string; en: string };
};

export type MenuSection = {
  id: string;
  titulo: { es: string; en: string };
  mundo: "cafe" | "matcha" | "piel" | "comida";
  status: "hoy" | "pronto";
  sizes?: string; // "12 oz / 16 oz"
  items: MenuItem[];
};

export const MENU: MenuSection[] = [
  {
    id: "matcha",
    titulo: { es: "Barra de Matcha", en: "Matcha Bar" },
    mundo: "matcha",
    status: "hoy",
    sizes: "16 oz",
    items: [
      { nombre: "Matcha Clásico", precio: "8.75" },
      { nombre: "Fresa Glow", precio: "8.95" },
      { nombre: "Mango Radiance", precio: "8.95", destacado: true },
      { nombre: "Plátano Mellow", precio: "8.95" },
      { nombre: "Matcha Refrescante", precio: "8.75" },
    ],
  },
  {
    id: "cafes",
    titulo: { es: "Cafés Calientes y Fríos", en: "Hot & Cold Coffees" },
    mundo: "cafe",
    status: "hoy",
    items: [
      { nombre: "Espresso", precio: "2.75" },
      { nombre: "Cortado", precio: "3.75" },
      { nombre: "Americano", precio: "4.25 / 4.75" },
      { nombre: "Latte", precio: "6.25 / 7.25" },
      { nombre: "Extra Shot", precio: "1.50" },
    ],
  },
  {
    id: "piel",
    titulo: { es: "Bebidas para tu Piel", en: "Drinks for your Skin" },
    mundo: "piel",
    status: "hoy",
    sizes: "16 oz",
    items: [
      { nombre: "Glow Rose", precio: "9.95", nota: { es: "Mezcla Glow", en: "Glow Blend" } },
      { nombre: "Tropical Sun", precio: "9.95", nota: { es: "Energía Tropical", en: "Tropical Energy" } },
      { nombre: "Blue Calm", precio: "9.95", nota: { es: "Recuperación", en: "Recovery" } },
    ],
  },
  {
    id: "pasteleria",
    titulo: { es: "Pastelería", en: "Pastries" },
    mundo: "comida",
    status: "hoy",
    items: [
      { nombre: "Donut de Azúcar", precio: "1.95" },
      { nombre: "Donut de Queso", precio: "2.95" },
    ],
  },
  {
    id: "sandwiches",
    titulo: { es: "Sándwiches", en: "Sandwiches" },
    mundo: "comida",
    status: "hoy",
    items: [{ nombre: "Sandwich Mallorca", precio: "9.00" }],
  },
  {
    id: "frios",
    titulo: { es: "Favoritos Fríos", en: "Cold Favorites" },
    mundo: "cafe",
    status: "pronto",
    sizes: "12 oz / 16 oz",
    items: [
      { nombre: "Iced Latte", precio: "7.25 / 7.95", destacado: true },
      { nombre: "Latte con Sabor", precio: "7.75 / 8.25" },
      { nombre: "Iced Chai Latte", precio: "7.25 / 8.25" },
    ],
  },
  {
    id: "extras",
    titulo: { es: "Extras", en: "Extras" },
    mundo: "piel",
    status: "pronto",
    sizes: "+ $1.00",
    items: [
      { nombre: "Colágeno Péptidos", precio: "1.00" },
      { nombre: "Ácido Hialurónico", precio: "1.00" },
      { nombre: "Espirulina", precio: "1.00" },
      { nombre: "Creatina", precio: "1.00" },
      { nombre: "Matcha", precio: "1.00" },
      { nombre: "Semillas de Chía", precio: "1.00" },
    ],
  },
  {
    id: "pizzas",
    titulo: { es: "Pizzas Personales", en: "Personal Pizzas" },
    mundo: "comida",
    status: "pronto",
    items: [
      { nombre: "Queso", precio: "4.00" },
      { nombre: "Veggie", precio: "4.50" },
      { nombre: "Pepperoni", precio: "4.25" },
    ],
  },
  {
    id: "llevar",
    titulo: { es: "Para Llevar", en: "To Go" },
    mundo: "comida",
    status: "pronto",
    items: [
      { nombre: "Yogurt Parfait", precio: "7.50" },
      { nombre: "Pudín de Chía con Matcha", precio: "8.95" },
    ],
  },
];

/*
  ─────────────────────────────────────────────
  LA EXPERIENCIA — timeline diaria real (deck pág. 10)
  ─────────────────────────────────────────────
*/
export const EXPERIENCIA_DIA = [
  { hora: "6:00 AM", es: "Yoga al Amanecer", en: "Sunrise Yoga", descEs: "Movimiento consciente frente al mar", descEn: "Mindful movement by the sea" },
  { hora: "7:00 AM", es: "Café y Desayuno", en: "Coffee & Breakfast", descEs: "Café, matcha, smoothies y grab & go con Siembra", descEn: "Coffee, matcha, smoothies & grab-and-go by Siembra" },
  { hora: "8:00 AM", es: "Club de Running", en: "Running Club", descEs: "Ruta comunitaria por Escambrón", descEn: "Community route through Escambrón" },
  { hora: "12:00 PM", es: "Almuerzo", en: "Lunch", descEs: "Almuerzo y experiencias para visitantes", descEn: "Lunch & experiences for visitors" },
  { hora: "5:00 PM", es: "Bienestar al Atardecer", en: "Sunset Wellness", descEs: "Meditación, breathwork o sound healing", descEn: "Meditation, breathwork or sound healing" },
];

/* Wellness Program — deck pág. 12 */
export const WELLNESS_PROGRAM = [
  { es: "Respiración consciente", en: "Conscious breathing" },
  { es: "Sanación con sonido", en: "Sound healing" },
  { es: "Estiramiento", en: "Stretching" },
  { es: "Charlas de nutrición", en: "Nutrition talks" },
  { es: "Movilidad matutina", en: "Morning mobility" },
  { es: "Yoga", en: "Yoga" },
  { es: "Pilates", en: "Pilates" },
  { es: "Meditación", en: "Meditation" },
  { es: "Recuperación", en: "Recovery" },
];

/* Sports Program — deck pág. 13 */
export const SPORTS_PROGRAM = [
  { es: "Natación", en: "Swimming" },
  { es: "Grupos de ciclismo", en: "Cycling groups" },
  { es: "Club de running", en: "Running club" },
  { es: "Natación en aguas abiertas", en: "Open water swimming" },
  { es: "Voleibol de playa", en: "Beach volleyball" },
  { es: "Tenis de playa", en: "Beach tennis" },
  { es: "Pop-ups de pádel", en: "Pádel pop-ups" },
  { es: "Pop-ups de pickleball", en: "Pickleball pop-ups" },
  { es: "Triatlón", en: "Triathlon" },
];

/* Calendario anual — deck pág. 14 */
export const CALENDARIO = [
  { mes: { es: "Enero", en: "January" }, evento: { es: "Taller de Hábitos Saludables", en: "Healthy Habits Workshop" } },
  { mes: { es: "Febrero", en: "February" }, evento: { es: "Yoga en Pareja", en: "Partner Yoga" } },
  { mes: { es: "Marzo", en: "March" }, evento: { es: "Limpieza de Playa", en: "Beach Cleanup" } },
  { mes: { es: "Abril", en: "April" }, evento: { es: "Festival de Yoga", en: "Yoga Festival" } },
  { mes: { es: "Mayo", en: "May" }, evento: { es: "Mercado de Bienestar", en: "Wellness Market" } },
  { mes: { es: "Junio", en: "June" }, evento: { es: "Apertura de Verano", en: "Summer Opening" } },
  { mes: { es: "Julio", en: "July" }, evento: { es: "Bienestar Familiar", en: "Family Wellness" } },
  { mes: { es: "Agosto", en: "August" }, evento: { es: "Celebración al Atardecer", en: "Sunset Celebration" } },
  { mes: { es: "Septiembre", en: "September" }, evento: { es: "Seminarios de Nutrición", en: "Nutrition Seminars" } },
  { mes: { es: "Octubre", en: "October" }, evento: { es: "Taller de la Gratitud", en: "Gratitude Workshop" } },
  { mes: { es: "Noviembre", en: "November" }, evento: { es: "Festival de Matcha y Café", en: "Matcha & Coffee Festival" } },
  { mes: { es: "Diciembre", en: "December" }, evento: { es: "Mercado de Bienestar", en: "Wellness Market" } },
];

/* Compromiso ambiental — deck pág. 18 */
export const AMBIENTAL = [
  { es: "Limpiezas de playa", en: "Beach cleanups" },
  { es: "Iniciativas contra el sargazo", en: "Sargassum initiatives" },
  { es: "Reciclaje", en: "Recycling" },
  { es: "Reducción de plásticos", en: "Plastic reduction" },
  { es: "Programas reusables", en: "Reusable programs" },
  { es: "Educación ambiental", en: "Environmental education" },
];

/*
  ─────────────────────────────────────────────
  CLUB SIEMBRA — beneficios oficiales (Brand Book pág. 6)
  + oferta real del menú oficial (flyer)
  ─────────────────────────────────────────────
*/
export const CLUB_BENEFICIOS = [
  {
    titulo: { es: "Programa de Lealtad", en: "Loyalty Program" },
    desc: {
      es: "Acumula puntos con cada compra y canjéalos por productos, experiencias y beneficios exclusivos.",
      en: "Earn points with every purchase and redeem them for products, experiences and exclusive perks.",
    },
  },
  {
    titulo: { es: "Mayor Conexión con la Comunidad", en: "Deeper Community Connection" },
    desc: {
      es: "Un espacio digital para mantenerte cerca de la marca, conocer novedades y participar en experiencias especiales.",
      en: "A digital space to stay close to the brand, discover what's new and join special experiences.",
    },
  },
  {
    titulo: { es: "Experiencia Personalizada", en: "Personalized Experience" },
    desc: {
      es: "Recomendaciones, promociones y recompensas adaptadas a tu comportamiento y preferencias.",
      en: "Recommendations, promotions and rewards tailored to your behavior and preferences.",
    },
  },
  {
    titulo: { es: "Fidelización de Clientes", en: "Customer Loyalty" },
    desc: {
      es: "Visitas recurrentes premiadas mediante un sistema de recompensas que valora tu interacción constante.",
      en: "Recurring visits rewarded through a system that values your constant engagement.",
    },
  },
  {
    titulo: { es: "Beneficios Exclusivos", en: "Exclusive Benefits" },
    desc: {
      es: "Acceso a promociones especiales, lanzamientos, eventos y productos solo para miembros.",
      en: "Access to special promotions, launches, events and members-only products.",
    },
  },
];

/*
  Oferta que anuncia la barra superior de la home.

  ATENCIÓN A QUIEN VENGA DETRÁS: esto YA NO SALE DEL FLYER. El flyer oficial del
  menú decía «Café gratis 1 vez al mes o 10% de descuento», y la dueña lo
  cambió a la promoción de bienvenida el 30 de julio de 2026. No es una
  desviación del material contractual que haya que «restaurar»: es una decisión
  de negocio posterior, y volver al texto del flyer sería anunciar una oferta
  que ya no está en pie.
*/
export const CLUB_OFERTA = {
  es: "Deposita tus primeros $20 y recibe café gratis",
  en: "Deposit your first $20 and get a free coffee",
};
