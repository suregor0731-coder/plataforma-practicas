'use strict';

const { cargarConfig } = require('./config');
const { crearPool } = require('./db/pool');
const { migrar } = require('./db/migraciones');
const { crearApp } = require('./app');
const { crearNotificadorConsola } = require('./integrations/correo');

async function iniciar() {
  const config = cargarConfig();
  const pool = crearPool(config.databaseUrl, { ssl: config.databaseSsl });

  if (config.autoMigrar) {
    const nuevas = await migrar(pool);
    if (nuevas.length > 0) console.log(`[db] migraciones aplicadas: ${nuevas.join(', ')}`);
  }

  const { app } = crearApp({ config, pool, notificador: crearNotificadorConsola() });
  const servidor = app.listen(config.puerto, () => {
    console.log(`Servidor listo en http://localhost:${config.puerto} (${config.entorno})`);
  });

  // Cierre ordenado: deja de aceptar conexiones y libera el pool de la base de datos
  const cerrar = (senal) => {
    console.log(`\n${senal} recibida: cerrando el servidor...`);
    servidor.close(() => {
      pool.end().then(() => process.exit(0), () => process.exit(1));
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => cerrar('SIGINT'));
  process.on('SIGTERM', () => cerrar('SIGTERM'));
}

iniciar().catch((error) => {
  console.error('No se pudo iniciar el servidor:', error.message);
  process.exit(1);
});
