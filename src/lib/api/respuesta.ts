import { NextResponse } from "next/server";

/**
 * Sobre de respuesta de la API — `docs/05`.
 *
 * Todos los endpoints devuelven la misma forma para que el cliente no tenga que
 * adivinar. El `requestId` viaja también en la cabecera, para poder cruzar un
 * fallo del usuario con los logs del servidor.
 */
export type ApiSuccess<T> = { ok: true; data: T; requestId: string };

export type ApiError = {
  ok: false;
  error: { code: string; message: string; fieldErrors?: Record<string, string[]> };
  requestId: string;
};

export function nuevoRequestId(): string {
  return crypto.randomUUID();
}

export function exito<T>(data: T, requestId = nuevoRequestId()) {
  return NextResponse.json<ApiSuccess<T>>(
    { ok: true, data, requestId },
    { headers: { "x-request-id": requestId } }
  );
}

export function fallo(
  code: string,
  message: string,
  opciones: { status?: number; fieldErrors?: Record<string, string[]>; requestId?: string } = {}
) {
  const requestId = opciones.requestId ?? nuevoRequestId();
  return NextResponse.json<ApiError>(
    {
      ok: false,
      error: { code, message, ...(opciones.fieldErrors ? { fieldErrors: opciones.fieldErrors } : {}) },
      requestId,
    },
    { status: opciones.status ?? 400, headers: { "x-request-id": requestId } }
  );
}

export const noAutenticado = (requestId?: string) =>
  fallo("sesion_requerida", "Inicia sesión para continuar.", { status: 401, requestId });
