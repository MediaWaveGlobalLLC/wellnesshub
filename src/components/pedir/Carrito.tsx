"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert, Card } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { CheckIcon, MasIcon, PapeleraIcon } from "@/components/icons";
import { crearPedido, pagarConSaldo, pagarConTarjeta } from "@/lib/pedidos/acciones";
import {
  precioLegible,
  type CategoriaCatalogo,
  type LineaPedido,
  type VarianteCatalogo,
} from "@/lib/catalogo/tipos";
import { formatearDolares } from "@/lib/loyalty";
import { cn } from "@/lib/cn";

/**
 * Carrito y pago — fase 3.
 *
 * El total que se pinta aquí es una CORTESÍA: sirve para que nadie pida a
 * ciegas. El que vale es el que calcula `crear_pedido` leyendo el catálogo en
 * el servidor (`CLAUDE.md` §5). Si alguien manipulara este, el pedido seguiría
 * costando lo que cuesta.
 */

/*
  Los porcentajes que se ofrecen.

  Cuatro botones y uno de cantidad libre. El primero es «Sin propina» y va
  seleccionado de salida: la propina se ofrece, no se da por supuesta, y un
  preseleccionado del 15% cobra de más a quien no lea.
*/
const PROPINAS: { pct: number | null; etiqueta: string }[] = [
  { pct: 0, etiqueta: "Sin propina" },
  { pct: 10, etiqueta: "10%" },
  { pct: 15, etiqueta: "15%" },
  { pct: 20, etiqueta: "20%" },
  { pct: null, etiqueta: "Otra" },
];

type Fase =
  | { paso: "eligiendo" }
  | { paso: "pagando"; orderId: string; orderNumber: string; totalCents: number }
  | { paso: "listo"; orderNumber: string; saldoRestante: number; puntos: number };

