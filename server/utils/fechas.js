'use strict';

// Colombia no tiene horario de verano, así que la zona fija evita sorpresas al comparar vigencias.
const ZONA_HORARIA = 'America/Bogota';

/** Fecha de hoy en formato AAAA-MM-DD según la hora de Colombia. */
function hoyISO(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const valor = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

/** Suma (o resta) días a una fecha AAAA-MM-DD. */
function sumarDias(iso, dias) {
  const fecha = new Date(`${iso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/** Días completos entre dos fechas AAAA-MM-DD (positivo si "hasta" es posterior). */
function diasEntre(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}

/** Comprueba que el texto sea una fecha real AAAA-MM-DD (rechaza, por ejemplo, 2026-02-31). */
function esFechaISO(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

module.exports = { ZONA_HORARIA, hoyISO, sumarDias, diasEntre, esFechaISO };
