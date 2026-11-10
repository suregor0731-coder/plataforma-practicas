'use strict';

// Código SQLSTATE que PostgreSQL usa para una violación de restricción UNIQUE
const VIOLACION_UNICA = '23505';

/**
 * Indica si el error es una violación de UNIQUE. Con "parteDelNombre" también comprueba que el
 * nombre de la restricción la contenga (p. ej. "correo" para usuario_correo_institucional_key).
 */
function esUnica(error, parteDelNombre) {
  if (!error || error.code !== VIOLACION_UNICA) return false;
  return !parteDelNombre || String(error.constraint || '').includes(parteDelNombre);
}

module.exports = { VIOLACION_UNICA, esUnica };
