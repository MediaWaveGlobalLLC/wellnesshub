/*
  Encabezado estándar para páginas internas (fondo claro, abre bajo el header fijo).

  Entrada con CSS y sin "use client": el texto se ve aunque no se ejecute nada.
  Antes usaba framer-motion partiendo de opacidad 0, y como esa animación no
  llegaba a correr, los títulos de todas las páginas internas quedaban en blanco.
*/
export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  // Sin orbes difuminados de color: docs/01 prohíbe el glow. La calidez la aporta
  // la textura de grano del fondo.
  return (
    <section className="grain relative overflow-hidden bg-leche pb-12 pt-36 sm:pt-40">
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <p className="entrada entrada-1 text-xs font-bold uppercase tracking-[0.3em] text-terracota">
          {eyebrow}
        </p>
        <h1 className="entrada entrada-2 mt-4 font-display text-5xl font-medium text-espresso sm:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="entrada entrada-3 mx-auto mt-5 max-w-2xl font-serif text-lg italic text-espresso/70 sm:text-xl">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
