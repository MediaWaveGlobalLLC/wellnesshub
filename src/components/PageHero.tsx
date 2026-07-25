"use client";

import { motion } from "framer-motion";

/* Encabezado estándar para páginas internas (fondo claro, abre bajo el header fijo) */
export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="grain relative overflow-hidden bg-leche pb-12 pt-36 sm:pt-40">
      <div className="pointer-events-none absolute -right-20 top-20 h-72 w-72 rounded-full bg-teatree/30 blur-[90px]" />
      <div className="pointer-events-none absolute -left-20 top-40 h-64 w-64 rounded-full bg-mustard/20 blur-[90px]" />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-xs font-bold uppercase tracking-[0.3em] text-terracota"
        >
          {eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7 }}
          className="mt-4 font-display text-5xl font-medium text-espresso sm:text-6xl"
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="mx-auto mt-5 max-w-2xl font-serif text-lg italic text-espresso/70 sm:text-xl"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </section>
  );
}
