'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const CARPETA = path.join(__dirname, '..', '..', 'database', 'migrations');

/**
 * Aplica, en orden, los archivos database/migrations/NNN_nombre.sql que todavía no se hayan
 * ejecutado. El control queda en la tabla schema_migrations (versionado del esquema).
 * Con { reiniciar: true } se borra todo el esquema antes; solo para desarrollo y pruebas.
 */
async function migrar(pool, { reiniciar = false } = {}) {
  if (reiniciar) {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (' +
      'version VARCHAR(100) PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now())'
  );
  const { rows } = await pool.query('SELECT version FROM schema_migrations');
  const aplicadas = new Set(rows.map((fila) => fila.version));

  const archivos = (await fs.readdir(CARPETA)).filter((nombre) => /^\d+_.+\.sql$/.test(nombre)).sort();
  const nuevas = [];
  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const sql = await fs.readFile(path.join(CARPETA, archivo), 'utf8');
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(sql);
      await cliente.query('INSERT INTO schema_migrations (version) VALUES ($1)', [archivo]);
      await cliente.query('COMMIT');
      nuevas.push(archivo);
    } catch (error) {
      try {
        await cliente.query('ROLLBACK');
      } catch {
        // se conserva el error original
      }
      throw new Error(`Falló la migración ${archivo}: ${error.message}`);
    } finally {
      cliente.release();
    }
  }
  return nuevas;
}

module.exports = { migrar };
