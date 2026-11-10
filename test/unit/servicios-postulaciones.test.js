'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  ESTUDIANTE,
  OTRO_ESTUDIANTE,
  EMPRESA,
  OTRA_EMPRESA,
  COORDINACION,
  OFERTA_BASE,
  CONVENIO_VIGENTE,
  cuerpoPostulacion,
  falla,
  crearMundo,
} = require('../ayudas/mundo-falso');

const pendiente = (cambios = {}) => ({
  id_postulacion: 1,
  id_estudiante: 3,
  id_oferta: 1,
  estado_postulacion: 'preseleccionada',
  ...cambios,
});

describe('Servicio de postulaciones: envío de la postulación', () => {
  test('PU-49 una postulación válida queda en estado "enviada" y la empresa recibe un aviso', async () => {
    const mundo = crearMundo();
    const creada = await mundo.servicios.postulaciones.postular(ESTUDIANTE, 1, cuerpoPostulacion());

    assert.equal(creada.estado_postulacion, 'enviada');
    assert.equal(mundo.estado.postulaciones.size, 1);
    assert.equal(mundo.bandeja.length, 1);
    assert.deepEqual(mundo.bandeja[0].para, ['rrhh@nodo.demo']);
    assert.match(mundo.bandeja[0].asunto, /Nueva postulación para "Practicante de desarrollo web"/);
  });

  test('PU-50 no se acepta postular a una oferta cerrada, vencida o sin cupos', async () => {
    const aprobada = { id_postulacion: 50, id_estudiante: 9, id_oferta: 1, estado_postulacion: 'aprobada' };
    const casos = [
      { oferta: { estado: 'cerrada' }, codigo: 'OFERTA_CERRADA', postulaciones: [] },
      { oferta: { fecha_cierre: '2026-11-08' }, codigo: 'OFERTA_VENCIDA', postulaciones: [] },
      { oferta: { cupos: 1 }, codigo: 'SIN_CUPOS', postulaciones: [aprobada] },
    ];
    for (const { oferta, codigo, postulaciones } of casos) {
      const mundo = crearMundo({ ofertas: [{ ...OFERTA_BASE, ...oferta }], postulaciones });
      await assert.rejects(mundo.servicios.postulaciones.postular(ESTUDIANTE, 1, cuerpoPostulacion()), falla(409, codigo));
      assert.deepEqual(mundo.estado.escrituras, [], `${codigo}: no debía guardarse nada`);
      assert.equal(mundo.bandeja.length, 0);
    }
  });

  test('PU-51 un estudiante no puede postularse dos veces a la misma oferta', async () => {
    const mundo = crearMundo();
    await mundo.servicios.postulaciones.postular(ESTUDIANTE, 1, cuerpoPostulacion());
    await assert.rejects(
      mundo.servicios.postulaciones.postular(ESTUDIANTE, 1, cuerpoPostulacion()),
      falla(409, 'POSTULACION_DUPLICADA')
    );
    assert.equal(mundo.estado.postulaciones.size, 1);
  });

  test('PU-52 si dos envíos simultáneos pasan la revisión, la restricción UNIQUE de la base se traduce a 409', async () => {
    const mundo = crearMundo();
    mundo.estado.fallarInsercion = Object.assign(new Error('llave duplicada'), {
      code: '23505',
      constraint: 'uq_postulacion_estudiante_oferta',
    });
    await assert.rejects(
      mundo.servicios.postulaciones.postular(ESTUDIANTE, 1, cuerpoPostulacion()),
      falla(409, 'POSTULACION_DUPLICADA')
    );
  });

  test('PU-53 una violación UNIQUE de otra restricción no se disfraza de postulación duplicada', async () => {
    const mundo = crearMundo();
    const otroError = Object.assign(new Error('llave duplicada'), { code: '23505', constraint: 'otra_restriccion_key' });
    mundo.estado.fallarInsercion = otroError;
    await assert.rejects(mundo.servicios.postulaciones.postular(ESTUDIANTE, 1, cuerpoPostulacion()), (error) => error === otroError);
  });

  test('PU-54 solo un estudiante puede postularse; una empresa recibe 403 y no se guarda nada', async () => {
    const mundo = crearMundo();
    await assert.rejects(mundo.servicios.postulaciones.postular(EMPRESA, 1, cuerpoPostulacion()), falla(403, 'PROHIBIDO'));
    assert.deepEqual(mundo.estado.escrituras, []);
  });

  test('PU-55 si el correo falla, la postulación queda guardada y el fallo se anota en el registro', async () => {
    const notificador = {
      async enviar() {
        throw new Error('SMTP no disponible');
      },
    };
    const mundo = crearMundo({ notificador });
    const creada = await mundo.servicios.postulaciones.postular(ESTUDIANTE, 1, cuerpoPostulacion());

    assert.equal(creada.estado_postulacion, 'enviada');
    assert.equal(mundo.estado.postulaciones.size, 1);
    assert.equal(mundo.estado.registros.length, 1);
    assert.match(mundo.estado.registros[0].join(' '), /SMTP no disponible/);
  });
});

