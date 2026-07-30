/**
 * Tipos y formato del catálogo.
 *
 * Sin `server-only` a propósito: el carrito y los selectores de tamaño van a
 * ser componentes de cliente y necesitan estos tipos y estas funciones. Aquí no
 * hay ninguna consulta ni ningún secreto, solo formas y aritmética.
 */

export type Mundo = "cafe" | "matcha" | "piel" | "comida";
export type EstadoCategoria = "hoy" | "pronto";

export type VarianteCatalogo = {
  id: string;
  /** "12 oz" · "16 oz" · null cuando el producto tiene un solo tamaño. */
  etiqueta: string | null;
  precioCents: number;
};

export type ProductoCatalogo = {
  id: string;
  /** Igual a `slugDeItem(nombre)`. Es lo que guarda `favorites.item_slug`. */
  slug: string;
  nombre: string;
  nota: string | null;
  destacado: boolean;
  disponible: boolean;
  esModificador: boolean;
  variantes: VarianteCatalogo[];
};

export type CategoriaCatalogo = {
  id: string;
  slug: string;
  nombre: string;
  mundo: Mundo;
  estado: EstadoCategoria;
  /** Rótulo junto al título: "16 oz", "+ $1.00". Decorativo. */
  etiquetaTamanos: string | null;
  productos: ProductoCatalogo[];
};

/**
 * Centavos → "8.75". Sin símbolo de moneda: la carta ya pinta el suyo.
 *
 * No usa `Intl` a propósito. `formatearDolares` de `loyalty.ts` devuelve
 * "$8.75" con el símbolo, y aquí hace falta el número pelado para poder
 * escribir "4.25 / 4.75" con una sola barra en medio.
 */
export function precioLegible(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

/**
 * Precio que se muestra en la carta: "8.75" o "4.25 / 4.75".
 *
 * Reproduce exactamente la cadena que antes estaba escrita a mano en
 * `site.ts`, para que /menu no cambie de aspecto al leer de la base de datos.
 */
export function precioDeCarta(variantes: VarianteCatalogo[]): string {
  return variantes.map((v) => precioLegible(v.precioCents)).join(" / ");
}

/** Variante más barata. Es la que se preselecciona al añadir al carrito. */
export function varianteBase(producto: ProductoCatalogo): VarianteCatalogo | null {
  if (producto.variantes.length === 0) return null;
  return producto.variantes.reduce((min, v) => (v.precioCents < min.precioCents ? v : min));
}

/**
 * Nombre completo de una línea de pedido: "Latte (16 oz)".
 *
 * Con un solo tamaño no añade paréntesis vacíos, que es la clase de detalle que
 * acaba saliendo impreso en la comanda del local.
 */
export function nombreDeLinea(producto: ProductoCatalogo, variante: VarianteCatalogo): string {
  return variante.etiqueta ? `${producto.nombre} (${variante.etiqueta})` : producto.nombre;
}
