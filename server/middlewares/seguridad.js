'use strict';

// Política de contenido: la interfaz solo carga recursos del propio servidor
const POLITICA_CONTENIDO = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Cabeceras HTTP de seguridad para todas las respuestas. */
function seguridad(req, res, next) {
  res.set('Content-Security-Policy', POLITICA_CONTENIDO);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  // Las respuestas de la API traen datos personales: no deben quedar en cachés compartidas
  if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
  next();
}

module.exports = { seguridad, POLITICA_CONTENIDO };
