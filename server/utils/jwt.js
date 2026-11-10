'use strict';

const crypto = require('node:crypto');

/**
 * Tokens JWT firmados con HMAC-SHA256 (alg HS256), usando solo el módulo crypto de Node.js.
 * Estructura: base64url(encabezado).base64url(carga).base64url(firma)
 */

class ErrorToken extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorToken';
    this.codigo = codigo; // TOKEN_INVALIDO | TOKEN_EXPIRADO
  }
}

const codificar = (valor) => Buffer.from(valor).toString('base64url');
const firmaDe = (datos, secreto) => crypto.createHmac('sha256', secreto).update(datos).digest();

/** Crea un token con fecha de emisión (iat) y de vencimiento (exp) en segundos Unix. */
function firmar(carga, secreto, { expiraSegundos = 7200, ahora = Date.now() } = {}) {
  const emitido = Math.floor(ahora / 1000);
  const cuerpo = { ...carga, iat: emitido, exp: emitido + expiraSegundos };
  const datos = `${codificar(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${codificar(JSON.stringify(cuerpo))}`;
  return `${datos}.${firmaDe(datos, secreto).toString('base64url')}`;
}

/** Verifica firma, algoritmo y vencimiento. Devuelve la carga o lanza ErrorToken. */
function verificar(token, secreto, { ahora = Date.now() } = {}) {
  if (typeof token !== 'string') throw new ErrorToken('TOKEN_INVALIDO', 'Token ausente o mal formado.');
  const partes = token.split('.');
  if (partes.length !== 3) throw new ErrorToken('TOKEN_INVALIDO', 'Token ausente o mal formado.');
  const [encabezadoB64, cargaB64, firmaB64] = partes;

  let encabezado;
  try {
    encabezado = JSON.parse(Buffer.from(encabezadoB64, 'base64url').toString('utf8'));
  } catch {
    throw new ErrorToken('TOKEN_INVALIDO', 'Token ausente o mal formado.');
  }
  // Se exige HS256 de forma explícita: así no se acepta "alg: none" ni otros algoritmos
  if (!encabezado || encabezado.alg !== 'HS256') throw new ErrorToken('TOKEN_INVALIDO', 'Algoritmo no permitido.');

  const esperada = firmaDe(`${encabezadoB64}.${cargaB64}`, secreto);
  const recibida = Buffer.from(firmaB64, 'base64url');
  if (recibida.length !== esperada.length || !crypto.timingSafeEqual(recibida, esperada)) {
    throw new ErrorToken('TOKEN_INVALIDO', 'La firma del token no es válida.');
  }

  let carga;
  try {
    carga = JSON.parse(Buffer.from(cargaB64, 'base64url').toString('utf8'));
  } catch {
    throw new ErrorToken('TOKEN_INVALIDO', 'Token ausente o mal formado.');
  }
  if (typeof carga.exp !== 'number' || carga.exp <= Math.floor(ahora / 1000)) {
    throw new ErrorToken('TOKEN_EXPIRADO', 'La sesión expiró. Inicie sesión nuevamente.');
  }
  return carga;
}

module.exports = { firmar, verificar, ErrorToken };
