'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluarConvenio, evaluarMejorConvenio, DIAS_ALERTA } = require('../../server/utils/convenios');
const { sumarDias, diasEntre, esFechaISO, hoyISO } = require('../../server/utils/fechas');
const { evaluarOferta } = require('../../server/utils/ofertas');

const HOY = '2026-11-09';
const conv = (cambios = {}) => ({
  id_convenio: 1,
  id_empresa: 1,
  estado: 'vigente',
  fecha_inicio: '2026-01-01',
  fecha_fin: '2027-06-30',
  ...cambios,
});

describe('Vigencia de los convenios', () => {
  test('PU-14 un convenio con fechas dentro del rango se evalúa como vigente', () => {
    const resultado = evaluarConvenio(conv(), HOY);
    assert.equal(resultado.estado, 'vigente');
    assert.equal(resultado.vigente, true);
    assert.equal(resultado.dias_restantes, diasEntre(HOY, '2027-06-30'));
  });

  test('PU-15 a 30 días del vencimiento queda "por vencer" y a 31 sigue "vigente"', () => {
    assert.equal(DIAS_ALERTA, 30);
    assert.equal(evaluarConvenio(conv({ fecha_fin: sumarDias(HOY, 30) }), HOY).estado, 'por_vencer');
    assert.equal(evaluarConvenio(conv({ fecha_fin: sumarDias(HOY, 31) }), HOY).estado, 'vigente');
    assert.equal(evaluarConvenio(conv({ fecha_fin: sumarDias(HOY, 30) }), HOY).vigente, true);
  });

  test('PU-16 el último día cuenta como vigente y al día siguiente está vencido', () => {
    const ultimoDia = evaluarConvenio(conv({ fecha_fin: HOY }), HOY);
    assert.equal(ultimoDia.vigente, true);
    assert.equal(ultimoDia.dias_restantes, 0);
    const alDiaSiguiente = evaluarConvenio(conv({ fecha_fin: sumarDias(HOY, -1) }), HOY);
    assert.equal(alDiaSiguiente.estado, 'vencido');
    assert.equal(alDiaSiguiente.vigente, false);
  });

  test('PU-17 un convenio suspendido o terminado nunca es vigente, aunque las fechas coincidan', () => {
    assert.equal(evaluarConvenio(conv({ estado: 'suspendido' }), HOY).vigente, false);
    assert.equal(evaluarConvenio(conv({ estado: 'terminado' }), HOY).estado, 'terminado');
  });

  test('PU-18 un convenio que todavía no inicia no es vigente', () => {
    const resultado = evaluarConvenio(conv({ fecha_inicio: sumarDias(HOY, 5) }), HOY);
    assert.equal(resultado.estado, 'no_iniciado');
    assert.equal(resultado.vigente, false);
  });

  test('PU-19 una empresa sin convenios queda como "sin_convenio"', () => {
    const resultado = evaluarMejorConvenio([], HOY);
    assert.equal(resultado.estado, 'sin_convenio');
    assert.equal(resultado.vigente, false);
    assert.equal(resultado.id_convenio, null);
  });

  test('PU-20 entre varios convenios se escoge el vigente que vence más tarde (renovaciones)', () => {
    const viejo = conv({ id_convenio: 1, fecha_inicio: '2025-01-01', fecha_fin: '2026-06-30' });
    const actual = conv({ id_convenio: 2, fecha_inicio: '2026-07-01', fecha_fin: '2027-06-30' });
    const suspendido = conv({ id_convenio: 3, estado: 'suspendido', fecha_fin: '2030-01-01' });
    const resultado = evaluarMejorConvenio([viejo, suspendido, actual], HOY);
    assert.equal(resultado.id_convenio, 2);
    assert.equal(resultado.vigente, true);
  });

  test('PU-21 si ninguno está vigente se toma el que terminó más recientemente', () => {
    const a = conv({ id_convenio: 1, fecha_inicio: '2024-01-01', fecha_fin: '2025-01-01' });
    const b = conv({ id_convenio: 2, fecha_inicio: '2025-02-01', fecha_fin: '2026-02-01' });
    const resultado = evaluarMejorConvenio([a, b], HOY);
    assert.equal(resultado.id_convenio, 2);
    assert.equal(resultado.estado, 'vencido');
  });
});

describe('Fechas y disponibilidad de las ofertas', () => {
  test('PU-22 la fecha del día se calcula con la hora de Colombia (UTC-5)', () => {
    // 02:30 UTC del 10 de noviembre todavía es 9 de noviembre en Bogotá
    assert.equal(hoyISO(new Date('2026-11-10T02:30:00Z')), '2026-11-09');
    assert.equal(hoyISO(new Date('2026-11-10T05:00:00Z')), '2026-11-10');
  });

  test('PU-23 se rechazan fechas inexistentes como el 31 de febrero', () => {
    assert.equal(esFechaISO('2026-02-31'), false);
    assert.equal(esFechaISO('2026-02-28'), true);
    assert.equal(esFechaISO('09/11/2026'), false);
  });

  test('PU-24 una oferta abierta, vigente y con cupos acepta postulaciones', () => {
    const oferta = { estado: 'abierta', fecha_cierre: sumarDias(HOY, 3), cupos: 2, aprobadas: 1 };
    assert.equal(evaluarOferta(oferta, HOY).disponible, true);
  });

  test('PU-25 una oferta cerrada, vencida o sin cupos no acepta postulaciones', () => {
    assert.equal(evaluarOferta({ estado: 'cerrada', cupos: 2, aprobadas: 0 }, HOY).codigo, 'OFERTA_CERRADA');
    assert.equal(
      evaluarOferta({ estado: 'abierta', fecha_cierre: sumarDias(HOY, -1), cupos: 2, aprobadas: 0 }, HOY).codigo,
      'OFERTA_VENCIDA'
    );
    assert.equal(evaluarOferta({ estado: 'abierta', fecha_cierre: null, cupos: 2, aprobadas: 2 }, HOY).codigo, 'SIN_CUPOS');
  });
});
