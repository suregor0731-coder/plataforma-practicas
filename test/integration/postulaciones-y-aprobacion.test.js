'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { crearPdfMinimo } = require('../../server/utils/pdfMinimo');
const { crearEntorno, CUENTAS, cuerpoPostulacion, cuerpoOferta, pdfBase64 } = require('../ayudas/entorno');

// Identificadores de las ofertas de la semilla (se insertan en este orden sobre una base recién creada)
const OFERTA = { desarrolloWeb: 1, qa: 2, datos: 3, logistica: 4, mejoramiento: 5, diseno: 6, salud: 7, contable: 8 };

describe('API: postulaciones y aprobación con validación de convenio (PostgreSQL real)', () => {
  let e;
  const tokens = {};
  let idJulian; // postulación de Julián a la oferta de desarrollo web, creada en PI-09

  const decidir = (accion, id, token, cuerpo) => e.pedir('POST', `/postulaciones/${id}/${accion}`, { token, cuerpo });
  const estadoEnBD = async (id) =>
    (await e.consulta('SELECT estado_postulacion FROM postulacion WHERE id_postulacion = $1', [id])).rows[0].estado_postulacion;
  const idPostulacion = async (correo, idOferta) =>
    (
      await e.consulta(
        `SELECT po.id_postulacion
           FROM postulacion po
           JOIN estudiante s ON s.id_estudiante = po.id_estudiante
           JOIN usuario u ON u.id_usuario = s.id_usuario
          WHERE u.correo_institucional = $1 AND po.id_oferta = $2`,
        [correo, idOferta]
      )
    ).rows[0].id_postulacion;
  const contarPostulaciones = async () => (await e.consulta('SELECT COUNT(*)::int AS n FROM postulacion')).rows[0].n;
  const filaDelPanel = async (id) => {
    const panel = await e.pedir('GET', '/coordinacion/panel?limite=50', { token: tokens.coordinacion });
    return panel.datos.datos.find((p) => p.id_postulacion === id);
  };

  before(async () => {
    e = await crearEntorno();
    for (const [clave, correo] of Object.entries(CUENTAS)) tokens[clave] = await e.ingresar(correo);
    const { rows } = await e.consulta('SELECT titulo FROM oferta_practica WHERE id_oferta = $1', [OFERTA.desarrolloWeb]);
    assert.match(rows[0].titulo, /React/, 'la oferta 1 de la semilla debe ser la de desarrollo web');
  });

  after(async () => {
    try {
      assert.deepEqual(e.errores, [], 'el servidor no debió registrar errores inesperados');
    } finally {
      await e.cerrar();
    }
  });

  test('PI-09 un estudiante se postula con su hoja de vida en PDF; queda "enviada" y la empresa recibe el aviso', async () => {
    const pdf = pdfBase64('Hoja de vida de Julián', 'Ingeniería Informática');
    const r = await e.pedir('POST', `/ofertas/${OFERTA.desarrolloWeb}/postulaciones`, {
      token: tokens.julian,
      cuerpo: cuerpoPostulacion({ hoja_vida: { nombre: 'HV Julián.pdf', contenido_base64: pdf } }),
    });
    assert.equal(r.estado, 201);
    assert.equal(r.datos.estado_postulacion, 'enviada');
    idJulian = r.datos.id_postulacion;

    const { rows } = await e.consulta(
      'SELECT estado_postulacion, hoja_vida_nombre, octet_length(hoja_vida) AS bytes FROM postulacion WHERE id_postulacion = $1',
      [idJulian]
    );
    assert.equal(rows[0].estado_postulacion, 'enviada');
    assert.equal(rows[0].hoja_vida_nombre, 'HV Julián.pdf');
    assert.equal(rows[0].bytes, Buffer.from(pdf, 'base64').length);

    const aviso = e.notificador.bandeja.at(-1);
    assert.deepEqual(aviso.para, [CUENTAS.nodo]);
    assert.match(aviso.asunto, /Nueva postulación para "Practicante de desarrollo web/);

    const propias = await e.pedir('GET', '/postulaciones/mias', { token: tokens.julian });
    assert.ok(propias.datos.datos.some((p) => p.id_postulacion === idJulian && p.estado_postulacion === 'enviada'));
    const recibidas = await e.pedir('GET', `/ofertas/${OFERTA.desarrolloWeb}/postulaciones`, { token: tokens.nodo });
    const fila = recibidas.datos.datos.find((p) => p.id_postulacion === idJulian);
    assert.deepEqual(fila.acciones, ['preseleccionar', 'descartar']);
  });

  test('PI-10 no se acepta una segunda postulación a la misma oferta, ni siquiera con dos envíos simultáneos', async () => {
    const repetida = await e.pedir('POST', `/ofertas/${OFERTA.desarrolloWeb}/postulaciones`, {
      token: tokens.julian,
      cuerpo: cuerpoPostulacion(),
    });
    assert.equal(repetida.estado, 409);
    assert.equal(repetida.datos.error.codigo, 'POSTULACION_DUPLICADA');

    const envio = () =>
      e.pedir('POST', `/ofertas/${OFERTA.qa}/postulaciones`, { token: tokens.valentina, cuerpo: cuerpoPostulacion() });
    const [a, b] = await Promise.all([envio(), envio()]);
    assert.deepEqual([a.estado, b.estado].sort(), [201, 409]);
    const perdedora = a.estado === 409 ? a : b;
    assert.equal(perdedora.datos.error.codigo, 'POSTULACION_DUPLICADA');
    assert.equal(await idPostulacion(CUENTAS.valentina, OFERTA.qa) > 0, true);
    const { rows } = await e.consulta(
      `SELECT COUNT(*)::int AS n FROM postulacion po
         JOIN estudiante s ON s.id_estudiante = po.id_estudiante
         JOIN usuario u ON u.id_usuario = s.id_usuario
        WHERE u.correo_institucional = $1 AND po.id_oferta = $2`,
      [CUENTAS.valentina, OFERTA.qa]
    );
    assert.equal(rows[0].n, 1);
  });

  test('PI-11 la hoja de vida se valida en el servidor: solo PDF, máximo 2 MB y con autorización de datos', async () => {
    const antes = await contarPostulaciones();
    const intento = (cuerpo) => e.pedir('POST', `/ofertas/${OFERTA.datos}/postulaciones`, { token: tokens.mateo, cuerpo });

    const noPdf = await intento(
      cuerpoPostulacion({ hoja_vida: { nombre: 'hv.pdf', contenido_base64: Buffer.from('esto no es un pdf').toString('base64') } })
    );
    assert.equal(noPdf.estado, 422);
    assert.ok(noPdf.datos.error.detalles.hoja_vida);

    const pesado = Buffer.concat([crearPdfMinimo(['x']), Buffer.alloc(2 * 1024 * 1024, 32)]).toString('base64');
    const grande = await intento(cuerpoPostulacion({ hoja_vida: { nombre: 'hv.pdf', contenido_base64: pesado } }));
    assert.equal(grande.estado, 422);
    assert.match(grande.datos.error.detalles.hoja_vida, /no puede superar/);

    const sinAutorizar = await intento(cuerpoPostulacion({ acepta_datos: false }));
    assert.equal(sinAutorizar.estado, 422);
    assert.ok(sinAutorizar.datos.error.detalles.acepta_datos);

    // Un cuerpo por encima del límite de la API ni siquiera se procesa
    const enorme = Buffer.alloc(3.2 * 1024 * 1024).toString('base64');
    const rechazada = await intento(cuerpoPostulacion({ hoja_vida: { nombre: 'hv.pdf', contenido_base64: enorme } }));
    assert.equal(rechazada.estado, 413);
    assert.equal(rechazada.datos.error.codigo, 'CUERPO_MUY_GRANDE');

    assert.equal(await contarPostulaciones(), antes, 'ningún intento inválido debe guardar una postulación');
  });

  test('PI-12 la hoja de vida solo la descarga su dueño, la empresa de la oferta y Coordinación', async () => {
    const ruta = `/postulaciones/${idJulian}/hoja-vida`;
    const original = Buffer.from(pdfBase64('Hoja de vida de Julián', 'Ingeniería Informática'), 'base64');

    for (const clave of ['julian', 'nodo', 'coordinacion']) {
      const r = await e.pedir('GET', ruta, { token: tokens[clave] });
      assert.equal(r.estado, 200, clave);
      assert.equal(r.cabeceras.get('content-type'), 'application/pdf');
      assert.equal(r.cabeceras.get('cache-control'), 'private, no-store');
      assert.match(r.cabeceras.get('content-disposition'), /filename\*=UTF-8''HV%20Juli%C3%A1n\.pdf/);
      assert.equal(Buffer.compare(r.datos, original), 0, `${clave} debe recibir exactamente el archivo cargado`);
    }
    for (const clave of ['camila', 'andina', 'valle']) {
      const r = await e.pedir('GET', ruta, { token: tokens[clave] });
      assert.equal(r.estado, 403, clave);
    }
  });

  test('PI-13 flujo completo: preselección, aviso a Coordinación, aprobación con convenio vigente y cierre automático de la oferta', async () => {
    // 1. La empresa preselecciona y Coordinación recibe el aviso
    const preseleccion = await decidir('preseleccionar', idJulian, tokens.nodo);
    assert.equal(preseleccion.estado, 200);
    assert.equal(preseleccion.datos.estado_postulacion, 'preseleccionada');
    const aviso = e.notificador.bandeja.at(-1);
    assert.deepEqual(aviso.para, [CUENTAS.coordinacion]);
    assert.match(aviso.asunto, /Julián Andrés Ospina Mejía/);

    // 2. Coordinación la ve con el convenio evaluado y las acciones que proceden
    const fila = await filaDelPanel(idJulian);
    assert.equal(fila.convenio.estado, 'vigente');
    assert.deepEqual(fila.acciones, ['aprobar', 'rechazar']);

    // 3. Aprobación: la oferta tiene 2 cupos, así que sigue abierta
    const aprobada = await decidir('aprobar', idJulian, tokens.coordinacion, {});
    assert.equal(aprobada.estado, 200);
    assert.equal(aprobada.datos.estado_postulacion, 'aprobada');
    assert.equal(aprobada.datos.oferta_cerrada, false);
    const { rows } = await e.consulta(
      'SELECT estado_postulacion, fecha_decision, id_usuario_decision FROM postulacion WHERE id_postulacion = $1',
      [idJulian]
    );
    const { rows: coordinacion } = await e.consulta('SELECT id_usuario FROM usuario WHERE correo_institucional = $1', [CUENTAS.coordinacion]);
    assert.equal(rows[0].estado_postulacion, 'aprobada');
    assert.ok(rows[0].fecha_decision);
    assert.equal(rows[0].id_usuario_decision, coordinacion[0].id_usuario);

    // 4. Resultado por correo al estudiante y a la empresa, y visible para el estudiante
    const resultado = e.notificador.bandeja.at(-1);
    assert.deepEqual(resultado.para, [CUENTAS.julian, CUENTAS.nodo]);
    assert.match(resultado.asunto, /fue aprobada/);
    const propias = await e.pedir('GET', '/postulaciones/mias', { token: tokens.julian });
    assert.equal(propias.datos.datos.find((p) => p.id_postulacion === idJulian).estado_postulacion, 'aprobada');

    // 5. La segunda aprobación (Camila, ya preseleccionada en la semilla) ocupa el último cupo y cierra la oferta
    const idCamila = await idPostulacion(CUENTAS.camila, OFERTA.desarrolloWeb);
    const ultima = await decidir('aprobar', idCamila, tokens.coordinacion, {});
    assert.equal(ultima.estado, 200);
    assert.equal(ultima.datos.oferta_cerrada, true);

    const detalle = await e.pedir('GET', `/ofertas/${OFERTA.desarrolloWeb}`, { token: tokens.laura });
    assert.equal(detalle.datos.estado, 'cerrada');
    assert.equal(detalle.datos.aprobadas, 2);
    assert.equal((await e.pedir('GET', '/ofertas?texto=React', { token: tokens.laura })).datos.paginacion.total, 0);

    const tarde = await e.pedir('POST', `/ofertas/${OFERTA.desarrolloWeb}/postulaciones`, {
      token: tokens.laura,
      cuerpo: cuerpoPostulacion(),
    });
    assert.equal(tarde.estado, 409);
    assert.equal(tarde.datos.error.codigo, 'OFERTA_CERRADA');
  });

  test('PI-14 con el convenio vencido no se aprueba: Coordinación devuelve la postulación y, al renovar el convenio, la aprueba', async () => {
    const id = await idPostulacion(CUENTAS.laura, OFERTA.diseno);

    const fila = await filaDelPanel(id);
    assert.equal(fila.convenio.estado, 'vencido');
    assert.deepEqual(fila.acciones, ['rechazar', 'devolver']);

    const bloqueada = await decidir('aprobar', id, tokens.coordinacion, {});
    assert.equal(bloqueada.estado, 409);
    assert.equal(bloqueada.datos.error.codigo, 'CONVENIO_NO_VIGENTE');
    assert.equal(await estadoEnBD(id), 'preseleccionada');

    const sinMotivo = await decidir('devolver', id, tokens.coordinacion, {});
    assert.equal(sinMotivo.estado, 422);
    const devuelta = await decidir('devolver', id, tokens.coordinacion, {
      observacion: 'El convenio con la empresa está vencido; se solicita su renovación.',
    });
    assert.equal(devuelta.estado, 200);
    assert.equal(devuelta.datos.estado_postulacion, 'devuelta');
    const aviso = e.notificador.bandeja.at(-1);
    assert.deepEqual(aviso.para, [CUENTAS.laura, CUENTAS.valle]);
    assert.match(aviso.texto, /renovación/);

    // Coordinación registra el nuevo convenio de la empresa
    const empresas = (await e.pedir('GET', '/empresas', { token: tokens.coordinacion })).datos.datos;
    const valle = empresas.find((empresa) => empresa.nombre === 'Estudio Creativo Valle S.A.S.');
    const nuevo = await e.pedir('POST', '/convenios', {
      token: tokens.coordinacion,
      cuerpo: { id_empresa: valle.id_empresa, fecha_inicio: '2026-11-01', fecha_fin: '2027-11-01' },
    });
    assert.equal(nuevo.estado, 201);
    assert.equal(nuevo.datos.evaluacion.estado, 'vigente');

    const aprobada = await decidir('aprobar', id, tokens.coordinacion, {});
    assert.equal(aprobada.estado, 200);
    assert.equal(aprobada.datos.estado_postulacion, 'aprobada');
    assert.equal(aprobada.datos.convenio.vigente, true);
  });

  test('PI-15 una empresa sin convenio no puede tener aprobaciones; Coordinación puede rechazar con motivo y la decisión es definitiva', async () => {
    const id = await idPostulacion(CUENTAS.valentina, OFERTA.salud);

    const fila = await filaDelPanel(id);
    assert.equal(fila.convenio.estado, 'sin_convenio');
    assert.deepEqual(fila.acciones, ['rechazar', 'devolver']);

    const bloqueada = await decidir('aprobar', id, tokens.coordinacion, {});
    assert.equal(bloqueada.estado, 409);
    assert.equal(bloqueada.datos.error.codigo, 'CONVENIO_NO_VIGENTE');

    const rechazada = await decidir('rechazar', id, tokens.coordinacion, { observacion: 'La empresa aún no tiene convenio con la universidad.' });
    assert.equal(rechazada.estado, 200);
    assert.equal(rechazada.datos.estado_postulacion, 'rechazada');
    assert.deepEqual(e.notificador.bandeja.at(-1).para, [CUENTAS.valentina, CUENTAS.horizonte]);

    const reintento = await decidir('aprobar', id, tokens.coordinacion, {});
    assert.equal(reintento.estado, 409);
    assert.equal(await estadoEnBD(id), 'rechazada');
  });

  test('PI-16 suspender un convenio bloquea las aprobaciones y reactivarlo las habilita; "por vencer" todavía permite aprobar', async () => {
    const id = await idPostulacion(CUENTAS.sebastian, OFERTA.logistica);
    const convenios = (await e.pedir('GET', '/convenios', { token: tokens.coordinacion })).datos.datos;
    const andina = convenios.find((c) => c.empresa_nombre === 'Logística Andina Ltda.');
    assert.equal(andina.evaluacion.estado, 'por_vencer');
    assert.equal(andina.evaluacion.dias_restantes, 18);

    const cambiar = (estado) =>
      e.pedir('PATCH', `/convenios/${andina.id_convenio}/estado`, { token: tokens.coordinacion, cuerpo: { estado } });

    const suspendido = await cambiar('suspendido');
    assert.equal(suspendido.estado, 200);
    assert.equal(suspendido.datos.evaluacion.estado, 'suspendido');
    const bloqueada = await decidir('aprobar', id, tokens.coordinacion, {});
    assert.equal(bloqueada.estado, 409);
    assert.equal(bloqueada.datos.error.codigo, 'CONVENIO_NO_VIGENTE');

    assert.equal((await cambiar('vigente')).datos.evaluacion.estado, 'por_vencer');
    const aprobada = await decidir('aprobar', id, tokens.coordinacion, {});
    assert.equal(aprobada.estado, 200);
    assert.equal(aprobada.datos.convenio.estado, 'por_vencer');
    assert.equal(aprobada.datos.oferta_cerrada, false);

    const invalido = await cambiar('inventado');
    assert.equal(invalido.estado, 422);
  });

  test('PI-17 dos aprobaciones simultáneas sobre una oferta de un solo cupo: una se aprueba y la otra recibe SIN_CUPOS', async () => {
    const nueva = await e.pedir('POST', '/ofertas', {
      token: tokens.nodo,
      cuerpo: cuerpoOferta({ titulo: 'Practicante de arquitectura de software', cupos: 1 }),
    });
    assert.equal(nueva.estado, 201);
    const idOferta = nueva.datos.id_oferta;

    const ids = [];
    for (const clave of ['mateo', 'valentina']) {
      const envio = await e.pedir('POST', `/ofertas/${idOferta}/postulaciones`, { token: tokens[clave], cuerpo: cuerpoPostulacion() });
      assert.equal(envio.estado, 201);
      assert.equal((await decidir('preseleccionar', envio.datos.id_postulacion, tokens.nodo)).estado, 200);
      ids.push(envio.datos.id_postulacion);
    }

    const resultados = await Promise.all(ids.map((id) => decidir('aprobar', id, tokens.coordinacion, {})));
    assert.deepEqual(resultados.map((r) => r.estado).sort(), [200, 409]);
    assert.equal(resultados.find((r) => r.estado === 409).datos.error.codigo, 'SIN_CUPOS');

    const { rows } = await e.consulta(
      `SELECT (SELECT COUNT(*)::int FROM postulacion WHERE id_oferta = $1 AND estado_postulacion = 'aprobada') AS aprobadas,
              (SELECT estado FROM oferta_practica WHERE id_oferta = $1) AS estado_oferta`,
      [idOferta]
    );
    assert.equal(rows[0].aprobadas, 1, 'nunca puede haber más aprobaciones que cupos');
    assert.equal(rows[0].estado_oferta, 'cerrada');
  });

  test('PI-18 el panel de Coordinación coincide con la base de datos: contadores, filtro por estado y paginación', async () => {
    const { rows } = await e.consulta('SELECT estado_postulacion AS estado, COUNT(*)::int AS n FROM postulacion GROUP BY 1');
    const n = (estado) => rows.find((fila) => fila.estado === estado)?.n ?? 0;
    const total = rows.reduce((suma, fila) => suma + fila.n, 0);

    const todas = 'enviada,preseleccionada,descartada,aprobada,rechazada,devuelta';
    const pagina2 = await e.pedir('GET', `/coordinacion/panel?estado=${todas}&limite=4&pagina=2`, { token: tokens.coordinacion });
    assert.equal(pagina2.estado, 200);
    assert.equal(pagina2.datos.paginacion.total, total);
    assert.equal(pagina2.datos.paginacion.paginas, Math.ceil(total / 4));
    assert.equal(pagina2.datos.datos.length, Math.min(4, total - 4));
    assert.equal(pagina2.datos.resumen.pendientes, n('preseleccionada') + n('devuelta'));
    assert.equal(pagina2.datos.resumen.aprobadas, n('aprobada'));
    assert.equal(pagina2.datos.resumen.rechazadas, n('rechazada'));

    const pendientes = await e.pedir('GET', '/coordinacion/panel', { token: tokens.coordinacion });
    assert.deepEqual(pendientes.datos.filtro.estados, ['preseleccionada', 'devuelta']);
    assert.equal(pendientes.datos.paginacion.total, n('preseleccionada') + n('devuelta'));
    assert.ok(pendientes.datos.datos.every((p) => ['preseleccionada', 'devuelta'].includes(p.estado_postulacion)));
  });
});
