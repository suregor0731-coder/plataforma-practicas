'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { crearEntorno, CUENTAS, CLAVE_DEMO, AHORA, cuerpoOferta } = require('../ayudas/entorno');

describe('API: cuentas, sesión y ofertas (PostgreSQL real)', () => {
  let e;

  before(async () => {
    e = await crearEntorno();
  });

  after(async () => {
    try {
      assert.deepEqual(e.errores, [], 'el servidor no debió registrar errores inesperados');
    } finally {
      await e.cerrar();
    }
  });

  test('PI-01 el servidor responde, está conectado a PostgreSQL y el catálogo trae los 5 programas de la semilla', async () => {
    const salud = await e.pedir('GET', '/salud');
    assert.equal(salud.estado, 200);
    assert.deepEqual(salud.datos, { estado: 'ok', base_de_datos: 'ok' });

    const programas = await e.pedir('GET', '/programas');
    assert.equal(programas.estado, 200);
    assert.equal(programas.datos.datos.length, 5);
  });

  test('PI-02 el registro de un estudiante crea la cuenta con la contraseña cifrada y guarda la autorización de datos', async () => {
    const { rows: programa } = await e.consulta("SELECT id_programa FROM programa_academico WHERE nombre = 'Ingeniería Informática'");
    const correo = 'daniela.mejia@practicas.demo';
    const registro = await e.pedir('POST', '/auth/registro/estudiante', {
      cuerpo: {
        nombre: 'Daniela Mejía Rojas',
        documento: '1000555001',
        correo,
        contrasena: 'Clave2026x',
        id_programa: programa[0].id_programa,
        semestre: 9,
        acepta_datos: true,
      },
    });
    assert.equal(registro.estado, 201);
    assert.ok(registro.datos.token);
    assert.equal(registro.datos.usuario.rol, 'estudiante');
    assert.equal(JSON.stringify(registro.datos).includes('hash'), false);

    const { rows } = await e.consulta(
      'SELECT hash_contrasena, consentimiento_datos, fecha_consentimiento FROM usuario WHERE correo_institucional = $1',
      [correo]
    );
    assert.match(rows[0].hash_contrasena, /^scrypt\$/);
    assert.equal(rows[0].consentimiento_datos, true);
    assert.ok(rows[0].fecha_consentimiento);

    assert.ok(await e.ingresar(correo, 'Clave2026x'), 'la cuenta recién creada debe poder ingresar');
  });

  test('PI-03 los duplicados de correo, documento y NIT se detectan con las restricciones UNIQUE reales y no dejan registros a medias', async () => {
    const { rows: programa } = await e.consulta("SELECT id_programa FROM programa_academico WHERE nombre = 'Ingeniería Informática'");
    const estudiante = (cambios) => ({
      nombre: 'Andrea Gil Mora',
      documento: '1000555002',
      correo: 'andrea.gil@practicas.demo',
      contrasena: 'Clave2026x',
      id_programa: programa[0].id_programa,
      semestre: 8,
      acepta_datos: true,
      ...cambios,
    });
    const empresa = (cambios) => ({
      nombre: 'Soluciones Aurora S.A.S.',
      nit: '900777888-5',
      sector: 'Servicios',
      correo: 'contacto@aurora.demo',
      contrasena: 'Clave2026x',
      acepta_datos: true,
      ...cambios,
    });
    const cuentasCon = async (correo) =>
      (await e.consulta('SELECT COUNT(*)::int AS n FROM usuario WHERE correo_institucional = $1', [correo])).rows[0].n;

    const correoRepetido = await e.pedir('POST', '/auth/registro/estudiante', { cuerpo: estudiante({ correo: CUENTAS.camila }) });
    assert.equal(correoRepetido.estado, 409);
    assert.equal(correoRepetido.datos.error.codigo, 'CORREO_DUPLICADO');

    // El documento se verifica al insertar el estudiante, después de crear el usuario: la transacción debe revertir ambos
    const documentoRepetido = await e.pedir('POST', '/auth/registro/estudiante', { cuerpo: estudiante({ documento: '1000123401' }) });
    assert.equal(documentoRepetido.estado, 409);
    assert.equal(documentoRepetido.datos.error.codigo, 'DOCUMENTO_DUPLICADO');
    assert.equal(await cuentasCon('andrea.gil@practicas.demo'), 0);

    const nitRepetido = await e.pedir('POST', '/auth/registro/empresa', { cuerpo: empresa({ nit: '900123456-1' }) });
    assert.equal(nitRepetido.estado, 409);
    assert.equal(nitRepetido.datos.error.codigo, 'NIT_DUPLICADO');
    assert.equal(await cuentasCon('contacto@aurora.demo'), 0);

    const nueva = await e.pedir('POST', '/auth/registro/empresa', { cuerpo: empresa() });
    assert.equal(nueva.estado, 201);
    assert.equal(nueva.datos.usuario.rol, 'empresa');
  });

  test('PI-04 el ingreso valida las credenciales; un token alterado, vencido o de una cuenta desactivada no da acceso', async () => {
    const acceso = await e.pedir('POST', '/auth/login', { cuerpo: { correo: CUENTAS.camila, contrasena: CLAVE_DEMO } });
    assert.equal(acceso.estado, 200);
    assert.equal(acceso.datos.usuario.rol, 'estudiante');
    assert.equal(acceso.datos.usuario.nombre, 'Camila Restrepo Gómez');
    assert.equal(JSON.stringify(acceso.datos).includes('hash'), false);
    const token = acceso.datos.token;

    const yo = await e.pedir('GET', '/auth/me', { token });
    assert.equal(yo.estado, 200);
    assert.equal(yo.datos.usuario.correo, CUENTAS.camila);

    // Contraseña errónea y correo inexistente: la misma respuesta, para no revelar qué correos existen
    const claveMala = await e.pedir('POST', '/auth/login', { cuerpo: { correo: CUENTAS.camila, contrasena: 'Incorrecta123' } });
    const correoMalo = await e.pedir('POST', '/auth/login', { cuerpo: { correo: 'nadie@practicas.demo', contrasena: 'Incorrecta123' } });
    assert.equal(claveMala.estado, 401);
    assert.deepEqual(claveMala.datos, correoMalo.datos);

    const sinToken = await e.pedir('GET', '/auth/me');
    assert.equal(sinToken.estado, 401);
    assert.equal(sinToken.datos.error.codigo, 'NO_AUTENTICADO');

    const [encabezado, carga, firma] = token.split('.');
    const alterado = [encabezado, carga, (firma[0] === 'A' ? 'B' : 'A') + firma.slice(1)].join('.');
    const conFirmaMala = await e.pedir('GET', '/auth/me', { token: alterado });
    assert.equal(conFirmaMala.estado, 401);
    assert.equal(conFirmaMala.datos.error.codigo, 'TOKEN_INVALIDO');

    e.reloj.ahora = new Date(AHORA.getTime() + 3 * 60 * 60 * 1000); // el token dura 2 horas
    try {
      const vencido = await e.pedir('GET', '/auth/me', { token });
      assert.equal(vencido.estado, 401);
      assert.equal(vencido.datos.error.codigo, 'TOKEN_EXPIRADO');
    } finally {
      e.reloj.ahora = AHORA;
    }

    // Una cuenta desactivada pierde el acceso de inmediato, aunque conserve un token vigente
    await e.consulta("UPDATE usuario SET estado = 'inactivo' WHERE correo_institucional = $1", [CUENTAS.camila]);
    try {
      const inactiva = await e.pedir('GET', '/auth/me', { token });
      assert.equal(inactiva.estado, 401);
      assert.equal(inactiva.datos.error.codigo, 'CUENTA_NO_DISPONIBLE');
      const reingreso = await e.pedir('POST', '/auth/login', { cuerpo: { correo: CUENTAS.camila, contrasena: CLAVE_DEMO } });
      assert.equal(reingreso.estado, 401);
    } finally {
      await e.consulta("UPDATE usuario SET estado = 'activo' WHERE correo_institucional = $1", [CUENTAS.camila]);
    }
  });

  test('PI-05 cada rol solo accede a lo suyo: las acciones de otro rol se responden con 403', async () => {
    const camila = await e.ingresar(CUENTAS.camila);
    const nodo = await e.ingresar(CUENTAS.nodo);
    const coordinacion = await e.ingresar(CUENTAS.coordinacion);
    const convenio = { id_empresa: 1, fecha_inicio: '2026-11-01', fecha_fin: '2027-11-01' };

    const casos = [
      ['un estudiante no publica ofertas', 'POST', '/ofertas', camila, cuerpoOferta()],
      ['un estudiante no ve las ofertas de una empresa', 'GET', '/ofertas/mias', camila],
      ['una empresa no se postula', 'POST', '/ofertas/1/postulaciones', nodo, {}],
      ['una empresa no aprueba', 'POST', '/postulaciones/1/aprobar', nodo, {}],
      ['Coordinación no preselecciona', 'POST', '/postulaciones/1/preseleccionar', coordinacion, {}],
      ['un estudiante no abre el panel de Coordinación', 'GET', '/coordinacion/panel', camila],
      ['una empresa no abre el panel de Coordinación', 'GET', '/coordinacion/panel', nodo],
      ['una empresa no registra convenios', 'POST', '/convenios', nodo, convenio],
      ['un estudiante no lista convenios', 'GET', '/convenios', camila],
    ];
    for (const [descripcion, metodo, ruta, token, cuerpo] of casos) {
      const r = await e.pedir(metodo, ruta, { token, cuerpo });
      assert.equal(r.estado, 403, descripcion);
      assert.equal(r.datos.error.codigo, 'PROHIBIDO', descripcion);
    }
  });

  test('PI-06 una empresa publica una oferta que aparece en el listado; los datos inválidos se rechazan con 422', async () => {
    const nodo = await e.ingresar(CUENTAS.nodo);

    const invalida = await e.pedir('POST', '/ofertas', {
      token: nodo,
      cuerpo: cuerpoOferta({ cupos: 0, fecha_cierre: '2026-11-01', modalidad: 'nocturna' }),
    });
    assert.equal(invalida.estado, 422);
    assert.equal(invalida.datos.error.codigo, 'VALIDACION');
    assert.deepEqual(Object.keys(invalida.datos.error.detalles).sort(), ['cupos', 'fecha_cierre', 'modalidad']);

    const creada = await e.pedir('POST', '/ofertas', { token: nodo, cuerpo: cuerpoOferta({ fecha_cierre: '2026-12-20' }) });
    assert.equal(creada.estado, 201);
    assert.equal(creada.datos.estado, 'abierta');
    assert.equal(creada.datos.empresa_nombre, 'Nodo Digital S.A.S.');
    assert.equal(creada.datos.fecha_publicacion, '2026-11-09');
    assert.equal(creada.datos.fecha_cierre, '2026-12-20');

    const camila = await e.ingresar(CUENTAS.camila);
    const listado = await e.pedir('GET', `/ofertas?texto=${encodeURIComponent('integración de sistemas')}`, { token: camila });
    assert.equal(listado.datos.paginacion.total, 1);
    assert.equal(listado.datos.datos[0].id_oferta, creada.datos.id_oferta);

    const propias = await e.pedir('GET', '/ofertas/mias', { token: nodo });
    assert.ok(propias.datos.datos.some((oferta) => oferta.id_oferta === creada.datos.id_oferta));
  });

  test('PI-07 el listado filtra, pagina y oculta lo que no se puede postular; el texto de búsqueda no inyecta SQL', async () => {
    const camila = await e.ingresar(CUENTAS.camila);
    const listar = (consulta) => e.pedir('GET', `/ofertas${consulta}`, { token: camila });

    // Hay 6 ofertas de la semilla abiertas y vigentes (las 2 cerradas no aparecen) más la publicada en PI-06
    const todas = await listar('');
    const total = todas.datos.paginacion.total;
    assert.equal(total, 7);
    assert.equal(todas.datos.datos.length, 4, 'la página trae 4 ofertas por defecto');
    assert.equal(todas.datos.paginacion.paginas, 2);
    assert.equal((await listar('?pagina=2')).datos.datos.length, total - 4);

    assert.equal((await listar('?modalidad=remota')).datos.paginacion.total, 2);
    assert.equal((await listar('?ciudad=cali')).datos.paginacion.total, 1);
    assert.equal((await listar('?texto=react')).datos.paginacion.total, 1);
    const { rows: informatica } = await e.consulta("SELECT id_programa FROM programa_academico WHERE nombre = 'Ingeniería Informática'");
    assert.equal((await listar(`?id_programa=${informatica[0].id_programa}`)).datos.paginacion.total, 3);
    assert.equal((await listar('?texto=Auxiliar%20de%20mejoramiento')).datos.paginacion.total, 0, 'una oferta cerrada no se lista');

    // Los comodines de LIKE y los intentos de inyección se tratan como texto
    for (const peligro of ["%25", "_", "'%20OR%20'1'='1", "';%20DROP%20TABLE%20usuario;%20--"]) {
      assert.equal((await listar(`?texto=${peligro}`)).datos.paginacion.total, 0, `texto=${peligro}`);
    }
    const { rows: usuarios } = await e.consulta('SELECT COUNT(*)::int AS n FROM usuario');
    assert.ok(usuarios[0].n >= 12, 'la tabla usuario sigue intacta');

    // Con el reloj 60 días adelante vencen las ofertas con fecha de cierre; solo quedan las de cierre abierto
    e.reloj.ahora = new Date(AHORA.getTime() + 60 * 24 * 60 * 60 * 1000);
    try {
      const luego = await e.ingresar(CUENTAS.camila);
      const vigentes = await e.pedir('GET', '/ofertas', { token: luego });
      assert.equal(vigentes.datos.paginacion.total, 2);
    } finally {
      e.reloj.ahora = AHORA;
    }
  });

  test('PI-08 el detalle de una oferta incluye el estado del convenio de la empresa y la postulación previa del estudiante', async () => {
    const camila = await e.ingresar(CUENTAS.camila);
    const julian = await e.ingresar(CUENTAS.julian);

    const conPostulacion = await e.pedir('GET', '/ofertas/1', { token: camila });
    assert.equal(conPostulacion.estado, 200);
    assert.equal(conPostulacion.datos.convenio.estado, 'vigente');
    assert.equal(conPostulacion.datos.disponibilidad.disponible, true);
    assert.equal(conPostulacion.datos.mi_postulacion.estado_postulacion, 'preseleccionada');

    const sinPostulacion = await e.pedir('GET', '/ofertas/1', { token: julian });
    assert.equal(sinPostulacion.datos.mi_postulacion, null);

    const esperado = { 4: 'por_vencer', 6: 'vencido', 7: 'sin_convenio' }; // ofertas de Andina, Valle y Horizonte
    for (const [id, estado] of Object.entries(esperado)) {
      const r = await e.pedir('GET', `/ofertas/${id}`, { token: camila });
      assert.equal(r.datos.convenio.estado, estado, `oferta ${id}`);
    }

    const inexistente = await e.pedir('GET', '/ofertas/9999', { token: camila });
    assert.equal(inexistente.estado, 404);
    const mal = await e.pedir('GET', '/ofertas/abc', { token: camila });
    assert.equal(mal.estado, 400);
    assert.equal(mal.datos.error.codigo, 'ID_INVALIDO');
  });
});
