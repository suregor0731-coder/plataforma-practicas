'use strict';

/**
 * Las consultas de listados agregan una columna "total" (para la paginación) que no forma
 * parte del recurso; aquí se quita antes de responder.
 */
function quitarTotal(fila) {
  if (!fila) return fila;
  const { total, ...resto } = fila; // eslint-disable-line no-unused-vars
  return resto;
}

module.exports = { quitarTotal };
