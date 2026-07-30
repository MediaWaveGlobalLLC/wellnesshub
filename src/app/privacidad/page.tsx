import type { Metadata } from "next";
import Link from "next/link";

import { Clausula, DocumentoLegal, Lista } from "@/components/legal/DocumentoLegal";
import { SITE } from "@/lib/site";

/**
 * /privacidad — Política de Privacidad.
 *
 * Cada dato que se enumera aquí corresponde a una columna real de
 * `supabase/migrations`, y cada tercero es un servicio efectivamente conectado.
 * Si mañana se añade una tabla con datos personales o un procesador nuevo, hay
 * que actualizar esta página: es la única forma de que el documento siga siendo
 * cierto.
 *
 * PENDIENTE: no hay correo de contacto legal. Se usan el teléfono, Instagram y
 * la dirección física, que sí están verificados, antes que inventar un buzón al
 * que nadie respondería. En cuanto exista, se añade a `SITE` y se enlaza aquí.
 *
 * Hay DOS recuentos de visitas y la cláusula 2 los describe por separado, a
 * propósito: el propio (`0016_analitica.sql`), que no guarda nada identificable
 * porque no tiene columna donde ponerlo, y el de Vercel Web Analytics, que
 * recoge país, dispositivo y navegador y deriva un conteo de visitantes con una
 * huella que rota cada 24 horas.
 *
 * Enseñarlos como si fueran lo mismo sería el error: uno promete mucho menos
 * que el otro, y la promesa fuerte no se puede extender a ambos.
 *
 * La cláusula 4 no gana ningún encargado nuevo —Vercel ya alojaba la web— pero
 * sí gana una finalidad, y por eso se dice. La 5 sigue sin banner porque
 * ninguno de los dos usa cookies: si algún día entra una herramienta que sí las
 * use, el banner pasa a ser obligatorio y esa cláusula hay que reescribirla
 * entera.
 */
export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Qué datos recoge SIEMBRA, para qué los usa, con quién los comparte y cómo ejercer tus derechos.",
};

