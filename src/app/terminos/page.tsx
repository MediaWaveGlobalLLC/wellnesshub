import type { Metadata } from "next";
import Link from "next/link";

import { Clausula, DocumentoLegal, Lista } from "@/components/legal/DocumentoLegal";
import { SITE } from "@/lib/site";

/**
 * /terminos — Términos y Condiciones.
 *
 * Describe las reglas que el código ya aplica, no unas distintas. En concreto:
 * puntos y crédito son sistemas separados (D3), las gift cards no caducan
 * (D11), el código canjeado no puede volver a mostrarse porque solo se guarda
 * su hash, y el saldo nunca puede quedar negativo porque la base de datos lo
 * impide. Si alguna de esas reglas cambia, este texto cambia con ella.
 *
 * PENDIENTE: revisión por abogado antes de abrir al público. Ver `docs/13`.
 */
export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description:
    "Condiciones de uso del Club SIEMBRA: cuenta, puntos, crédito en wallet y gift cards.",
};

export default function TerminosPage() {
  return (
    <DocumentoLegal
      eyebrow="Legal"
      titulo="Términos y Condiciones"
      descripcion="Las reglas del Club SIEMBRA, escritas sin letra pequeña."
      actualizado="30 de julio de 2026"
    >
      <Clausula titulo="1. Quiénes somos">
        <p>
          {SITE.name} ({SITE.wellnessHub}) es operado por <strong>{SITE.legal}</strong>, con local en{" "}
          {SITE.address}. Al crear una cuenta aceptas estas condiciones y la{" "}
          <Link href="/privacidad">Política de Privacidad</Link>.
        </p>
      </Clausula>

      <Clausula titulo="2. Tu cuenta">
        <Lista
          items={[
            "Una cuenta por persona, con datos reales. El número de socio identifica tu cuenta en el mostrador.",
            "Eres responsable de tu contraseña y de lo que ocurra con tu sesión abierta.",
            "Si sospechas que alguien accedió a tu cuenta, avísanos y cambia la contraseña.",
            "Puedes cerrar tu cuenta cuando quieras.",
          ]}
        />
      </Clausula>

      <Clausula titulo="3. Puntos de lealtad">
        <p>
          Los puntos son un <strong>reconocimiento, no dinero</strong>. Esta distinción es
          deliberada:
        </p>
        <Lista
          items={[
            "No tienen valor monetario, no se cambian por efectivo y no se transfieren entre cuentas.",
            "Se acumulan con tus compras y se canjean por los premios del catálogo, según disponibilidad.",
            "Tu nivel —semilla, brote, raíz, florecer— se calcula a partir de los puntos acumulados.",
            "Si cierras la cuenta, los puntos se pierden.",
          ]}
        />
      </Clausula>

      <Clausula titulo="4. Crédito en tu wallet">
        <p>
          El crédito sí es dinero: está en dólares estadounidenses y se gasta en el local. Entra en
          tu wallet al canjear una gift card, por una promoción o por un ajuste que hagamos nosotros.
        </p>
        <Lista
          items={[
            "El saldo no caduca mientras tu cuenta siga activa.",
            "No se convierte en efectivo ni se transfiere a otra cuenta.",
            "Cada movimiento queda registrado con su importe, su motivo y su fecha, y puedes consultarlo en tu wallet.",
            <>
              Ese registro <strong>no se edita ni se borra</strong>. Si nos equivocamos, lo
              corregimos con un movimiento nuevo que verás junto al original.
            </>,
            "El saldo nunca puede quedar en negativo: si el importe supera tu crédito, pagas la diferencia por otro medio.",
          ]}
        />
      </Clausula>

      <Clausula titulo="5. Gift cards">
        <Lista
          items={[
            "Se compran desde la web y el cobro lo procesa Stripe. Nosotros no vemos ni guardamos los datos de tu tarjeta.",
            "Puedes elegir uno de los importes propuestos o escribir el tuyo, dentro del mínimo y el máximo que se muestran al comprar.",
            <>
              <strong>No caducan.</strong>
            </>,
            "Al confirmarse el pago, enviamos el código por correo a quien la recibe.",
            "El código es de un solo uso: al canjearlo, su importe pasa íntegro al crédito de la wallet de esa cuenta y el código queda anulado.",
            <>
              Guardamos el código cifrado, así que <strong>no podemos volver a mostrártelo</strong>.
              Si se pierde, podemos reenviar el correo original al mismo destinatario, y nada más.
            </>,
            "Una gift card ya canjeada no se devuelve, y el crédito resultante tampoco se reembolsa en efectivo.",
          ]}
        />
      </Clausula>

      <Clausula titulo="6. Precios y disponibilidad">
        <p>
          Todos los precios están en dólares estadounidenses. La carta puede variar según
          disponibilidad y temporada; el menú publicado es orientativo y el precio válido es el del
          local en el momento de la compra.
        </p>
      </Clausula>

      <Clausula titulo="7. Uso indebido">
        <p>
          Podemos suspender una cuenta si detectamos fraude, suplantación, intentos de duplicar
          crédito o cualquier manipulación del sistema de puntos o gift cards. Si la suspensión
          resulta ser un error nuestro, restituimos el saldo íntegro.
        </p>
      </Clausula>

      <Clausula titulo="8. Responsabilidad">
        <p>
          Hacemos lo posible por mantener el servicio disponible, pero no podemos garantizar que la
          web esté operativa sin interrupciones. Una caída temporal no afecta a tu saldo ni a tus
          puntos: quedan guardados y siguen ahí cuando el servicio vuelve.
        </p>
      </Clausula>

      <Clausula titulo="9. Cambios">
        <p>
          Si modificamos estas condiciones, actualizamos esta página y su fecha. Cuando el cambio
          afecte a tu crédito o a tus puntos, te avisamos por correo antes de que entre en vigor.
        </p>
      </Clausula>

      <Clausula titulo="10. Ley aplicable">
        <p>
          Estas condiciones se rigen por las leyes del Estado Libre Asociado de Puerto Rico, y
          cualquier controversia se somete a sus tribunales.
        </p>
      </Clausula>
    </DocumentoLegal>
  );
}
