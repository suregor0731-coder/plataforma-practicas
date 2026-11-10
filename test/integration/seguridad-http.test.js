'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { migrar } = require('../../server/db/migraciones');
const { crearEntorno, CUENTAS, CLAVE_DEMO } = require('../ayudas/entorno');

describe('API: seguridad de las respuestas, entradas malformadas y base de datos (PostgreSQL real)', () => {
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

  test('PI-19 las respuestas llevan las cabeceras de seguridad y la API no se guarda en cachés compartidas', async () => {
    const r = await e.pedir('GET', '/salud');
    const cabecera = (nombre) => r.cabeceras.get(nombre);
    assert.match(cabecera('content-security-policy'), /default-src 'self'/);
    assert.match(cabecera('content-security-policy'), /frame-ancestors 'none'/);
    assert.match(cabecera('content-security-policy'), /object-src 'none'/);
    assert.equal(cabecera('x-content-type-options'), 'nosniff');
    assert.equal(cabecera('x-frame-options'), 'DENY');
    assert.equal(cabecera('referrer-policy'), 'no-referrer');
    assert.equal(cabecera('cache-control'), 'no-store');
    assert.equal(cabecera('x-powered-by'), null, 'no debe anunciar la tecnología del servidor');
  });

  test('PI-20 las entradas malformadas reciben errores controlados en JSON, sin detalles internos', async () => {
    const jsonRoto = await e.pedir('POST', '/auth/login', { cuerpo: '{"correo": ' });
    assert.equal(jsonRoto.estado, 400);
    assert.equal(jsonRoto.datos.error.codigo, 'JSON_INVALIDO');

    const sinCuerpo = await e.pedir('POST', '/auth/login');
    assert.equal(sinCuerpo.estado, 422);

    // Sin sesión la API no confirma qué rutas existen; con sesión, una ruta desconocida da 404
    const sinSesion = await e.pedir('GET', '/no-existe');
    assert.equal(sinSesion.estado, 401);

    const token = await e.ingresar(CUENTAS.camila);
    const rutaFalsa = await e.pedir('GET', '/no-existe', { token });
    assert.equal(rutaFalsa.estado, 404);
    assert.equal(rutaFalsa.datos.error.codigo, 'RUTA_NO_ENCONTRADA');

    for (const id of ['0', '-1', 'abc', '1;DROP', '99999999999']) {
      const r = await e.pedir('GET', `/ofertas/${encodeURIComponent(id)}`, { token });
      assert.equal(r.estado, 400, `id=${id}`);
      assert.equal(r.datos.error.codigo, 'ID_INVALIDO');
    }

    const inyeccion = await e.pedir('POST', '/auth/login', { cuerpo: { correo: "' OR '1'='1", contrasena: "' OR 1=1 --" } });
    assert.ok([401, 422].includes(inyeccion.estado), `estado ${inyeccion.estado}`);
    const { rows } = await e.consulta('SELECT COUNT(*)::int AS n FROM usuario');
    assert.equal(rows[0].n, 12);
    for (const respuesta of [jsonRoto, sinCuerpo, rutaFalsa, inyeccion]) {
      assert.equal(JSON.stringify(respuesta.datos).includes('at '), false, 'la respuesta no debe incluir trazas de pila');
    }
  });

  test('PI-21 tras 5 intentos fallidos el ingreso se bloquea con 429, solo para esa cuenta', async () => {
    const mal = { correo: CUENTAS.mateo, contrasena: 'Incorrecta123' };
    for (let i = 0; i < 5; i += 1) {
      const r = await e.pedir('POST', '/auth/login', { cuerpo: mal });
      assert.equal(r.estado, 401, `intento ${i + 1}`);
    }
    const bloqueado = await e.pedir('POST', '/auth/login', { cuerpo: { correo: CUENTAS.mateo, contrasena: CLAVE_DEMO } });
    assert.equal(bloqueado.estado, 429);
    assert.equal(bloqueado.datos.error.codigo, 'DEMASIADOS_INTENTOS');

    const otraCuenta = await e.pedir('POST', '/auth/login', { cuerpo: { correo: CUENTAS.laura, contrasena: CLAVE_DEMO } });
    assert.equal(otraCuenta.estado, 200);
  });

  test('PI-22 las migraciones son idempotentes y la base respeta sus restricciones aunque se salte la API', async () => {
    assert.deepEqual(await migrar(e.pool), [], 'una segunda corrida no debe aplicar nada');
    const { rows } = await e.consulta('SELECT COUNT(*)::int AS n FROM schema_migrations');
    assert.equal(rows[0].n, 2);

    const rechaza = (sql, parametros) => assert.rejects(e.consulta(sql, parametros), (error) => error.code !== undefined);
    // Cupos no positivos, estados inventados y una postulación repetida los frena PostgreSQL por sí mismo
    await rechaza("UPDATE oferta_practica SET cupos = 0 WHERE id_oferta = 1");
    await rechaza("UPDATE postulacion SET estado_postulacion = 'inventado' WHERE id_postulacion = 1");
    await rechaza(
      `INSERT INTO postulacion (id_estudiante, id_oferta)
         SELECT id_estudiante, id_oferta FROM postulacion WHERE id_postulacion = 1`
    );
    await rechaza("UPDATE convenio SET fecha_fin = fecha_inicio WHERE id_convenio = 1");
  });
});
