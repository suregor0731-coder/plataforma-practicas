'use strict';

const { Pool } = require('pg');

function crearPool(databaseUrl, { ssl = false, max = 10 } = {}) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
  });
  // Un error en una conexión inactiva no debe tumbar el proceso
  pool.on('error', (error) => console.error('[pg] error en una conexión inactiva:', error.message));
  return pool;
}

/**
 * Ejecuta "trabajo(cliente)" dentro de una transacción: si algo falla se hace ROLLBACK
 * y el error original se vuelve a lanzar.
 */
async function conTransaccion(pool, trabajo) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    try {
      await cliente.query('ROLLBACK');
    } catch {
      // si el ROLLBACK también falla, interesa más el error original
    }
    throw error;
  } finally {
    cliente.release();
  }
}

module.exports = { crearPool, conTransaccion };
