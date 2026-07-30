/**
 * Cálculo de nivel y progreso.
 *
 * Lógica pura, sin base de datos: los umbrales entran como parámetro porque
 * viven en `loyalty_tiers` y el negocio los edita sin desplegar (`docs/04`:
 * "la regla de earning debe estar configurada, no hardcodeada en componentes").
 *
 * Los puntos NO tienen equivalencia monetaria. Aquí solo determinan el nivel.
 */

export type Nivel = {
  key: string;
  label: string;
  minPoints: number;
  sortOrder: number;
  description: string | null;
};

export type ProgresoMembresia = {
  actual: Nivel;
  siguiente: Nivel | null;
  puntos: number;
  /** Puntos que faltan para el siguiente nivel. 0 si ya está en el máximo. */
  faltan: number;
  /** Umbral del siguiente nivel — el mockup muestra "750 / 2.000 pts". */
  meta: number;
  /**
   * 0–1 para la barra, calculada como `puntos / meta`.
   *
   * Deliberadamente NO es el avance dentro del tramo (250/1.500 aquí). La
   * etiqueta que acompaña a la barra dice "750 / 2.000 pts", así que la barra
   * tiene que representar esa misma proporción: si no, el número y el dibujo se
   * contradicen delante del usuario. En el nivel máximo es 1.
   */
  fraccion: number;
};

/**
 * Sitúa un balance de puntos en la escala de niveles.
 *
 * Los niveles llegan en cualquier orden; se ordenan aquí para no depender de
 * que la consulta acierte con el `order by`.
 */
export function calcularProgreso(puntos: number, niveles: Nivel[]): ProgresoMembresia {
  if (niveles.length === 0) {
    throw new Error("No hay niveles configurados en loyalty_tiers.");
  }

  const escala = [...niveles].sort((a, b) => a.minPoints - b.minPoints);
  const saldo = Math.max(0, Math.floor(puntos));

  // El nivel actual es el último cuyo umbral ya se alcanzó.
  let actual = escala[0];
  for (const nivel of escala) {
    if (saldo >= nivel.minPoints) actual = nivel;
    else break;
  }

  const siguiente = escala.find((n) => n.minPoints > saldo) ?? null;

  if (!siguiente) {
    // Nivel máximo: la barra se muestra completa.
    return { actual, siguiente: null, puntos: saldo, faltan: 0, meta: actual.minPoints, fraccion: 1 };
  }

  return {
    actual,
    siguiente,
    puntos: saldo,
    faltan: siguiente.minPoints - saldo,
    meta: siguiente.minPoints,
    // Guardia por si el umbral fuese 0: evita dividir por cero.
    fraccion: siguiente.minPoints > 0 ? Math.min(1, saldo / siguiente.minPoints) : 1,
  };
}

/** Formatea centavos como dólares. El wallet siempre es USD (`0001`). */
export function formatearDolares(centavos: number): string {
  return new Intl.NumberFormat("es-PR", {
    style: "currency",
    currency: "USD",
  }).format(centavos / 100);
}

/** Formatea puntos con separador de millares, como en el mockup 02. */
export function formatearPuntos(puntos: number): string {
  return new Intl.NumberFormat("es-PR").format(puntos);
}
