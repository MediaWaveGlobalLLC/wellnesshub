"use client";

import { useEffect, useState } from "react";

import { crearClienteNavegador } from "@/lib/supabase/client";
import { supabaseConfigurado } from "@/lib/supabase/env";

/**
 * ¿Hay sesión abierta?
 *
 * Se resuelve en el navegador y NO en el layout raíz, a propósito: leer la
 * sesión ahí obligaría a renderizar dinámicamente todas las páginas, y hoy
 * `/menu`, `/nosotros`, `/registro` o `/visitanos` se sirven estáticas.
 *
 * Devuelve `null` mientras no se sabe. Quien lo consume decide qué hacer con esa
 * duda, y las dos superficies que lo usan hoy la resuelven distinto a propósito:
 *
 *  · el header pinta las entradas de «sin sesión», porque quedarse sin ninguna
 *    puerta a la cuenta es peor que enseñar «Iniciar sesión» un instante de más;
 *  · la barra inferior no se pinta, porque aparecer y desaparecer bajo el pulgar
 *    mueve el contenido justo cuando alguien va a tocarlo.
 */
export function useSesion(): boolean | null {
  /*
    La web pública tiene que funcionar aunque Supabase no esté configurado
    (`src/lib/supabase/env.ts`); sin esa guarda reventarían las superficies que
    lo usan. Se resuelve en el inicializador y no dentro del efecto porque
    `supabaseConfigurado()` lee variables que Next incrusta al compilar: el valor
    es el mismo en servidor y en cliente, así que no hay ni parpadeo ni desajuste
    de hidratación.
  */
  const [hay, setHay] = useState<boolean | null>(() => (supabaseConfigurado() ? null : false));

  useEffect(() => {
    if (!supabaseConfigurado()) return;

    const supabase = crearClienteNavegador();
    let vivo = true;

    supabase.auth.getUser().then(({ data }) => {
      if (vivo) setHay(Boolean(data.user));
    });

    // Entrar o salir tiene que repintar sin recargar la página.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (vivo) setHay(Boolean(sesion));
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return hay;
}
