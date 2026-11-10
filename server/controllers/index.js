'use strict';

const { solicitudInvalida } = require('../utils/errores');
const { TRANSICIONES } = require('../utils/estados');

/** Lee un identificador numérico de la ruta (/ofertas/:id) y rechaza lo que no sea un entero positivo. */
function idParametro(req, nombre = 'id') {
  const valor = String(req.params[nombre]);
  if (!/^\d{1,9}$/.test(valor) || Number(valor) < 1) {
    throw solicitudInvalida('ID_INVALIDO', 'El identificador indicado no es válido.');
  }
  return Number(valor);
}

// En Express 5, req.body es undefined cuando la petición no trae cuerpo
const cuerpoDe = (req) => req.body ?? {};

/** Valor para el parámetro filename* de Content-Disposition (RFC 5987). */
const codificarNombre = (nombre) =>
  encodeURIComponent(nombre).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * Controladores HTTP: leen la petición, llaman al servicio y arman la respuesta. La lógica de
 * negocio vive en los servicios; los errores que lanzan llegan al manejador de errores
 * (Express 5 reenvía solo las promesas rechazadas de los controladores async).
 */
function crearControladores(servicios) {
  return {
    salud: async (req, res) => {
      try {
        await servicios.salud();
        res.json({ estado: 'ok', base_de_datos: 'ok' });
      } catch {
        res.status(503).json({ estado: 'degradado', base_de_datos: 'sin respuesta' });
      }
    },

    programas: async (req, res) => res.json({ datos: await servicios.catalogo.programas() }),
    empresas: async (req, res) => res.json({ datos: await servicios.catalogo.empresas() }),

    // Cuentas
    registrarEstudiante: async (req, res) => res.status(201).json(await servicios.auth.registrarEstudiante(cuerpoDe(req))),
    registrarEmpresa: async (req, res) => res.status(201).json(await servicios.auth.registrarEmpresa(cuerpoDe(req))),
    iniciarSesion: async (req, res) => res.json(await servicios.auth.iniciarSesion(cuerpoDe(req), req.ip)),
    yo: (req, res) => {
      const usuario = { ...req.usuario };
      delete usuario.estado;
      res.json({ usuario });
    },

    // Ofertas
    listarOfertas: async (req, res) => res.json(await servicios.ofertas.listarPublicas(req.query)),
    ofertasDeEmpresa: async (req, res) => res.json({ datos: await servicios.ofertas.listarDeEmpresa(req.usuario) }),
    publicarOferta: async (req, res) => res.status(201).json(await servicios.ofertas.publicar(req.usuario, cuerpoDe(req))),
    detalleOferta: async (req, res) => res.json(await servicios.ofertas.obtenerDetalle(req.usuario, idParametro(req))),
    estadoOferta: async (req, res) =>
      res.json(await servicios.ofertas.cambiarEstado(req.usuario, idParametro(req), cuerpoDe(req))),

    // Postulaciones
    postular: async (req, res) =>
      res.status(201).json(await servicios.postulaciones.postular(req.usuario, idParametro(req), cuerpoDe(req))),
    postulacionesMias: async (req, res) => res.json({ datos: await servicios.postulaciones.listarMias(req.usuario) }),
    postulantesDeOferta: async (req, res) =>
      res.json(await servicios.postulaciones.listarDeOferta(req.usuario, idParametro(req))),
    hojaDeVida: async (req, res) => {
      const hoja = await servicios.postulaciones.obtenerHojaVida(req.usuario, idParametro(req));
      const respaldoAscii = hoja.nombre.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `inline; filename="${respaldoAscii}"; filename*=UTF-8''${codificarNombre(hoja.nombre)}`);
      res.set('Cache-Control', 'private, no-store');
      res.send(hoja.contenido);
    },
    /** Devuelve el controlador de una acción de la máquina de estados (preseleccionar, aprobar...). */
    decidir: (accion) => async (req, res) => {
      const id = idParametro(req);
      const resultado =
        TRANSICIONES[accion].rol === 'empresa'
          ? await servicios.postulaciones.decidirEmpresa(req.usuario, id, accion)
          : await servicios.postulaciones.decidirCoordinacion(req.usuario, id, accion, cuerpoDe(req));
      res.json(resultado);
    },

    // Coordinación y convenios
    panel: async (req, res) => res.json(await servicios.coordinacion.panel(req.query)),
    listarConvenios: async (req, res) => res.json({ datos: await servicios.convenios.listar(req.usuario) }),
    registrarConvenio: async (req, res) => res.status(201).json(await servicios.convenios.registrar(cuerpoDe(req))),
    estadoConvenio: async (req, res) =>
      res.json(await servicios.convenios.cambiarEstado(idParametro(req), cuerpoDe(req))),
  };
}

module.exports = { crearControladores, idParametro };
