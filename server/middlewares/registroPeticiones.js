'use strict';

/**
 * Registra una línea por petición: método, ruta, estado y duración. No se guardan cuerpos,
 * cabeceras ni parámetros de consulta para no dejar datos personales en los registros.
 */
function registroPeticiones(escribir = console.log) {
  return function registrar(req, res, next) {
    const inicio = process.hrtime.bigint();
    res.on('finish', () => {
      const milisegundos = Number(process.hrtime.bigint() - inicio) / 1e6;
      escribir(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${milisegundos.toFixed(1)} ms`);
    });
    next();
  };
}

module.exports = { registroPeticiones };
