'use strict';

// Aplica las migraciones SQL pendientes. Con --reiniciar borra primero todo el esquema (solo desarrollo y pruebas).
const { cargarConfig } = require('../server/config');
const { crearPool } = require('../server/db/pool');
const { migrar } = require('../server/db/migraciones');

async function main() {
  const config = cargarConfig();
  const reiniciar = process.argv.includes('--reiniciar');
  if (reiniciar && config.esProduccion) {
    throw new Error('--reiniciar borra todos los datos y no se permite con NODE_ENV=production.');
  }
  const pool = crearPool(config.databaseUrl, { ssl: config.databaseSsl });
  try {
    const nuevas = await migrar(pool, { reiniciar });
    console.log(nuevas.length > 0 ? `Migraciones aplicadas: ${nuevas.join(', ')}` : 'La base de datos ya está al día.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Error en la migración:', error.message);
  process.exit(1);
});
