'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { firmar, verificar, ErrorToken } = require('../../server/utils/jwt');
const { hashear, verificarClave } = require('../../server/utils/hash');
const { crearLimitador } = require('../../server/utils/limitador');
const { cargarConfig } = require('../../server/config');

const SECRETO = 'secreto-de-prueba-con-mas-de-16-caracteres';
const AHORA = Date.parse('2026-11-09T15:00:00Z');
const codigoDe = (codigo) => (error) => error instanceof ErrorToken && error.codigo === codigo;

describe('Tokens JWT', () => {
  test('PU-38 un token firmado se verifica y devuelve su carga', () => {
    const token = firmar({ sub: 7, rol: 'estudiante' }, SECRETO, { ahora: AHORA, expiraSegundos: 600 });
    const carga = verificar(token, SECRETO, { ahora: AHORA + 1000 });
    assert.equal(carga.sub, 7);
    assert.equal(carga.rol, 'estudiante');
    assert.equal(carga.exp - carga.iat, 600);
  });

  test('PU-39 un token con la carga alterada se rechaza por firma inválida', () => {
    const token = firmar({ sub: 7, rol: 'estudiante' }, SECRETO, { ahora: AHORA });
    const [encabezado, , firma] = token.split('.');
    const cargaFalsa = Buffer.from(JSON.stringify({ sub: 7, rol: 'coordinacion', exp: 9999999999 })).toString('base64url');
    assert.throws(() => verificar(`${encabezado}.${cargaFalsa}.${firma}`, SECRETO, { ahora: AHORA }), codigoDe('TOKEN_INVALIDO'));
  });

  test('PU-40 un token vencido se rechaza con TOKEN_EXPIRADO', () => {
    const token = firmar({ sub: 7 }, SECRETO, { ahora: AHORA, expiraSegundos: 60 });
    assert.throws(() => verificar(token, SECRETO, { ahora: AHORA + 61 * 1000 }), codigoDe('TOKEN_EXPIRADO'));
  });

  test('PU-41 un token con "alg: none" o firmado con otro secreto no se acepta', () => {
    const sinFirma = [
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ sub: 1, rol: 'coordinacion', exp: 9999999999 })).toString('base64url'),
      '',
    ].join('.');
    assert.throws(() => verificar(sinFirma, SECRETO, { ahora: AHORA }), codigoDe('TOKEN_INVALIDO'));

    const ajeno = firmar({ sub: 1 }, 'otro-secreto-distinto-de-16-o-mas', { ahora: AHORA });
    assert.throws(() => verificar(ajeno, SECRETO, { ahora: AHORA }), codigoDe('TOKEN_INVALIDO'));
  });

  test('PU-42 un valor que no es un token se rechaza sin lanzar errores inesperados', () => {
    for (const basura of [undefined, null, '', 'abc', 'a.b', 'a.b.c', 123]) {
      assert.throws(() => verificar(basura, SECRETO, { ahora: AHORA }), (e) => e instanceof ErrorToken);
    }
  });
});

describe('Contraseñas', () => {
  test('PU-43 la contraseña se guarda con scrypt y sal aleatoria, y solo la clave correcta valida', async () => {
    const hash1 = await hashear('Clave2026x');
    const hash2 = await hashear('Clave2026x');
    assert.match(hash1, /^scrypt\$16384\$8\$1\$/);
    assert.notEqual(hash1, hash2); // la sal distinta produce hashes distintos
    assert.equal(hash1.includes('Clave2026x'), false);
    assert.equal(await verificarClave('Clave2026x', hash1), true);
    assert.equal(await verificarClave('clave2026x', hash1), false);
  });

  test('PU-44 un hash guardado con formato inválido nunca valida', async () => {
    assert.equal(await verificarClave('lo-que-sea', 'texto-plano'), false);
    assert.equal(await verificarClave('lo-que-sea', undefined), false);
    assert.equal(await verificarClave('lo-que-sea', 'bcrypt$1$2$3$4$5'), false);
  });
});

describe('Limitador de intentos de ingreso', () => {
  test('PU-45 tras 5 fallos la clave se bloquea y se libera al terminar la ventana de tiempo', () => {
    let reloj = 0;
    const limitador = crearLimitador({ max: 5, ventanaMs: 15 * 60 * 1000, ahora: () => reloj });
    for (let i = 0; i < 4; i += 1) limitador.registrarFallo('ip|correo');
    assert.equal(limitador.bloqueado('ip|correo'), false);
    limitador.registrarFallo('ip|correo');
    assert.equal(limitador.bloqueado('ip|correo'), true);
    assert.equal(limitador.bloqueado('otra-ip|correo'), false); // el bloqueo es por clave
    reloj = 15 * 60 * 1000;
    assert.equal(limitador.bloqueado('ip|correo'), false);
  });

  test('PU-46 un ingreso correcto reinicia el contador de fallos', () => {
    const limitador = crearLimitador({ max: 3 });
    limitador.registrarFallo('k');
    limitador.registrarFallo('k');
    limitador.limpiar('k');
    limitador.registrarFallo('k');
    assert.equal(limitador.bloqueado('k'), false);
  });
});

describe('Configuración', () => {
  test('PU-47 en producción se exige un JWT_SECRET de al menos 16 caracteres', () => {
    assert.throws(() => cargarConfig({ NODE_ENV: 'production' }), /JWT_SECRET/);
    assert.throws(() => cargarConfig({ NODE_ENV: 'production', JWT_SECRET: 'corto' }), /JWT_SECRET/);
    const config = cargarConfig({ NODE_ENV: 'production', JWT_SECRET: SECRETO });
    assert.equal(config.jwt.secreto, SECRETO);
    assert.equal(config.esProduccion, true);
  });

  test('PU-48 en desarrollo se usa una clave por defecto y se leen los valores del entorno', () => {
    const config = cargarConfig({ PORT: '4000', DATABASE_URL: 'postgres://x', LOG_PETICIONES: '0' });
    assert.equal(config.puerto, 4000);
    assert.equal(config.databaseUrl, 'postgres://x');
    assert.equal(config.registrarPeticiones, false);
    assert.ok(config.jwt.secreto.length >= 16);
  });
});
