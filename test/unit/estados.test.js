'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { aplicarTransicion, accionesPermitidas } = require('../../server/utils/estados');
const { evaluarConvenio } = require('../../server/utils/convenios');

const HOY = '2026-11-09';
const convenio = (cambios = {}) =>
  evaluarConvenio({ id_convenio: 1, estado: 'vigente', fecha_inicio: '2026-01-01', fecha_fin: '2027-06-30', ...cambios }, HOY);

const VIGENTE = convenio();
const POR_VENCER = convenio({ fecha_fin: '2026-11-20' });
const VENCIDO = convenio({ fecha_fin: '2026-10-01' });
const SIN_CONVENIO = evaluarConvenio(null, HOY);

// Devuelve una función que comprueba el estado HTTP y el código del error de negocio
const falla = (estado, codigo) => (error) => error.estado === estado && error.codigo === codigo;

describe('Máquina de estados de las postulaciones', () => {
  test('PU-01 la empresa preselecciona una postulación enviada', () => {
    assert.equal(aplicarTransicion('preseleccionar', 'enviada', 'empresa'), 'preseleccionada');
  });

  test('PU-02 Coordinación aprueba una postulación preseleccionada si el convenio está vigente', () => {
    assert.equal(aplicarTransicion('aprobar', 'preseleccionada', 'coordinacion', { convenio: VIGENTE }), 'aprobada');
  });

  test('PU-03 aprobar con el convenio vencido se rechaza con CONVENIO_NO_VIGENTE', () => {
    assert.throws(
      () => aplicarTransicion('aprobar', 'preseleccionada', 'coordinacion', { convenio: VENCIDO }),
      falla(409, 'CONVENIO_NO_VIGENTE')
    );
  });

  test('PU-04 aprobar cuando la empresa no tiene convenio registrado se rechaza', () => {
    assert.throws(
      () => aplicarTransicion('aprobar', 'preseleccionada', 'coordinacion', { convenio: SIN_CONVENIO }),
      falla(409, 'CONVENIO_NO_VIGENTE')
    );
  });

  test('PU-05 un convenio "por vencer" todavía permite aprobar', () => {
    assert.equal(POR_VENCER.estado, 'por_vencer');
    assert.equal(aplicarTransicion('aprobar', 'preseleccionada', 'coordinacion', { convenio: POR_VENCER }), 'aprobada');
  });

  test('PU-06 un rol que no corresponde recibe PROHIBIDO (la empresa no puede aprobar)', () => {
    assert.throws(
      () => aplicarTransicion('aprobar', 'preseleccionada', 'empresa', { convenio: VIGENTE }),
      falla(403, 'PROHIBIDO')
    );
  });

  test('PU-07 una postulación descartada no puede aprobarse (TRANSICION_INVALIDA)', () => {
    assert.throws(
      () => aplicarTransicion('aprobar', 'descartada', 'coordinacion', { convenio: VIGENTE }),
      falla(409, 'TRANSICION_INVALIDA')
    );
  });

  test('PU-08 devolver solo procede si el convenio no está vigente (CONVENIO_VIGENTE)', () => {
    assert.throws(
      () => aplicarTransicion('devolver', 'preseleccionada', 'coordinacion', { convenio: VIGENTE }),
      falla(409, 'CONVENIO_VIGENTE')
    );
    assert.equal(aplicarTransicion('devolver', 'preseleccionada', 'coordinacion', { convenio: VENCIDO }), 'devuelta');
  });

  test('PU-09 una postulación devuelta puede aprobarse cuando el convenio se regulariza', () => {
    assert.equal(aplicarTransicion('aprobar', 'devuelta', 'coordinacion', { convenio: VIGENTE }), 'aprobada');
  });

  test('PU-10 una acción que no existe se responde con 400 ACCION_DESCONOCIDA', () => {
    assert.throws(() => aplicarTransicion('archivar', 'enviada', 'coordinacion'), falla(400, 'ACCION_DESCONOCIDA'));
  });

  test('PU-11 con convenio vencido se ofrece rechazar y devolver, pero no aprobar', () => {
    assert.deepEqual(accionesPermitidas('preseleccionada', VENCIDO), ['rechazar', 'devolver']);
    assert.deepEqual(accionesPermitidas('preseleccionada', VIGENTE), ['aprobar', 'rechazar']);
  });

  test('PU-12 sobre una postulación enviada la empresa puede preseleccionar o descartar', () => {
    assert.deepEqual(accionesPermitidas('enviada', null, 'empresa'), ['preseleccionar', 'descartar']);
  });

  test('PU-13 los estados finales no ofrecen ninguna acción', () => {
    for (const estado of ['aprobada', 'rechazada', 'descartada']) {
      assert.deepEqual(accionesPermitidas(estado, VIGENTE), []);
      assert.deepEqual(accionesPermitidas(estado, VIGENTE, 'empresa'), []);
    }
  });
});