export default function PrivacidadPage() {
  return (
    <DocumentoLegal
      eyebrow="Legal"
      titulo="Política de Privacidad"
      descripcion="Qué guardamos, por qué, y qué puedes pedirnos que hagamos con ello."
      actualizado="30 de julio de 2026"
    >
      <Clausula titulo="1. Quién trata tus datos">
        <p>
          El responsable es <strong>{SITE.legal}</strong>, la sociedad que opera{" "}
          {SITE.name} ({SITE.wellnessHub}) en {SITE.address}. Para cualquier asunto relacionado con
          esta política puedes llamarnos al <strong>{SITE.phone}</strong>, escribirnos por Instagram
          a <a href={SITE.instagramUrl}>{SITE.instagram}</a> o pasar por el local en el horario de
          apertura.
        </p>
      </Clausula>

      <Clausula titulo="2. Qué datos recogemos">
        <p>Solo los que necesitamos para que tu cuenta y tu crédito funcionen:</p>
        <Lista
          items={[
            <>
              <strong>Cuenta:</strong> nombre, apellido, correo electrónico y —si lo añades—
              teléfono. También un número de socio que generamos nosotros.
            </>,
            <>
              <strong>Contraseña:</strong> la gestiona nuestro proveedor de autenticación y se
              guarda cifrada. Ni nosotros ni el personal del local podemos verla.
            </>,
            <>
              <strong>Crédito y puntos:</strong> tu saldo, tus puntos y el historial completo de
              movimientos (importe, tipo, fecha y concepto). Ese historial es inmutable por diseño:
              un movimiento se corrige con otro movimiento, nunca borrando el anterior.
            </>,
            <>
              <strong>Gift cards:</strong> el importe, el correo y el nombre de quien la recibe y el
              mensaje que escribes. El código de la tarjeta se guarda cifrado con una función de un
              solo sentido, así que después de emitirlo <strong>ni nosotros podemos leerlo</strong>.
            </>,
            <>
              <strong>Actividad en la web:</strong> tus bebidas favoritas, las reservas de eventos y
              las direcciones que guardes.
            </>,
            <>
              <strong>Boletín:</strong> tu correo, solo si lo pides expresamente. La casilla de
              marketing del registro viene desmarcada.
            </>,
          ]}
        />
        <p>
          <strong>No recogemos datos de tarjeta.</strong> Los pagos ocurren íntegramente en Stripe;
          el número de tu tarjeta nunca pasa por nuestros servidores.
        </p>
        <p>
          <strong>Contamos las visitas a la web.</strong> Lo hacemos de dos formas, y ninguna de
          las dos deja nada guardado en tu navegador:
        </p>
        <Lista
          items={[
            <>
              <strong>Nuestro propio recuento.</strong> Guardamos tres cosas: qué página se abrió,
              en qué hora del día, y qué tipo de sitio te trajo aquí (por ejemplo «Instagram» o
              «Google», nunca el enlace concreto). Nada más: ni tu dirección IP, ni qué navegador
              usas, ni ningún identificador tuyo, ni siquiera si habías iniciado sesión. Solo
              sumamos uno a un contador, así que <strong>contamos visitas, no visitantes</strong>:
              no podemos saber si dos visitas son de la misma persona.
            </>,
            <>
              <strong>Las estadísticas de Vercel</strong>, la empresa que aloja la web. Estas
              recogen algo más: la página, de dónde llegaste, el país, y el tipo de dispositivo,
              navegador y sistema operativo. Para contar visitantes distintos dentro de un mismo
              día usan una huella derivada de tu petición que <strong>se descarta cada 24 horas</strong>,
              de modo que no permite reconocerte de un día para otro. No guardan tu dirección IP ni
              instalan cookies.
            </>,
          ]}
        />
        <p>
          Ninguno de los dos se relaciona con tu cuenta, ni sirve para reconstruir por qué páginas
          pasaste, ni para perfilarte. Nos valen para saber si la carta se mira más por la mañana o
          por la tarde y desde dónde llega la gente. Las dos cifras no coinciden y no tienen por
          qué: miden cosas distintas.
        </p>
      </Clausula>

      <Clausula titulo="3. Para qué los usamos">
        <Lista
          items={[
            "Crear y mantener tu cuenta, y dejarte entrar en ella.",
            "Llevar la cuenta de tu crédito y tus puntos, y que puedas canjearlos en el local.",
            "Emitir y entregar las gift cards que compras.",
            "Enviarte correos imprescindibles: confirmar tu cuenta, recuperar la contraseña, avisarte de un movimiento.",
            "Enviarte novedades y promociones, únicamente si lo autorizaste. Puedes retirarlo cuando quieras desde tu perfil.",
            "Detectar y frenar fraude o uso abusivo del crédito.",
          ]}
        />
        <p>
          No vendemos tus datos, no los cedemos a anunciantes y no construimos perfiles publicitarios
          con ellos.
        </p>
      </Clausula>

      <Clausula titulo="4. Con quién los compartimos">
        <p>Solo con los proveedores que hacen funcionar el servicio, y solo con lo que necesitan:</p>
        <Lista
          items={[
            <>
              <strong>Supabase</strong> — base de datos y autenticación.
            </>,
            <>
              <strong>Stripe</strong> — cobro de las gift cards. Recibe el importe y el correo del
              comprador.
            </>,
            <>
              <strong>Resend</strong> — envío de los correos del servicio.
            </>,
            <>
              <strong>Vercel</strong> — alojamiento de la web y las estadísticas de audiencia de la
              sección 2.
            </>,
          ]}
        />
        <p>
          Fuera de esto, solo entregaríamos datos si nos lo exigiera una autoridad competente.
        </p>
      </Clausula>

      <Clausula titulo="5. Cookies">
        <p>
          Usamos <strong>una sola cookie</strong>, la que mantiene tu sesión abierta. Es
          imprescindible: sin ella no podrías permanecer identificado. No usamos cookies de
          analítica, de publicidad ni de terceros, y por eso tampoco verás un banner pidiéndote
          permiso para instalarlas.
        </p>
        <p>
          Los dos recuentos de visitas de la sección 2 <strong>funcionan sin cookies</strong> y sin
          guardar nada en tu navegador. El nuestro ocurre entero en el servidor. El de Vercel sí
          carga un pequeño script en la página, pero tampoco escribe nada en tu equipo, y no es un
          anunciante ni comparte esos datos con nadie: es la misma empresa que ya aloja la web.
        </p>
      </Clausula>

      <Clausula titulo="6. Cuánto tiempo los guardamos">
        <p>
          Los datos de tu cuenta, mientras la cuenta exista. Si la cierras, se eliminan tu perfil,
          tus favoritos, tus reservas y tus direcciones.
        </p>
        <p>
          Los contadores de visitas se borran a los 400 días. No hace falta pedir su eliminación
          porque no hay nada tuyo dentro: son solo números.
        </p>
        <p>
          Los movimientos de crédito y de puntos se conservan aunque cierres la cuenta, porque son
          registros contables de dinero que entró y salió. Te lo decimos claro en lugar de prometer
          un borrado que no podríamos cumplir.
        </p>
      </Clausula>

      <Clausula titulo="7. Tus derechos">
        <p>
          Puedes pedirnos acceder a tus datos, corregirlos, llevártelos o eliminar tu cuenta.
          Nombre, apellido, teléfono y preferencia de marketing los cambias tú mismo desde{" "}
          <Link href="/perfil/editar">tu perfil</Link>. Para lo demás, pídenoslo por los canales de
          la sección 1 y te responderemos en un plazo máximo de 30 días.
        </p>
        <p>
          Si tienes saldo sin usar cuando pides el cierre, te lo diremos antes de proceder para que
          puedas gastarlo.
        </p>
      </Clausula>

      <Clausula titulo="8. Menores">
        <p>
          El Club SIEMBRA está pensado para mayores de 18 años. No creamos cuentas a menores a
          sabiendas; si detectamos una, la eliminamos.
        </p>
      </Clausula>

      <Clausula titulo="9. Cambios en esta política">
        <p>
          Si cambia algo relevante —un dato nuevo, un proveedor nuevo— actualizamos esta página y su
          fecha. Si el cambio afecta a cómo usamos tus datos, te avisamos por correo antes de
          aplicarlo.
        </p>
      </Clausula>
    </DocumentoLegal>
  );
}
