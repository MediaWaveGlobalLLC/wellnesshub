"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LapizIcon, PapeleraIcon } from "@/components/icons";
import { quitarAvatar, subirAvatar } from "@/lib/perfil/avatar-acciones";
import tokens from "../../../config/design-tokens.json";

/**
 * Foto de perfil.
 *
 * La imagen se recorta y se vuelve a codificar AQUÍ, en un canvas, antes de
 * salir del teléfono. Dos motivos, y el segundo es el que manda:
 *
 *  1. Una foto de cámara son 4 MB; recortada a 512 px son unos 60 KB. Subir los
 *     4 MB por datos móviles para enseñarla dentro de un círculo de 80 px es
 *     tiempo de espera regalado.
 *
 *  2. Un canvas no copia los metadatos. Las fotos del carrete llevan EXIF, y el
 *     EXIF de un móvil suele llevar **las coordenadas de dónde se tomó**. Sin
 *     este paso, cambiar la foto de perfil publicaría en un bucket de lectura
 *     pública la casa de quien la subió.
 *
 * El servidor no se fía de nada de esto: vuelve a mirar tamaño y bytes. Este
 * paso es por la persona que sube la foto, no contra ella.
 */

/** Lado del cuadrado final. La foto se enseña a 96 px como mucho; 512 sobra. */
const LADO = 512;

/** Tope de lo que se acepta ABRIR. Decodificar 50 MB tumba la pestaña. */
const MAX_ORIGINAL = 15 * 1024 * 1024;

async function recortarYComprimir(archivo: File): Promise<File> {
  // Sin `createImageBitmap` o sin `toBlob` se manda el original: el servidor lo
  // valida igual, y es mejor una foto grande que ninguna foto.
  if (typeof createImageBitmap !== "function") return archivo;

  // `from-image` respeta la orientación del EXIF antes de descartarlo. Sin
  // esto, las fotos verticales del iPhone salen tumbadas.
  const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });

  const lienzo = document.createElement("canvas");
  lienzo.width = LADO;
  lienzo.height = LADO;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return archivo;

  /*
    Fondo debajo de la foto: un PNG con transparencia sobre JPEG saldría con el
    fondo negro, que dentro de un círculo claro se ve como un borrón.

    El color sale del JSON de tokens, no escrito a mano: es el patrón que
    sanciona `docs/01` para el color que se calcula en JavaScript, y el
    validador de diseño rechaza cualquier hex literal en un `.tsx`.
  */
  ctx.fillStyle = tokens.semantic.surface;
  ctx.fillRect(0, 0, LADO, LADO);

  // Recorte cuadrado desde el centro, sin deformar.
  const lado = Math.min(bitmap.width, bitmap.height);
  const x = (bitmap.width - lado) / 2;
  const y = (bitmap.height - lado) / 2;
  ctx.drawImage(bitmap, x, y, lado, lado, 0, 0, LADO, LADO);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) =>
    lienzo.toBlob(res, "image/jpeg", 0.85)
  );
  if (!blob) return archivo;

  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}

export function FotoDePerfil({
  urlInicial,
  respaldo,
  nombre,
}: {
  urlInicial: string | null;
  /** La ilustración de marca que se usa cuando no hay foto propia. */
  respaldo: string;
  nombre: string;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [url, setUrl] = useState<string | null>(urlInicial);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  function elegida(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setAviso(null);

    if (archivo.size > MAX_ORIGINAL) {
      setError("Esa imagen es enorme. Prueba con una foto normal del carrete.");
      return;
    }

    iniciar(async () => {
      let listo: File;
      try {
        listo = await recortarYComprimir(archivo);
      } catch {
        // Un archivo que no se puede decodificar no es una imagen. Se manda
        // igual y que conteste el servidor, que es quien tiene la última
        // palabra sobre qué se acepta.
        listo = archivo;
      }

      const datos = new FormData();
      datos.set("foto", listo);

      const r = await subirAvatar(datos);
      if (r.ok) {
        setUrl(r.url);
        setAviso("Foto actualizada.");
        router.refresh();
      } else {
        setError(r.error);
      }
      // Permite volver a elegir el MISMO archivo después de un fallo.
      if (input.current) input.current.value = "";
    });
  }

  function quitar() {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await quitarAvatar();
      if (r.ok) {
        setUrl(null);
        setAviso("Foto quitada.");
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center gap-5">
        {/* El radio completo está permitido en el avatar. */}
        <div className="avatar relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border sm:h-24 sm:w-24">
          <Image
            src={url ?? respaldo}
            alt={url ? `Foto de perfil de ${nombre}` : "Ilustración de SIEMBRA"}
            fill
            sizes="96px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-espresso">Tu foto</p>
          <p className="mt-0.5 text-sm leading-relaxed text-text-muted">
            JPG, PNG o WebP. Se recorta en cuadrado desde el centro.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pendiente}
              onClick={() => input.current?.click()}
              className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-espresso transition-colors hover:border-terracota hover:text-terracota disabled:opacity-50"
            >
              <LapizIcon size={15} />
              {url ? "Cambiar foto" : "Subir foto"}
            </button>

            {url && (
              <button
                type="button"
                disabled={pendiente}
                onClick={quitar}
                className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
              >
                <PapeleraIcon size={15} />
                Quitar
              </button>
            )}
          </div>
        </div>
      </div>

      {/*
        El input va escondido y lo dispara el botón de arriba: un `input file`
        nativo no se puede peinar y rompería la pantalla. Sigue siendo el input
        real, así que el teclado y el lector de pantalla llegan a él.
      */}
      <input
        ref={input}
        type="file"
        name="foto"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Elegir foto de perfil"
        onChange={(e) => elegida(e.target.files?.[0])}
      />

      {pendiente && (
        <p role="status" className="mt-3 text-sm text-text-muted">
          Guardando tu foto…
        </p>
      )}
      {aviso && !pendiente && (
        <p role="status" className="mt-3 text-sm text-forest">
          {aviso}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
