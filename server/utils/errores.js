'use strict';

/**
 * Error de negocio con estado HTTP y un código estable que el frontend puede interpretar.
 * El middleware de errores lo convierte en { error: { codigo, mensaje, detalles } }.
 */
class ErrorApp extends Error {
  constructor(estado, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorApp';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

const solicitudInvalida = (codigo, mensaje) => new ErrorApp(400, codigo, mensaje);
const noAutenticado = (mensaje = 'Debe iniciar sesión para continuar.', codigo = 'NO_AUTENTICADO') =>
  new ErrorApp(401, codigo, mensaje);
const prohibido = (mensaje = 'No tiene permisos para realizar esta acción.') => new ErrorApp(403, 'PROHIBIDO', mensaje);
const noEncontrado = (mensaje = 'El recurso solicitado no existe.') => new ErrorApp(404, 'NO_ENCONTRADO', mensaje);
const conflicto = (codigo, mensaje) => new ErrorApp(409, codigo, mensaje);
const invalido = (detalles, mensaje = 'Hay datos que no son válidos.') => new ErrorApp(422, 'VALIDACION', mensaje, detalles);

module.exports = { ErrorApp, solicitudInvalida, noAutenticado, prohibido, noEncontrado, conflicto, invalido };
