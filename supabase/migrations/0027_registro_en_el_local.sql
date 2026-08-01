-- ─────────────────────────────────────────────────────────────────────────────
-- 0027 — El límite de registro estaba pensado para un atacante, no para un café.
--
-- `0010` puso «cuentas nuevas por IP: 5 en 1 hora». Contra alguien creando
-- cuentas en masa desde su casa, es razonable. Dentro del local, no:
--
--   todo el mundo conectado al WiFi de SIEMBRA sale por LA MISMA IP.
--
-- O sea que el límite no es «5 cuentas por persona», es «5 cuentas por hora
-- EN TODO EL LOCAL». La sexta persona que se apunta en la barra durante el
-- soft opening ve «demasiados intentos, vuelve en 47 minutos» sin haber
-- intentado nada. Y como el contador se incrementa ANTES de hablar con
-- Supabase, cada intento fallido —un correo ya registrado, una contraseña
-- corta— gasta un turno igual.
--
-- Pasa a 20 por hora. Sigue frenando el abuso automatizado, que es a lo que
-- apunta esta regla, y deja de frenar una fila de gente real.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ NO SE QUITA DEL TODO
--
-- Cada alta manda un correo desde Supabase. Sin límite, un script deja el
-- dominio del proyecto quemado por spam en una tarde y entonces no llega el
-- correo de verificación de NADIE. El límite protege eso, no protege una tabla.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SI ALGUIEN ESTÁ BLOQUEADO AHORA MISMO
--
-- El contador vive en `rate_limit_hits` y caduca solo. Para desbloquear ya:
--
--   delete from public.rate_limit_hits where accion = 'registro';
--
-- Borra los contadores de registro de todo el mundo, que es justo lo que se
-- quiere cuando la regla estaba mal puesta. No toca login ni recuperación.
-- ─────────────────────────────────────────────────────────────────────────────

update public.rate_limit_reglas
   set max_intentos = 20,
       descripcion = 'Cuentas nuevas por IP, 1 hora. 20 y no 5: en el local todo el mundo comparte la IP del WiFi'
 where accion = 'registro';

/*
  Y se limpian los contadores en curso.

  Sin esto, quien se quedó bloqueado con la regla vieja sigue bloqueado hasta
  que su ventana de una hora se cierre, porque el conteo ya está guardado. La
  migración arreglaría el problema para mañana y no para la persona que lo tiene
  delante ahora mismo.
*/
delete from public.rate_limit_hits where accion = 'registro';
