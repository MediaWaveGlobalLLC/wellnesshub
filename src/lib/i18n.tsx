"use client";

import { createContext, useContext, useState } from "react";

/*
  i18n minimalista ES/EN — Siembra Cafe
  Español por defecto (idioma principal del negocio).
  Cada texto en site.ts es un objeto { es, en }; el helper `t()` elige.
*/

export type Lang = "es" | "en";

type Localized = { es: string; en: string };

type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Elige la cadena del idioma activo desde un objeto { es, en } */
  t: (obj: Localized | string) => string;
};

const LangContext = createContext<LangContextValue>({
  lang: "es",
  setLang: () => {},
  t: (o) => (typeof o === "string" ? o : o.es),
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer: lee el idioma guardado en el cliente sin setState en effect
  // (patrón recomendado por React 19; evita renders en cascada).
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === "undefined") return "es";
    const saved = localStorage.getItem("siembra-lang");
    return saved === "en" || saved === "es" ? saved : "es";
  });

  const change = (l: Lang) => {
    setLang(l);
    localStorage.setItem("siembra-lang", l);
    document.documentElement.lang = l;
  };

  const t = (obj: Localized | string) =>
    typeof obj === "string" ? obj : obj[lang];

  return (
    <LangContext.Provider value={{ lang, setLang: change, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
