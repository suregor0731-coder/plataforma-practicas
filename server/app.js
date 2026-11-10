'use strict';

const express = require('express');
const { conTransaccion } = require('./db/pool');
const repos = require('./repositories');
const { crearServicios } = require('./services');
const { crearControladores } = require('./controllers');
const { crearRutas } = require('./routes');
const { crearAutenticacion } = require('./middlewares/autenticacion');
const { seguridad } = require('./middlewares/seguridad');
const { registroPeticiones } = require('./middlewares/registroPeticiones');
const { rutaNoEncontrada, manejadorErrores } = require('./middlewares/errores');
const { fallbackSpa } = require('./middlewares/spa');
const { crearNotificadorConsola } = require('./integrations/correo');

/**
 * Construye la aplicación Express sin arrancarla, para poder usarla tanto en el servidor real
 * como en las pruebas de integración (que le pasan una base de pruebas, un notificador en
 * memoria y un reloj controlado).
 */
function crearApp({ config, pool, notificador = crearNotificadorConsola(), reloj = () => new Date(), registrar, limitador }) {
  const servicios = crearServicios({
    config,
    pool,
    transaccion: (trabajo) => conTransaccion(pool, trabajo),
    repos,
    notificador,
    reloj,
    limitador,
    registrar,
  });
  const controladores = crearControladores(servicios);
  const autenticar = crearAutenticacion({ config, servicios, reloj });

  const app = express();
  app.disable('x-powered-by');
  app.use(seguridad);
  if (config.registrarPeticiones) app.use(registroPeticiones());
  app.use(express.json({ limit: config.limiteJson }));

  app.use('/api/v1', crearRutas({ controladores, autenticar }));
  app.use('/api', rutaNoEncontrada);

  // Interfaz web compilada (React) y respaldo para sus rutas del lado del cliente
  app.use(express.static(config.carpetaWeb));
  app.use(fallbackSpa(config.carpetaWeb));

  app.use(manejadorErrores({ registrar }));
  return { app, servicios };
}

module.exports = { crearApp };
