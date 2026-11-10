'use strict';

const { ErrorApp } = require('../utils/errores');

/** Cualquier ruta de /api que ninguna ruta atendió. */
function rutaNoEncontrada(req, res, next) {
  next(new ErrorApp(404, 'RUTA_NO_ENCONTRADA', 'La ruta solicitada no existe.'));
}

/**
 * Convierte los errores en respuestas JSON con la forma { error: { codigo, mensaje, detalles } }.
 * Los errores inesperados se registran completos en el servidor, pero al cliente solo se le da
 * un mensaje genérico para no filtrar detalles internos.
 */
function manejadorErrores({ registrar = console.error } = {}) {
  return function manejar(error, req, res, next) {
    if (res.headersSent) return next(error);

    let estado = 500;
    let cuerpo = { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Intente de nuevo más tarde.' };

    if (error instanceof ErrorApp) {
      estado = error.estado;
      cuerpo = { codigo: error.codigo, mensaje: error.message };
      if (error.detalles) cuerpo.detalles = error.detalles;
    } else if (error && error.type === 'entity.parse.failed') {
      estado = 400;
      cuerpo = { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es un JSON válido.' };
    } else if (error && error.type === 'entity.too.large') {
      estado = 413;
      cuerpo = { codigo: 'CUERPO_MUY_GRANDE', mensaje: 'El contenido enviado supera el tamaño permitido.' };
    } else {
      registrar(`[error] ${req.method} ${req.originalUrl.split('?')[0]}:`, error);
    }
    return res.status(estado).json({ error: cuerpo });
  };
}

module.exports = { rutaNoEncontrada, manejadorErrores };
