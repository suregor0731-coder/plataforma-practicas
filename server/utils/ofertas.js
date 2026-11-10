'use strict';

/**
 * Indica si una oferta admite nuevas postulaciones en la fecha "hoy" (AAAA-MM-DD).
 * Una oferta no está disponible si está cerrada, si pasó su fecha de cierre o si ya
 * se aprobaron tantos estudiantes como cupos tiene.
 */
function evaluarOferta(oferta, hoy) {
  if (oferta.estado !== 'abierta') {
    return { disponible: false, codigo: 'OFERTA_CERRADA', mensaje: 'La oferta ya está cerrada.' };
  }
  if (oferta.fecha_cierre && oferta.fecha_cierre < hoy) {
    return { disponible: false, codigo: 'OFERTA_VENCIDA', mensaje: 'La fecha de cierre de la oferta ya pasó.' };
  }
  if (oferta.cupos - (oferta.aprobadas || 0) <= 0) {
    return { disponible: false, codigo: 'SIN_CUPOS', mensaje: 'La oferta no tiene cupos disponibles.' };
  }
  return { disponible: true, codigo: null, mensaje: null };
}

module.exports = { evaluarOferta };
