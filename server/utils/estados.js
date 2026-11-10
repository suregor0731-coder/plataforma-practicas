'use strict';

const { conflicto, prohibido, solicitudInvalida } = require('./errores');
const { motivoNoVigente } = require('./convenios');

/**
 * Máquina de estados de una postulación. Reproduce el flujo del diagrama de actividades
 * de la Unidad 2: la empresa preselecciona o descarta, y Coordinación aprueba, rechaza o
 * devuelve. Aprobar exige convenio vigente (RF6).
 */
const TRANSICIONES = Object.freeze({
  preseleccionar: { rol: 'empresa', desde: ['enviada'], hasta: 'preseleccionada' },
  descartar: { rol: 'empresa', desde: ['enviada'], hasta: 'descartada' },
  aprobar: { rol: 'coordinacion', desde: ['preseleccionada', 'devuelta'], hasta: 'aprobada', exigeConvenio: true },
  rechazar: { rol: 'coordinacion', desde: ['preseleccionada', 'devuelta'], hasta: 'rechazada' },
  devolver: { rol: 'coordinacion', desde: ['preseleccionada'], hasta: 'devuelta', exigeSinConvenio: true },
});

/**
 * Devuelve el estado nuevo o lanza el error de negocio que corresponda.
 * "convenio" es el resultado de evaluarMejorConvenio para la empresa de la oferta.
 */
function aplicarTransicion(accion, estadoActual, rol, { convenio } = {}) {
  const regla = TRANSICIONES[accion];
  if (!regla) throw solicitudInvalida('ACCION_DESCONOCIDA', `La acción "${accion}" no existe.`);
  if (regla.rol !== rol) throw prohibido(`El rol ${rol} no puede ${accion} postulaciones.`);
  if (!regla.desde.includes(estadoActual)) {
    throw conflicto('TRANSICION_INVALIDA', `No se puede ${accion} una postulación que está en estado "${estadoActual}".`);
  }
  const convenioVigente = Boolean(convenio && convenio.vigente);
  if (regla.exigeConvenio && !convenioVigente) {
    throw conflicto('CONVENIO_NO_VIGENTE', `No se puede aprobar: ${motivoNoVigente(convenio)}`);
  }
  if (regla.exigeSinConvenio && convenioVigente) {
    throw conflicto('CONVENIO_VIGENTE', 'Solo se devuelve una postulación cuando el convenio de la empresa no está vigente.');
  }
  return regla.hasta;
}

/** Acciones que el rol indicado puede ejecutar ahora; la interfaz las usa para habilitar botones. */
function accionesPermitidas(estado, convenio, rol = 'coordinacion') {
  const convenioVigente = Boolean(convenio && convenio.vigente);
  return Object.entries(TRANSICIONES)
    .filter(([, r]) => r.rol === rol && r.desde.includes(estado))
    .filter(([, r]) => !r.exigeConvenio || convenioVigente)
    .filter(([, r]) => !r.exigeSinConvenio || !convenioVigente)
    .map(([accion]) => accion);
}

module.exports = { TRANSICIONES, aplicarTransicion, accionesPermitidas };
