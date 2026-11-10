'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Las rutas de la interfaz (/ofertas, /coordinacion...) las resuelve React Router en el navegador.
 * Si el servidor recibe una de ellas directamente (por ejemplo al recargar la página), responde
 * con index.html y deja que el navegador continúe.
 */
function fallbackSpa(carpetaWeb) {
  const indice = path.join(carpetaWeb, 'index.html');
  return async function servirIndice(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    let html;
    try {
      html = await fs.readFile(indice);
    } catch {
      return res
        .status(404)
        .type('text/plain; charset=utf-8')
        .send('La interfaz web todavía no está compilada. Ejecute "npm run build:web" y recargue la página.');
    }
    return res.type('html').send(html);
  };
}

module.exports = { fallbackSpa };
