import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/Surface";
import { EmptyState } from "@/components/states";
import { BarrasHorizontales, GraficaLinea } from "@/components/admin/graficas/Grafica";
import { SelectorRango } from "@/components/admin/SelectorRango";
import { TarjetaMetrica } from "@/components/admin/TarjetaMetrica";
import { variacion } from "@/components/admin/graficas/escala";
import { exigirDuena } from "@/lib/services/admin-service";
import { esRangoValido, RANGOS, type ClaveRango } from "@/lib/services/metricas";
import {
  franjaHoraria,
  NOMBRE_ORIGEN,
  origenVisitas,
  resumenVisitas,
  rutasVisitadas,
  serieVisitas,
} from "@/lib/services/visitas";
import { formatearPuntos } from "@/lib/loyalty";
import { GraficaIcon, LupaIcon, PinIcon, StarIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Visitas · Administración",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NUMERO = (v: number) => formatearPuntos(v);

/**
 * «+34 % respecto a los 30 días anteriores», o la frase honesta cuando no hay
 * con qué comparar.
 *
 * `variacion` devuelve `null` si el periodo anterior fue cero, porque «subió un
 * infinito por ciento» no es información. Aquí se traduce a una frase en vez de
 * enseñar un guion, que se leería como un fallo.
 */
function comparacion(actual: number, anterior: number, dias: number): string {
  const v = variacion(actual, anterior);

  if (v === null) {
    return actual === 0
      ? `Sin visitas tampoco en los ${dias} días anteriores.`
      : `Los ${dias} días anteriores no tuvieron ninguna visita, así que no hay porcentaje que dar.`;
  }

  const signo = v >= 0 ? "+" : "−";
  return `${signo}${Math.abs(Math.round(v))} % respecto a los ${dias} días anteriores (${formatearPuntos(anterior)}).`;
}

/** /admin/visitas — cuánta gente entra, adónde y de dónde viene. Solo la dueña. */
export default async function VisitasPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  if (!(await exigirDuena())) notFound();

  const { rango: pedido } = await searchParams;
  const rango: ClaveRango = esRangoValido(pedido) ? pedido : "30d";

  const [resumen, serie, rutas, origenes] = await Promise.all([
    resumenVisitas(rango),
    serieVisitas(rango),
    rutasVisitadas(rango),
    origenVisitas(rango),
  ]);

  /*
    «De dónde viene la gente» excluye la navegación interna.

    Quien llega desde Instagram y luego pincha en «Menú» genera una segunda
    visita cuyo referente es esta misma web. Contarla como procedencia haría que
    la categoría mayoritaria fuera siempre «la propia web», que no es una
    respuesta a la pregunta.
  */
  const deFuera = origenes.filter((o) => o.origen !== "interno");
  const totalDeFuera = deFuera.reduce((s, o) => s + o.visitas, 0);

  const hayAlgo = resumen.total > 0;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-espresso">Visitas</h1>
          <p className="mt-1 text-sm text-text-muted">
            Cuánta gente entra en la web, qué mira y de dónde llega.
          </p>
        </div>
        <SelectorRango base="/admin/visitas" actual={rango} />
      </div>

      {!hayAlgo ? (
        <Card className="mt-6 p-8">
          <EmptyState
            titulo="Todavía no hay visitas contadas"
            descripcion="La cuenta empieza el día que esto se publica: no hay histórico anterior porque antes no se medía nada. Si acabas de desplegar, dale unas horas."
          />
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TarjetaMetrica
              etiqueta="Visitas"
              valor={formatearPuntos(resumen.total)}
              nota={comparacion(resumen.total, resumen.totalAnterior, RANGOS[rango].dias)}
              serie={serie}
              icono={<GraficaIcon size={18} />}
            />

            <TarjetaMetrica
              etiqueta="Llegadas de fuera"
              valor={formatearPuntos(totalDeFuera)}
              nota="Aperturas cuyo enlace no venía de esta misma web. Es la gente que llega, no la que ya estaba dentro."
              icono={<PinIcon size={18} />}
            />

            <TarjetaMetrica
              etiqueta="Páginas vistas"
              valor={formatearPuntos(resumen.rutas)}
              nota="Páginas distintas que alguien abrió en el periodo."
              icono={<LupaIcon size={18} />}
            />

            <TarjetaMetrica
              etiqueta="Hora punta"
              valor={resumen.horaPunta === null ? "—" : franjaHoraria(resumen.horaPunta)}
              nota="La franja del día con más tráfico, en hora de Puerto Rico. Útil para decidir cuándo publicar."
              icono={<StarIcon size={18} />}
            />
          </div>

          <Card className="mt-5 p-5 sm:p-6">
            <h2 className="font-display text-xl text-espresso">Visitas por periodo</h2>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">
              Cada punto es el total de páginas abiertas en ese periodo. Los días sin visitas se
              dibujan como cero, no desaparecen: un martes flojo tiene que verse como un valle, no
              esfumarse y hacer que la curva parezca continua.
            </p>
            <div className="mt-5">
              <GraficaLinea serie={serie} titulo="Visitas por periodo" formato={NUMERO} />
            </div>
          </Card>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <h2 className="font-display text-xl text-espresso">Páginas más vistas</h2>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">
                Qué está mirando la gente.
              </p>
              <div className="mt-5">
                <BarrasHorizontales
                  serie={rutas}
                  titulo="Páginas más vistas en el periodo"
                  formato={NUMERO}
                />
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="font-display text-xl text-espresso">De dónde llega la gente</h2>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">
                Solo las llegadas de fuera. «Directo» es quien escribió la dirección, la tenía
                guardada o llegó desde una app que no dice de dónde viene.
              </p>
              <div className="mt-5">
                <BarrasHorizontales
                  serie={deFuera.map((o) => ({
                    etiqueta: NOMBRE_ORIGEN[o.origen],
                    valor: o.visitas,
                  }))}
                  titulo="Procedencia del tráfico"
                  formato={NUMERO}
                />
              </div>
            </Card>
          </div>
        </>
      )}

      <Card tono="avena" className="mt-5 p-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-espresso">
          Qué mide esto exactamente
        </p>
        <ul className="mt-2 space-y-2 text-sm leading-relaxed text-espresso/80">
          <li>
            <strong>Visitas, no visitantes.</strong> No se guarda ninguna cookie, ninguna dirección
            IP ni ninguna huella de navegador, así que no hay forma de saber si dos visitas son de
            la misma persona. Por eso aquí no verás «usuarios únicos»: sería un número inventado.
          </li>
          <li>
            <strong>Se cuentan aperturas de página.</strong> Es decir: alguien escribe la dirección,
            pincha un enlace desde fuera, recarga o llega desde Instagram. Moverse por la web una
            vez dentro no vuelve a sumar, porque el sitio cambia de página sin recargar y esas
            peticiones no se distinguen de las que el navegador hace por su cuenta para adelantar
            trabajo. Se prefiere quedarse corto antes que inflar el número con páginas que nadie
            llegó a mirar.
          </li>
          <li>
            <strong>Sin robots.</strong> Se filtran rastreadores, comprobaciones de estado y
            escáneres. Se mira su identificación para descartarlos y no se guarda.
          </li>
          <li>
            <strong>Sin el panel.</strong> Tus propias visitas a esta administración no se cuentan.
          </li>
          <li>
            <strong>No cuadra con Vercel, y está bien.</strong> El panel de Vercel también cuenta
            visitas y siempre dará un número distinto: mide lo que el navegador consigue reportar
            —y se pierde con bloqueadores—, mientras que esto cuenta lo que el servidor sirve.
            Vercel te da país y dispositivo, que aquí no hay; aquí ves a quien bloquea scripts, que
            allí no aparece. No hay que cuadrarlas.
          </li>
        </ul>
      </Card>
    </>
  );
}
