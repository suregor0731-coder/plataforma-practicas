'use strict';

const { diasEntre } = require('./fechas');

// Cuántos días antes del vencimiento se avisa que el convenio está "por vencer"
const DIAS_ALERTA = 30;

const ETIQUETAS = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencido: 'Vencido',
  suspendido: 'Suspendido',
  terminado: 'Terminado',
  no_iniciado: 'Aún no inicia',
  sin_convenio: 'Sin convenio',
};

const MOTIVOS = {
  vencido: 'el convenio de la empresa está vencido.',
  suspendido: 'el convenio de la empresa está suspendido.',
  terminado: 'el convenio de la empresa terminó.',
  no_iniciado: 'el convenio de la empresa todavía no inicia.',
  sin_convenio: 'la empresa no tiene un convenio registrado.',
};

/**
 * Evalúa un convenio en una fecha dada (AAAA-MM-DD).
 * "vigente" es true solo cuando el estado es vigente y la fecha cae dentro del rango.
 */
function evaluarConvenio(convenio, hoy) {
  const resultado = (estado, vigente, diasRestantes = null) => ({
    estado,
    vigente,
    etiqueta: ETIQUETAS[estado],
    dias_restantes: diasRestantes,
    id_convenio: convenio ? convenio.id_convenio ?? null : null,
    fecha_fin: convenio ? convenio.fecha_fin : null,
  });

  if (!convenio) return resultado('sin_convenio', false);
  if (convenio.estado === 'suspendido') return resultado('suspendido', false);
  if (convenio.estado === 'terminado') return resultado('terminado', false);
  if (hoy < convenio.fecha_inicio) return resultado('no_iniciado', false);
  if (hoy > convenio.fecha_fin) return resultado('vencido', false, diasEntre(hoy, convenio.fecha_fin));

  const dias = diasEntre(hoy, convenio.fecha_fin);
  return resultado(dias <= DIAS_ALERTA ? 'por_vencer' : 'vigente', true, dias);
}

/**
 * Una empresa puede tener varios convenios (por renovaciones). Se escoge el que esté vigente
 * y venza más tarde; si ninguno lo está, el que terminó más recientemente.
 */
function mejorConvenio(convenios, hoy) {
  if (!convenios || convenios.length === 0) return null;
  const vigentes = convenios.filter((c) => evaluarConvenio(c, hoy).vigente);
  const lista = vigentes.length > 0 ? vigentes : convenios;
  return [...lista].sort((a, b) => (a.fecha_fin < b.fecha_fin ? 1 : a.fecha_fin > b.fecha_fin ? -1 : 0))[0];
}

function evaluarMejorConvenio(convenios, hoy) {
  return evaluarConvenio(mejorConvenio(convenios, hoy), hoy);
}

/** Frase corta que explica por qué un convenio no permite aprobar. */
function motivoNoVigente(evaluacion) {
  return MOTIVOS[evaluacion && evaluacion.estado] || 'el convenio de la empresa no está vigente.';
}

module.exports = { DIAS_ALERTA, ETIQUETAS, evaluarConvenio, mejorConvenio, evaluarMejorConvenio, motivoNoVigente };
