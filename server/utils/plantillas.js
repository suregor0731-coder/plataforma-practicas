'use strict';

// Textos de los correos que genera la plataforma. Son funciones puras para poder probarlas.

function mensajePostulacionRecibida(p) {
  return {
    asunto: `Nueva postulación para "${p.oferta_titulo}"`,
    texto:
      `El estudiante ${p.estudiante_nombre} (${p.estudiante_programa}, semestre ${p.estudiante_semestre}) ` +
      `se postuló a su oferta "${p.oferta_titulo}". Ingrese a la plataforma para revisar su hoja de vida.`,
  };
}

function mensajePreseleccion(p) {
  return {
    asunto: `Postulación pendiente de aprobación: ${p.estudiante_nombre}`,
    texto:
      `${p.empresa_nombre} preseleccionó a ${p.estudiante_nombre} para "${p.oferta_titulo}". ` +
      'La postulación quedó pendiente de la verificación del convenio y de su aprobación.',
  };
}

const ETIQUETA_DECISION = { aprobada: 'aprobada', rechazada: 'rechazada', devuelta: 'devuelta' };

function mensajeDecision(p, estado, observacion) {
  const etiqueta = ETIQUETA_DECISION[estado] || estado;
  const motivo = observacion ? ` Observación de Coordinación: ${observacion}` : '';
  return {
    asunto: `Su postulación a "${p.oferta_titulo}" fue ${etiqueta}`,
    texto: `La postulación de ${p.estudiante_nombre} a "${p.oferta_titulo}" (${p.empresa_nombre}) fue ${etiqueta}.${motivo}`,
  };
}

module.exports = { mensajePostulacionRecibida, mensajePreseleccion, mensajeDecision };
