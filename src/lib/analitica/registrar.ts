import { SUPABASE_URL } from "@/lib/supabase/env";
import type { Visita } from "./clasificar";

/**
 * Escribir la visita. Lo único que toca la red en toda la fase.
 *
 * Sin el SDK de Supabase: un `fetch` a PostgREST y nada más. Esto corre en el
 * proxy, o sea en CADA petición y en el runtime edge, donde el paquete entero
 * de `@supabase/supabase-js` se cargaría para hacer un POST de dos campos.
 *
 * Por qué `service_role` y no la clave publicable
 * -----------------------------------------------
 * `registrar_visita` está revocada para `anon` (0016). Si estuviera concedida,
 * cualquiera podría llamar al RPC en bucle desde el navegador —la clave
 * publicable viaja ahí— e inflar el contador gratis. La dueña acabaría mirando
 * una gráfica inventada.
 *
 * La clave se lee DENTRO de la función, no en el ámbito del módulo, y el módulo
 * solo lo importa `src/proxy.ts`. Aun así, si algún día alguien lo importara
 * desde un componente de cliente, Next sustituye por `undefined` las variables
 * que no llevan `NEXT_PUBLIC_`: saldría un fallo silencioso, no una clave en el
 * bundle.
 */

/**
 * Un aviso por arranque en frío.
 *
 * Uno, no cero y no uno por petición. Cero fue lo primero que se escribió y
 * costó una tarde: con la clave de servicio vacía en local, esta función salía
 * por la primera línea sin decir nada, la tabla se quedaba a cero y el fallo
 * parecía estar en el clasificador o en `waitUntil`. Una analítica que no cuenta
 * y no lo dice es peor que no tenerla: la pantalla enseña «0 visitas» y eso se
 * lee como «no entró nadie».
 *
 * Uno por petición, en cambio, llenaría los logs a razón de una línea por visita
 * el día que Supabase tenga un mal rato.
 */
let yaAviso = false;

function avisarUnaVez(mensaje: string): void {
  if (yaAviso) return;
  yaAviso = true;
  console.error(`[analitica] ${mensaje} La web sigue sirviéndose con normalidad.`);
}

export async function registrarVisita(visita: Visita): Promise<void> {
  // Sin Supabase configurado no hay web que medir: se calla, como todo lo demás.
  if (!SUPABASE_URL) return;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    avisarUnaVez(
      "falta SUPABASE_SERVICE_ROLE_KEY, así que NO se está contando ninguna visita."
    );
    return;
  }

  try {
    const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_visita`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // No hace falta el resultado: la función devuelve un booleano que solo
        // usan los tests. Sin cuerpo de respuesta que leer, la invocación
        // termina antes.
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ p_ruta: visita.ruta, p_origen: visita.origen }),
      // Tope duro. Esto vive dentro de `waitUntil`, que mantiene viva la
      // invocación hasta que la promesa termina: sin límite, un Supabase que no
      // contesta dejaría funciones colgadas 30 segundos, y se pagan.
      signal: AbortSignal.timeout(2000),
    });

    if (!respuesta.ok) {
      avisarUnaVez(`el registro de visitas responde ${respuesta.status}.`);
    }
  } catch (causa) {
    /*
      El error se avisa, pero NO se propaga.

      Una analítica caída no puede tumbar el sitio ni añadir latencia: se pierde
      la visita y ya está, es un contador y no un movimiento de dinero. Lo que sí
      tiene que hacer es dejar constancia una vez, porque desde aquí un corte de
      red y un fallo de configuración se parecen mucho y la diferencia solo la
      dice el mensaje.
    */
    avisarUnaVez(`no se pudo registrar la visita: ${(causa as Error)?.message ?? causa}.`);
  }
}
