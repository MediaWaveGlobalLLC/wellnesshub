/*
  Módulo vacío que sustituye a `server-only` durante las pruebas.

  En producción, importar `server-only` desde un componente cliente rompe el
  build a propósito. Ese centinela vive en el compilador de Next; en Vitest no
  hay nada que resolver, así que se apunta aquí. La garantía no se debilita: el
  build sigue fallando si alguien cruza la frontera.
*/
export {};
