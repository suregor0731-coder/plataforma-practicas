'use strict';

const path = require('node:path');

/**
 * Lee la configuración desde las variables de entorno.
 * Se recibe "env" como parámetro para poder probarla sin tocar process.env.
 */
function cargarConfig(env = process.env) {
  const entorno = env.NODE_ENV || 'development';
  const esProduccion = entorno === 'production';

  let secreto = env.JWT_SECRET;
  if (!secreto || secreto.length < 16) {
    if (esProduccion) {
      throw new Error('Defina JWT_SECRET (mínimo 16 caracteres) para ejecutar en producción.');
    }
    secreto = 'clave-solo-para-desarrollo-local-no-usar-en-produccion';
  }

  return {
    entorno,
    esProduccion,
    puerto: Number(env.PORT) || 3000,
    databaseUrl: env.DATABASE_URL || 'postgres://practicas:practicas@localhost:5432/practicas',
    databaseSsl: env.DATABASE_SSL === 'true',
    jwt: {
      secreto,
      expiraSegundos: Number(env.JWT_EXPIRA_SEGUNDOS) || 7200,
    },
    hojaVida: { maxBytes: 2 * 1024 * 1024 },
    limiteJson: '3mb',
    registrarPeticiones: env.LOG_PETICIONES !== '0',
    autoMigrar: env.AUTO_MIGRAR !== '0',
    carpetaWeb: path.join(__dirname, '..', 'web', 'dist'),
  };
}

module.exports = { cargarConfig };
