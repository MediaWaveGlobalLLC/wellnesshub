# Plantillas de correo de Supabase Auth

Los correos de **verificación de cuenta** y **recuperación de contraseña** no
salen de este repositorio: los compone Supabase Auth y los manda por el SMTP del
proyecto. Por eso viven aquí como HTML suelto y hay que **pegarlos a mano** en

> Supabase → Authentication → **Email Templates**

| Fichero | Plantilla de Supabase |
|---|---|
| `confirmar-cuenta.html` | Confirm signup |
| `restablecer-password.html` | Reset password |

Se pega el HTML entero en el cuadro «Message body». El asunto va en su campo:

| Plantilla | Asunto |
|---|---|
| Confirm signup | `Confirma tu cuenta · SIEMBRA` |
| Reset password | `Restablece tu contraseña · SIEMBRA` |

> **Ojo:** editar plantillas exige SMTP propio. Si alguien desactiva el SMTP
> personalizado, Supabase **borra estas plantillas** y vuelve a las suyas en
> inglés. Está avisado en su propio diálogo y es fácil de hacer sin querer.

## Por qué el HTML está escrito «a la antigua»

Tablas, atributos `width`, estilos en línea y ni una hoja de estilos. No es
descuido: Outlook renderiza con el motor de Word, Gmail borra las etiquetas
`<style>` en algunas vistas y ninguno de los dos entiende flexbox ni grid. Lo que
en la web sería un `div` con clases, aquí es una tabla anidada, porque es lo
único que se ve igual en todas partes.

Por lo mismo no hay tipografías de marca: no se pueden incrustar. Se usa Georgia
para los títulos —el serif que ya hace de respaldo de *The Seasons* en
`config/design-tokens.json`— y Arial para el texto.

## Los colores son los oficiales

Salen de `config/design-tokens.json`, escritos a mano porque un correo no puede
leer variables CSS:

| Uso | Token | Hex |
|---|---|---|
| Fondo | `colors.milk` | `#F4ECE3` |
| Tarjeta | `semantic.surface` | `#FFF9F2` |
| Cabecera y texto | `colors.espresso` | `#45200A` |
| Botón | `colors.terracotta` | `#CB3700` |
| Logo sobre la cabecera | `colors.oat` | `#FFD89E` |
| Borde | `semantic.border` | `#DFD0C2` |

## El enlace va dos veces

Como botón y, debajo, como URL en texto plano. No es redundancia: hay clientes
que no pintan el botón, y quien lee el correo en texto plano se queda sin nada
que tocar. La URL suelta se puede copiar siempre.

## Variables

`{{ .ConfirmationURL }}` la sustituye Supabase por el enlace real. **No se toca
ni se le añade nada**: lleva dentro el token y el `redirect_to`, y cualquier
carácter de más lo invalida.

## Vista previa

`vista-previa.html` es una copia con las variables ya rellenas con datos falsos,
para abrirla en el navegador y ver cómo queda. No se pega en Supabase.
