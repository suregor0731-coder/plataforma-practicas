import { useEffect } from 'react';

const BASE = 'Portal de Prácticas Profesionales';

/** Cada pantalla pone su propio título en la pestaña del navegador (ayuda a orientarse y a la accesibilidad). */
export function useTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${BASE}` : BASE;
  }, [titulo]);
}