describe('Servicio de postulaciones: decisión de Coordinación', () => {
  test('PU-56 al aprobar con convenio vigente se guarda quién decidió y se avisa al estudiante y a la empresa', async () => {
    const mundo = crearMundo({ postulaciones: [pendiente()] });
    const resultado = await mundo.servicios.postulaciones.decidirCoordinacion(COORDINACION, 1, 'aprobar', {});

    assert.equal(resultado.estado_postulacion, 'aprobada');
    assert.equal(resultado.convenio.vigente, true);
    const guardada = mundo.estado.postulaciones.get(1);
    assert.equal(guardada.estado_postulacion, 'aprobada');
    assert.equal(guardada.id_usuario_decision, COORDINACION.id_usuario);

    assert.equal(mundo.bandeja.length, 1);
    assert.deepEqual(mundo.bandeja[0].para, ['camila@practicas.demo', 'rrhh@nodo.demo']);
    assert.match(mundo.bandeja[0].asunto, /fue aprobada/);
  });

  test('PU-57 al aprobar el último cupo la oferta se cierra sola; si quedan cupos sigue abierta', async () => {
    const mundo = crearMundo({
      postulaciones: [pendiente(), pendiente({ id_postulacion: 2, id_estudiante: 4 })],
    });
    const primera = await mundo.servicios.postulaciones.decidirCoordinacion(COORDINACION, 1, 'aprobar', {});
    assert.equal(primera.oferta_cerrada, false);
    assert.equal(mundo.estado.ofertas.get(1).estado, 'abierta');

    const segunda = await mundo.servicios.postulaciones.decidirCoordinacion(COORDINACION, 2, 'aprobar', {});
    assert.equal(segunda.oferta_cerrada, true);
    assert.equal(mundo.estado.ofertas.get(1).estado, 'cerrada');
  });

  test('PU-58 si la oferta ya no tiene cupos libres, aprobar responde 409 SIN_CUPOS y no cambia la postulación', async () => {
    const mundo = crearMundo({
      ofertas: [{ ...OFERTA_BASE, cupos: 1 }],
      postulaciones: [pendiente(), pendiente({ id_postulacion: 50, id_estudiante: 9, estado_postulacion: 'aprobada' })],
    });
    await assert.rejects(mundo.servicios.postulaciones.decidirCoordinacion(COORDINACION, 1, 'aprobar', {}), falla(409, 'SIN_CUPOS'));
    assert.equal(mundo.estado.postulaciones.get(1).estado_postulacion, 'preseleccionada');
    assert.deepEqual(mundo.estado.escrituras, []);
    assert.equal(mundo.bandeja.length, 0);
  });

  test('PU-59 con el convenio vencido no se puede aprobar: 409 CONVENIO_NO_VIGENTE, sin cambios ni correos', async () => {
    const vencido = { ...CONVENIO_VIGENTE, fecha_fin: '2026-10-01' };
    const mundo = crearMundo({ convenios: [vencido], postulaciones: [pendiente()] });
    await assert.rejects(
      mundo.servicios.postulaciones.decidirCoordinacion(COORDINACION, 1, 'aprobar', {}),
      falla(409, 'CONVENIO_NO_VIGENTE')
    );
    assert.equal(mundo.estado.postulaciones.get(1).estado_postulacion, 'preseleccionada');
    assert.deepEqual(mundo.estado.escrituras, []);
    assert.equal(mundo.bandeja.length, 0);
  });

  test('PU-60 devolver por convenio vencido guarda el motivo y, ya regularizado el convenio, la postulación puede aprobarse', async () => {
    const vencido = { ...CONVENIO_VIGENTE, fecha_fin: '2026-10-01' };
    const mundo = crearMundo({ convenios: [vencido], postulaciones: [pendiente()] });

    const devuelta = await mundo.servicios.postulaciones.decidirCoordinacion(COORDINACION, 1, 'devolver', {
      observacion: 'Convenio en proceso de renovación',
    });
    assert.equal(devuelta.estado_postulacion, 'devuelta');
    assert.equal(mundo.estado.postulaciones.get(1).observacion_decision, 'Convenio en proceso de renovación');
    assert.match(mundo.bandeja[0].texto, /Convenio en proceso de renovación/);

    mundo.estado.convenios = [CONVENIO_VIGENTE]; // la empresa renueva el convenio
    const aprobada = await mundo.servicios.postulaciones.decidirCoordinacion(COORDINACION, 1, 'aprobar', {});
    assert.equal(aprobada.estado_postulacion, 'aprobada');
  });

  test('PU-61 rechazar sin motivo responde 422 y no se escribe nada', async () => {
    const mundo = crearMundo({ postulaciones: [pendiente()] });
    await assert.rejects(
      mundo.servicios.postulaciones.decidirCoordinacion(COORDINACION, 1, 'rechazar', {}),
      (error) => error.estado === 422 && error.codigo === 'VALIDACION' && Boolean(error.detalles.observacion)
    );
    assert.deepEqual(mundo.estado.escrituras, []);
  });

  test('PU-62 decidir sobre una postulación que no existe responde 404', async () => {
    const mundo = crearMundo();
    await assert.rejects(mundo.servicios.postulaciones.decidirCoordinacion(COORDINACION, 999, 'aprobar', {}), falla(404, 'NO_ENCONTRADO'));
  });
});

