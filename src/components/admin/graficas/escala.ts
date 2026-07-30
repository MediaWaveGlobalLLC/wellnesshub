/**
 * Matemática de las gráficas.
 *
 * Aquí no hay JSX ni DOM a propósito: son funciones puras que se prueban con
 * números y se leen sin renderizar nada. Los casos que rompen una gráfica
 * —serie vacía, un solo punto, todo ceros, todos los valores iguales— son
 * aritméticos, no visuales, y es donde aparece la división por cero.
 */

export type Punto = { etiqueta: string; valor: number };

/**
 * Convierte un valor del dominio a una coordenada del lienzo.
 *
 * Si el dominio es un único valor —todas las barras iguales, o una serie de un
 * solo día— la diferencia es cero y dividir daría `Infinity`. En ese caso se
 * devuelve el punto medio: una línea plana centrada, que es exactamente lo que
 * los datos dicen.
 */
export function escalaLineal(
  valor: number,
  dominio: [number, number],
  rango: [number, number]
): number {
  const [d0, d1] = dominio;
  const [r0, r1] = rango;
  if (d1 === d0) return (r0 + r1) / 2;
  return r0 + ((valor - d0) / (d1 - d0)) * (r1 - r0);
}

/**
 * Techo "bonito" para el eje: 1, 2, 5 ó 10 por la potencia de diez que toque.
 *
 * Sin esto el eje diría 8.437 y las marcas caerían en 2.812,33. Se redondea
 * hacia arriba para que la barra más alta no toque el borde.
 */
export function techoBonito(maximo: number): number {
  if (maximo <= 0) return 1;
  const magnitud = 10 ** Math.floor(Math.log10(maximo));
  const normalizado = maximo / magnitud;
  const paso = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10;
  return paso * magnitud;
}

/**
 * Marcas del eje vertical, de 0 al techo.
 *
 * Devuelve entre 2 y 5 valores. Ni uno —no habría referencia— ni catorce, que
 * convierten el fondo en una rejilla ilegible.
 */
export function ticks(maximo: number, cuantos = 4): number[] {
  const techo = techoBonito(maximo);
  const n = Math.max(2, Math.min(cuantos, 5));
  return Array.from({ length: n + 1 }, (_, i) => (techo / n) * i);
}

/** Geometría del lienzo. Las unidades son del `viewBox`, no píxeles. */
export type Lienzo = {
  ancho: number;
  alto: number;
  /** Espacio para las marcas del eje. */
  margenIzq: number;
  margenSup: number;
  margenInf: number;
};

export const LIENZO: Lienzo = {
  ancho: 720,
  alto: 240,
  margenIzq: 44,
  margenSup: 12,
  margenInf: 8,
};

/** Área útil, ya descontados los márgenes. */
export function area(l: Lienzo = LIENZO) {
  return {
    x0: l.margenIzq,
    x1: l.ancho,
    y0: l.margenSup,
    y1: l.alto - l.margenInf,
  };
}

/**
 * Puntos de una polilínea, ya en coordenadas del lienzo.
 *
 * Con un solo punto devuelve dos coordenadas iguales: un `<polyline>` de un
 * punto no dibuja nada, y una raya corta dice «hay un dato» mejor que un lienzo
 * en blanco.
 */
export function puntosPolilinea(
  serie: Punto[],
  maximo: number,
  l: Lienzo = LIENZO
): [number, number][] {
  if (serie.length === 0) return [];

  const { x0, x1, y0, y1 } = area(l);
  const techo = techoBonito(maximo);

  if (serie.length === 1) {
    const y = escalaLineal(serie[0]!.valor, [0, techo], [y1, y0]);
    return [
      [x0, y],
      [x1, y],
    ];
  }

  return serie.map((p, i) => [
    x0 + (i / (serie.length - 1)) * (x1 - x0),
    escalaLineal(p.valor, [0, techo], [y1, y0]),
  ]);
}

/** Geometría de las barras, repartidas con un hueco proporcional entre ellas. */
export function barras(
  serie: Punto[],
  maximo: number,
  l: Lienzo = LIENZO
): { x: number; y: number; ancho: number; alto: number; punto: Punto }[] {
  if (serie.length === 0) return [];

  const { x0, x1, y0, y1 } = area(l);
  const techo = techoBonito(maximo);
  const paso = (x1 - x0) / serie.length;
  // Barras anchas con poco hueco: la carta se lee mejor que un peine.
  const ancho = Math.max(1, paso * 0.7);

  return serie.map((p, i) => {
    const y = escalaLineal(p.valor, [0, techo], [y1, y0]);
    return {
      x: x0 + i * paso + (paso - ancho) / 2,
      y,
      ancho,
      // Nunca negativo: un valor de 0 da altura 0, no una barra invertida.
      alto: Math.max(0, y1 - y),
      punto: p,
    };
  });
}

/** Máximo de la serie. Cero si está vacía, para que nada divida por cero. */
export function maximoDe(serie: Punto[]): number {
  return serie.reduce((m, p) => Math.max(m, p.valor), 0);
}

/**
 * Variación respecto al periodo anterior, en porcentaje.
 *
 * Devuelve `null` cuando el periodo anterior fue cero: «subió un infinito por
 * ciento» no es información. La pantalla dirá «sin comparación» en su lugar.
 */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}
