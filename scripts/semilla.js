'use strict';

// Carga los datos de demostración (ficticios) en una base vacía.
const { cargarConfig } = require('../server/config');
const { crearPool } = require('../server/db/pool');
const { sembrar } = require('../server/db/semilla');

async function main() {
  const config = cargarConfig();
  if (config.esProduccion) throw new Error('Los datos de demostración no se cargan con NODE_ENV=production.');
  const pool = crearPool(config.databaseUrl, { ssl: config.databaseSsl });
  try {
    const resultado = await sembrar(pool);
    if (resultado.omitido) {
      console.log('La base de datos ya tiene cuentas; no se cargó nada. Use "npm run db:reiniciar" para empezar de cero.');
      return;
    }
    console.log('Datos de demostración cargados.');
    console.log(`Contraseña de todas las cuentas: ${resultado.clave}\n`);
    for (const cuenta of resultado.cuentas) {
      console.log(`  ${cuenta.rol.padEnd(13)} ${cuenta.correo.padEnd(36)} ${cuenta.nombre}`);
    }
    console.log(
      `\n${resultado.totales.programas} programas, ${resultado.totales.estudiantes} estudiantes, ` +
        `${resultado.totales.empresas} empresas, ${resultado.totales.ofertas} ofertas, ` +
        `${resultado.totales.postulaciones} postulaciones.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Error al cargar los datos de demostración:', error.message);
  process.exit(1);
});
