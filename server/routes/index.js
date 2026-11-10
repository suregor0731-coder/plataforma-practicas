'use strict';

const express = require('express');
const { exigirRol } = require('../middlewares/autenticacion');
const { TRANSICIONES } = require('../utils/estados');

/** Tabla de rutas de la API (se monta en /api/v1). El rol permitido de cada ruta se declara aquí. */
function crearRutas({ controladores: c, autenticar }) {
  const router = express.Router();
  const estudiante = exigirRol('estudiante');
  const empresa = exigirRol('empresa');
  const coordinacion = exigirRol('coordinacion');

  // Rutas públicas
  router.get('/salud', c.salud);
  router.get('/programas', c.programas);
  router.post('/auth/registro/estudiante', c.registrarEstudiante);
  router.post('/auth/registro/empresa', c.registrarEmpresa);
  router.post('/auth/login', c.iniciarSesion);

  // Desde aquí hace falta iniciar sesión
  router.use(autenticar);
  router.get('/auth/me', c.yo);

  // Ofertas (el orden importa: "mias" debe declararse antes que ":id")
  router.get('/ofertas', c.listarOfertas);
  router.get('/ofertas/mias', empresa, c.ofertasDeEmpresa);
  router.post('/ofertas', empresa, c.publicarOferta);
  router.get('/ofertas/:id', c.detalleOferta);
  router.patch('/ofertas/:id/estado', empresa, c.estadoOferta);
  router.get('/ofertas/:id/postulaciones', empresa, c.postulantesDeOferta);
  router.post('/ofertas/:id/postulaciones', estudiante, c.postular);

  // Postulaciones
  router.get('/postulaciones/mias', estudiante, c.postulacionesMias);
  router.get('/postulaciones/:id/hoja-vida', c.hojaDeVida);
  for (const [accion, regla] of Object.entries(TRANSICIONES)) {
    router.post(`/postulaciones/:id/${accion}`, exigirRol(regla.rol), c.decidir(accion));
  }

  // Coordinación y convenios
  router.get('/coordinacion/panel', coordinacion, c.panel);
  router.get('/empresas', coordinacion, c.empresas);
  router.get('/convenios', exigirRol('coordinacion', 'empresa'), c.listarConvenios);
  router.post('/convenios', coordinacion, c.registrarConvenio);
  router.patch('/convenios/:id/estado', coordinacion, c.estadoConvenio);

  return router;
}

module.exports = { crearRutas };
