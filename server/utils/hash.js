'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

// Parámetros de scrypt recomendados para contraseñas de usuario (N = 2^14, r = 8, p = 1)
const COSTO = 16384;
const BLOQUE = 8;
const PARALELISMO = 1;
const LONGITUD = 64;

/**
 * Genera el hash de una contraseña con sal aleatoria.
 * Formato guardado: scrypt$N$r$p$sal$hash (sal y hash en base64).
 */
async function hashear(contrasena) {
  const sal = crypto.randomBytes(16);
  const derivada = await scrypt(contrasena, sal, LONGITUD, { N: COSTO, r: BLOQUE, p: PARALELISMO });
  return ['scrypt', COSTO, BLOQUE, PARALELISMO, sal.toString('base64'), derivada.toString('base64')].join('$');
}

/** Compara una contraseña con un hash guardado usando una comparación de tiempo constante. */
async function verificarClave(contrasena, almacenado) {
  const partes = String(almacenado).split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, costo, bloque, paralelismo, salB64, hashB64] = partes;
  const sal = Buffer.from(salB64, 'base64');
  const esperado = Buffer.from(hashB64, 'base64');
  const derivada = await scrypt(String(contrasena), sal, esperado.length, {
    N: Number(costo),
    r: Number(bloque),
    p: Number(paralelismo),
  });
  return derivada.length === esperado.length && crypto.timingSafeEqual(derivada, esperado);
}

module.exports = { hashear, verificarClave };