export function Carrito({
  categorias,
  saldoCents,
  precargadas = [],
}: {
  categorias: CategoriaCatalogo[];
  saldoCents: number;
  /**
   * Líneas con las que arranca el carrito: lo que venía en `?anadir=` desde
   * favoritos, ya resuelto contra el catálogo en el servidor.
   *
   * Solo se leen AL MONTAR, y basta: el único sitio que enlaza con `?anadir=`
   * es `/perfil/favoritos`, que es otra ruta, así que llegar aquí siempre monta
   * el componente de cero. Si algún día se enlaza con `?anadir=` desde la
   * propia `/pedir`, esto dejará de añadir nada y habrá que fusionarlas.
   */
  precargadas?: LineaPedido[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [lineas, setLineas] = useState<LineaPedido[]>(precargadas);
  const [error, setError] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>({ paso: "eligiendo" });

  /** Uno por intento de envío: un doble toque no crea dos pedidos. */
  const intento = useRef<string | null>(null);

  /*
    Confirmación de que el toque entró.

    En móvil el resumen del pedido vive DEBAJO de toda la carta, fuera de
    pantalla: tocabas un precio y no pasaba nada visible. La gente lo tocaba
    tres veces creyendo que fallaba y acababa con tres unidades sin saberlo.
    Esto guarda la última variante añadida para marcarla un segundo.
  */
  const [ultimoTocado, setUltimoTocado] = useState<string | null>(null);
  const resumenRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!ultimoTocado) return;
    const t = setTimeout(() => setUltimoTocado(null), 1200);
    return () => clearTimeout(t);
  }, [ultimoTocado]);

  const unidades = useMemo(
    () => lineas.reduce((s, l) => s + l.cantidad, 0),
    [lineas]
  );

  const subtotal = useMemo(
    () => lineas.reduce((s, l) => s + l.precioCents * l.cantidad, 0),
    [lineas]
  );

  /*
    Propina — `0026_propina.sql`.

    Se guarda el PORCENTAJE elegido, no los centavos, para que la propina siga
    al subtotal cuando alguien añade otro café después de haberla elegido. Si se
    guardaran los centavos, un 15% de $8.95 se quedaría congelado en $1.34
    aunque el pedido acabara en $30.

    `null` es «cantidad a mano»: entonces manda `propinaManual`.
  */
  const [propinaPct, setPropinaPct] = useState<number | null>(0);
  const [propinaManual, setPropinaManual] = useState(0);
  const [propinaTexto, setPropinaTexto] = useState("");

  const propina = useMemo(() => {
    if (propinaPct === null) return propinaManual;
    // Al centavo más cercano. El servidor cobra ESTE número, no el porcentaje.
    return Math.round((subtotal * propinaPct) / 100);
  }, [propinaPct, propinaManual, subtotal]);

  const total = subtotal + propina;

  const alcanzaElSaldo = total > 0 && saldoCents >= total;

  /** Tope de $100, el mismo que la acción y el mismo que SQL. */
  function fijarPropinaManual(texto: string) {
    setPropinaTexto(texto);
    // Coma o punto: en Puerto Rico se escriben las dos.
    const dolares = Number.parseFloat(texto.replace(",", "."));
    if (!Number.isFinite(dolares) || dolares < 0) {
      setPropinaManual(0);
      return;
    }
    setPropinaManual(Math.min(10000, Math.round(dolares * 100)));
  }

  function anadir(
    producto: { id: string; nombre: string },
    variante: VarianteCatalogo
  ) {
    setError(null);
    setUltimoTocado(variante.id);
    setLineas((previas) => {
      const i = previas.findIndex((l) => l.varianteId === variante.id);
      if (i >= 0) {
        const copia = [...previas];
        // Tope por línea: el mismo que acepta la base.
        copia[i] = { ...copia[i]!, cantidad: Math.min(20, copia[i]!.cantidad + 1) };
        return copia;
      }
      return [
        ...previas,
        {
          varianteId: variante.id,
          productoId: producto.id,
          nombre: producto.nombre,
          etiqueta: variante.etiqueta,
          precioCents: variante.precioCents,
          cantidad: 1,
        },
      ];
    });
  }

  function cambiar(varianteId: string, delta: number) {
    setLineas((previas) =>
      previas
        .map((l) =>
          l.varianteId === varianteId
            ? { ...l, cantidad: Math.min(20, Math.max(0, l.cantidad + delta)) }
            : l
        )
        .filter((l) => l.cantidad > 0)
    );
  }

  function confirmar() {
    const idIntento = (intento.current ??= crypto.randomUUID());
    setError(null);

    iniciar(async () => {
      const r = await crearPedido({
        items: lineas.map((l) => ({ varianteId: l.varianteId, cantidad: l.cantidad })),
        clientRequestId: idIntento,
        propinaCents: propina,
      });

      if (!r.ok) {
        setError(r.error);
        return;
      }
      setFase({
        paso: "pagando",
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        totalCents: r.totalCents,
      });
    });
  }

  function pagar(modo: "saldo" | "tarjeta") {
    if (fase.paso !== "pagando") return;
    const orderId = fase.orderId;
    setError(null);

    iniciar(async () => {
      const r = modo === "saldo"
        ? await pagarConSaldo({ orderId })
        : await pagarConTarjeta({ orderId });

      if (!r.ok) {
        setError(r.error);
        return;
      }

      if (r.modo === "stripe") {
        // Fuera de la app: el pedido no se cierra hasta que Stripe avise.
        window.location.href = r.checkoutUrl;
        return;
      }

      setFase({
        paso: "listo",
        orderNumber: r.orderNumber,
        saldoRestante: r.saldoRestante,
        puntos: r.puntos,
      });
      setLineas([]);
      intento.current = crypto.randomUUID();
      router.refresh();
    });
  }

  if (fase.paso === "listo") {
    return (
      <Alert tono="exito" titulo={`Pedido ${fase.orderNumber} confirmado`}>
        <p>
          Pásate por SIEMBRA Condado y di tu número. Te quedan{" "}
          <strong>{formatearDolares(fase.saldoRestante)}</strong> de saldo
          {fase.puntos > 0 && <> y ganaste <strong>{fase.puntos} puntos</strong></>}.
        </p>
        <button
          type="button"
          onClick={() => setFase({ paso: "eligiendo" })}
          className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] underline underline-offset-4"
        >
          Pedir otra cosa
        </button>
      </Alert>
    );
  }

  return (
    <>
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      {/* ── La carta ─────────────────────────────────────────────────────── */}
      <div className={cn(fase.paso === "pagando" && "pointer-events-none opacity-40")}>
        {categorias.map((c) => {
          const pedibles = c.productos.filter((p) => p.disponible && p.variantes.length > 0);
          if (pedibles.length === 0) return null;

          return (
            <section key={c.id} className="mb-8">
              <h2 className="font-display text-2xl text-espresso">{c.nombre}</h2>

              <ul className="mt-4 divide-y divide-border border-y border-border">
                {pedibles.map((p) => (
                  <li key={p.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {/* Igual que en la carta: sin foto, la fila queda como
                            estaba. Es el caso normal, no la excepción. */}
                        {p.imagen && (
                          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
                            <Image
                              src={p.imagen.src}
                              alt=""
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-display text-lg text-espresso">{p.nombre}</p>
                          {p.nota && <p className="text-sm text-text-muted">{p.nota}</p>}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {p.variantes.map((v) => {
                          const recienTocado = ultimoTocado === v.id;
                          return (
                            <Button
                              key={v.id}
                              type="button"
                              size="md"
                              variant={recienTocado ? "primario" : "secundario"}
                              onClick={() => anadir(p, v)}
                            >
                              {recienTocado ? <CheckIcon size={13} /> : <MasIcon size={13} />}
                              {recienTocado
                                ? "Añadido"
                                : `${v.etiqueta ? `${v.etiqueta} · ` : ""}${precioLegible(v.precioCents)}`}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* ── El carrito ───────────────────────────────────────────────────── */}
      <aside ref={resumenRef} className="lg:sticky lg:top-28 lg:self-start">
        <Card className="p-5">
          <h2 className="font-display text-xl text-espresso">Tu pedido</h2>

          {lineas.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              Todavía no has añadido nada. Toca un precio de la carta para empezar.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border border-t border-border">
              {lineas.map((l) => (
                <li key={l.varianteId} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-sm text-espresso">
                      {l.nombre}
                      {l.etiqueta && (
                        <span className="text-text-muted"> · {l.etiqueta}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm text-espresso">
                      {formatearDolares(l.precioCents * l.cantidad)}
                    </span>
                  </div>

                  {fase.paso === "eligiendo" && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => cambiar(l.varianteId, -1)}
                        aria-label={`Quitar uno de ${l.nombre}`}
                        className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-espresso transition-colors hover:border-terracota"
                      >
                        −
                      </button>
                      <span className="min-w-[1.5rem] text-center text-sm text-espresso">
                        {l.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => cambiar(l.varianteId, 1)}
                        aria-label={`Añadir uno de ${l.nombre}`}
                        className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-espresso transition-colors hover:border-terracota"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => cambiar(l.varianteId, -l.cantidad)}
                        aria-label={`Quitar ${l.nombre} del pedido`}
                        className="ml-auto text-text-muted transition-colors hover:text-danger"
                      >
                        <PapeleraIcon size={15} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {lineas.length > 0 && (
            <>
              <p className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
                <span className="text-sm text-text-muted">Subtotal</span>
                <span className="text-sm text-espresso">{formatearDolares(subtotal)}</span>
              </p>

              {/*
                Propina. Solo mientras se elige: una vez creado el pedido el
                importe ya está cerrado en la fila y cambiar los botones aquí
                daría a entender que todavía se puede tocar.
              */}
              {fase.paso === "eligiendo" && (
                <div className="mt-3">
                  <p className="text-sm text-text-muted">¿Dejas propina?</p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PROPINAS.map((p) => (
                      <button
                        key={p.pct ?? "otra"}
                        type="button"
                        onClick={() => {
                          setPropinaPct(p.pct);
                          if (p.pct !== null) setPropinaTexto("");
                        }}
                        aria-pressed={propinaPct === p.pct}
                        className={cn(
                          "rounded-sm border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                          propinaPct === p.pct
                            ? "border-terracota bg-surface-muted text-terracota"
                            : "border-border text-text-muted hover:border-terracota/50"
                        )}
                      >
                        {p.etiqueta}
                      </button>
                    ))}
                  </div>

                  {propinaPct === null && (
                    <label className="mt-2 flex items-center gap-2 text-sm text-text-muted">
                      <span>$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={propinaTexto}
                        onChange={(e) => fijarPropinaManual(e.target.value)}
                        placeholder="0.00"
                        aria-label="Propina en dólares"
                        className="w-24 rounded-sm border border-border bg-surface px-2 py-1 text-espresso"
                      />
                      <span className="text-xs">Máximo $100</span>
                    </label>
                  )}
                </div>
              )}

              {propina > 0 && (
                <p className="mt-3 flex items-baseline justify-between">
                  <span className="text-sm text-text-muted">Propina</span>
                  <span className="text-sm text-espresso">{formatearDolares(propina)}</span>
                </p>
              )}

              <p className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
                  Total
                </span>
                <span className="font-display text-2xl text-espresso">
                  {formatearDolares(total)}
                </span>
              </p>
            </>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}

          {fase.paso === "eligiendo" ? (
            <div className="mt-5">
              <Button
                type="button"
                cargando={pendiente}
                disabled={lineas.length === 0}
                onClick={confirmar}
                className="w-full justify-center"
              >
                Continuar
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <p className="text-sm leading-relaxed text-text-muted">
                Pedido <strong className="text-espresso">{fase.orderNumber}</strong> ·{" "}
                {formatearDolares(fase.totalCents)}. Elige cómo pagarlo.
              </p>

              <Button
                type="button"
                cargando={pendiente}
                disabled={!alcanzaElSaldo}
                onClick={() => pagar("saldo")}
                className="w-full justify-center"
              >
                {alcanzaElSaldo
                  ? `Pagar con saldo (${formatearDolares(saldoCents)})`
                  : `Saldo insuficiente (${formatearDolares(saldoCents)})`}
              </Button>

              <Button
                type="button"
                variant="secundario"
                cargando={pendiente}
                onClick={() => pagar("tarjeta")}
                className="w-full justify-center"
              >
                Pagar con tarjeta
              </Button>

              <p className="text-xs leading-relaxed text-text-muted">
                El saldo solo sirve si cubre el pedido entero. Si no llega, paga con tarjeta.
              </p>
            </div>
          )}
        </Card>
      </aside>
    </div>

    {/*
      Barra fija con el estado del pedido — SOLO en móvil.

      Es la mitad importante del arreglo. En escritorio el resumen ya está a la
      vista en la columna de al lado; en móvil vive al final de una carta de
      treinta productos, así que sin esto no hay forma de saber que el toque
      entró sin hacer scroll hasta abajo.

      Va por encima de la barra de cuenta, que mide 4.5rem más el hueco de
      gestos del iPhone.
    */}
    {lineas.length > 0 && fase.paso === "eligiendo" && (
      <button
        type="button"
        onClick={() =>
          resumenRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
        }
        className={cn(
          "fixed inset-x-0 z-40 mx-auto flex w-[calc(100%-2.5rem)] max-w-md items-center",
          "justify-between gap-4 rounded-lg bg-espresso px-5 py-3.5 text-surface shadow-soft lg:hidden",
          "bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.75rem)]"
        )}
      >
        <span className="text-sm font-semibold">
          {unidades} {unidades === 1 ? "producto" : "productos"}
        </span>
        <span className="font-display text-lg leading-none">{formatearDolares(total)}</span>
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em]">
          Ver pedido
        </span>
      </button>
    )}
    </>
  );
}