describe('Servicio de postulaciones: acciones de la empresa y privacidad', () => {
  test('PU-63 la preselección avisa a toda Coordinación; descartar no genera correos', async () => {
    const mundo = crearMundo({
      correosCoordinacion: ['coordinacion@practicas.demo', 'practicas2@practicas.demo'],
      postulaciones: [
        pendiente({ estado_postulacion: 'enviada' }),
        pendiente({ id_postulacion: 2, id_estudiante: 4, estado_postulacion: 'enviada' }),
      ],
    });
    const preseleccionada = await mundo.servicios.postulaciones.decidirEmpresa(EMPRESA, 1, 'preseleccionar');
    assert.equal(preseleccionada.estado_postulacion, 'preseleccionada');
    assert.equal(mundo.bandeja.length, 1);
    assert.deepEqual(mundo.bandeja[0].para, ['coordinacion@practicas.demo', 'practicas2@practicas.demo']);

    const descartada = await mundo.servicios.postulaciones.decidirEmpresa(EMPRESA, 2, 'descartar');
    assert.equal(descartada.estado_postulacion, 'descartada');
    assert.equal(mundo.bandeja.length, 1);
  });

  test('PU-64 una empresa no puede decidir ni ver los postulantes de las ofertas de otra empresa', async () => {
    const mundo = crearMundo({ postulaciones: [pendiente({ estado_postulacion: 'enviada' })] });
    await assert.rejects(mundo.servicios.postulaciones.decidirEmpresa(OTRA_EMPRESA, 1, 'preseleccionar'), falla(403, 'PROHIBIDO'));
    await assert.rejects(mundo.servicios.postulaciones.listarDeOferta(OTRA_EMPRESA, 1), falla(403, 'PROHIBIDO'));
    assert.equal(mundo.estado.postulaciones.get(1).estado_postulacion, 'enviada');

    const propia = await mundo.servicios.postulaciones.listarDeOferta(EMPRESA, 1);
    assert.equal(propia.datos.length, 1);
    assert.deepEqual(propia.datos[0].acciones, ['preseleccionar', 'descartar']);
  });

  test('PU-65 la hoja de vida solo la descargan su dueño, la empresa de la oferta y Coordinación', async () => {
    const mundo = crearMundo({ postulaciones: [pendiente()] });
    const { obtenerHojaVida } = mundo.servicios.postulaciones;

    for (const usuario of [ESTUDIANTE, EMPRESA, COORDINACION]) {
      const archivo = await obtenerHojaVida(usuario, 1);
      assert.equal(archivo.contenido.subarray(0, 5).toString('latin1'), '%PDF-');
    }
    await assert.rejects(obtenerHojaVida(OTRO_ESTUDIANTE, 1), falla(403, 'PROHIBIDO'));
    await assert.rejects(obtenerHojaVida(OTRA_EMPRESA, 1), falla(403, 'PROHIBIDO'));
    await assert.rejects(obtenerHojaVida(COORDINACION, 999), falla(404, 'NO_ENCONTRADO'));
  });
});
