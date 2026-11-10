'use strict';

const { crearLimitador } = require('../utils/limitador');
const { crearAuthService } = require('./authService');
const { crearOfertaService } = require('./ofertaService');
const { crearPostulacionService } = require('./postulacionService');
const { crearConvenioService } = require('./convenioService');
const { crearCoordinacionService } = require('./coordinacionService');

/**
 * Arma todos los servicios con sus dependencias (inyección manual). En las pruebas unitarias se
 * pasan repositorios falsos y un reloj fijo; en la aplicación, los repositorios SQL y el reloj real.
 */
function crearServicios({ config, pool, transaccion, repos, notificador, reloj = () => new Date(), limitador, registrar }) {
  const limite = limitador || crearLimitador();
  return {
    auth: crearAuthService({ config, pool, transaccion, repos, reloj, limitador: limite }),
    ofertas: crearOfertaService({ pool, repos, reloj }),
    postulaciones: crearPostulacionService({ config, pool, transaccion, repos, notificador, reloj, registrar }),
    convenios: crearConvenioService({ pool, repos, reloj }),
    coordinacion: crearCoordinacionService({ pool, repos, reloj }),
    catalogo: {
      programas: () => repos.catalogo.listarProgramas(pool),
      empresas: () => repos.usuario.listarEmpresas(pool),
    },
    /** Comprobación de salud: falla si la base de datos no responde. */
    salud: async () => {
      await pool.query('SELECT 1');
    },
  };
}

module.exports = { crearServicios };
