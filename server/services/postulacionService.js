'use strict';

const { exigir, validarPostulacion, validarDecision } = require('../utils/validadores');
const { evaluarOferta } = require('../utils/ofertas');
const { evaluarMejorConvenio } = require('../utils/convenios');
const { aplicarTransicion, accionesPermitidas } = require('../utils/estados');
const { hoyISO } = require('../utils/fechas');
const { noEncontrado, prohibido, conflicto } = require('../utils/errores');
const { esUnica } = require('../utils/pgErrores');
const { mensajePostulacionRecibida, mensajePreseleccion, mensajeDecision } = require('../utils/plantillas');

const duplicada = () => conflicto('POSTULACION_DUPLICADA', 'Ya se postuló a esta oferta.');

function crearPostulacionService({ config, pool, transaccion, repos, notificador, reloj, registrar = console.error }) {
  const hoy = () => hoyISO(reloj());

  /** Las notificaciones son de "mejor esfuerzo": si el correo falla, la operación ya hecha no se deshace. */
  async function avisar(mensaje, para) {
    const destinatarios = para.filter(Boolean);
    if (destinatarios.length === 0) return;
    try {
      await notificador.enviar({ para: destinatarios, asunto: mensaje.asunto, texto: mensaje.texto });
    } catch (error) {
      registrar('[correo] no se pudo enviar la notificación:', error.message);
    }
  }

  async function postular(usuario, idOferta, cuerpo) {
    if (!usuario.id_estudiante) throw prohibido('Solo los estudiantes pueden postularse a una oferta.');
    const datos = exigir(validarPostulacion(cuerpo, { maxBytes: config.hojaVida.maxBytes }));

    const oferta = await repos.oferta.detalle(pool, idOferta);
    if (!oferta) throw noEncontrado('La oferta no existe.');
    const disponibilidad = evaluarOferta(oferta, hoy());
    if (!disponibilidad.disponible) throw conflicto(disponibilidad.codigo, disponibilidad.mensaje);
    if (await repos.postulacion.buscarPorEstudianteYOferta(pool, usuario.id_estudiante, idOferta)) throw duplicada();

    let creada;
    try {
      creada = await repos.postulacion.insertar(pool, {
        idEstudiante: usuario.id_estudiante,
        idOferta,
        carta: datos.carta_presentacion,
        hojaVida: datos.hoja_vida.contenido,
        hojaVidaNombre: datos.hoja_vida.nombre,
      });
    } catch (error) {
      // Dos envíos simultáneos pueden pasar la revisión anterior; la restricción UNIQUE de la base los frena
      if (esUnica(error, 'postulacion')) throw duplicada();
      throw error;
    }

    const detalle = await repos.postulacion.buscarPorId(pool, creada.id_postulacion);
    await avisar(mensajePostulacionRecibida(detalle), [detalle.empresa_correo]);
    return detalle;
  }

  function listarMias(usuario) {
    return repos.postulacion.listarDeEstudiante(pool, usuario.id_estudiante);
  }

  /** Postulantes de una oferta; solo los ve la empresa propietaria. */
  async function listarDeOferta(usuario, idOferta) {
    const oferta = await repos.oferta.detalle(pool, idOferta);
    if (!oferta) throw noEncontrado('La oferta no existe.');
    if (oferta.id_empresa !== usuario.id_empresa) throw prohibido('La oferta pertenece a otra empresa.');
    const filas = await repos.postulacion.listarDeOferta(pool, idOferta);
    return {
      oferta,
      datos: filas.map((fila) => ({ ...fila, acciones: accionesPermitidas(fila.estado_postulacion, null, 'empresa') })),
    };
  }

  async function obtenerHojaVida(usuario, idPostulacion) {
    const fila = await repos.postulacion.obtenerHojaVida(pool, idPostulacion);
    if (!fila || !fila.hoja_vida) throw noEncontrado('La postulación no tiene una hoja de vida adjunta.');
    const autorizado =
      usuario.rol === 'coordinacion' ||
      (usuario.rol === 'estudiante' && fila.usuario_estudiante === usuario.id_usuario) ||
      (usuario.rol === 'empresa' && fila.id_empresa === usuario.id_empresa);
    if (!autorizado) throw prohibido('No tiene acceso a esta hoja de vida.');
    return { nombre: fila.hoja_vida_nombre, contenido: fila.hoja_vida };
  }

  /** La empresa preselecciona o descarta una postulación recibida. */
  async function decidirEmpresa(usuario, idPostulacion, accion) {
    const actualizada = await transaccion(async (db) => {
      const actual = await repos.postulacion.buscarPorId(db, idPostulacion, { bloquear: true });
      if (!actual) throw noEncontrado('La postulación no existe.');
      if (actual.id_empresa !== usuario.id_empresa) throw prohibido('La postulación pertenece a otra empresa.');
      const nuevoEstado = aplicarTransicion(accion, actual.estado_postulacion, 'empresa');
      await repos.postulacion.actualizarEstado(db, idPostulacion, nuevoEstado);
      return { ...actual, estado_postulacion: nuevoEstado };
    });
    if (accion === 'preseleccionar') {
      const correos = await repos.usuario.listarCorreosPorRol(pool, 'coordinacion');
      await avisar(mensajePreseleccion(actualizada), correos);
    }
    return actualizada;
  }

  /**
   * Coordinación aprueba, rechaza o devuelve una postulación preseleccionada.
   * Todo ocurre en una transacción: se bloquea la postulación y luego la oferta, de modo que dos
   * aprobaciones simultáneas de la misma oferta se ejecutan una tras otra y no superan los cupos.
   */
  async function decidirCoordinacion(usuario, idPostulacion, accion, cuerpo) {
    const { observacion } = exigir(validarDecision(cuerpo, accion));
    const fecha = hoy();

    const resultado = await transaccion(async (db) => {
      const actual = await repos.postulacion.buscarPorId(db, idPostulacion, { bloquear: true });
      if (!actual) throw noEncontrado('La postulación no existe.');
      await repos.oferta.bloquear(db, actual.id_oferta);

      const convenios = await repos.convenio.listarPorEmpresa(db, actual.id_empresa);
      const convenio = evaluarMejorConvenio(convenios, fecha);
      const nuevoEstado = aplicarTransicion(accion, actual.estado_postulacion, 'coordinacion', { convenio });

      let cierraOferta = false;
      if (accion === 'aprobar') {
        // Se cuenta después de tomar el bloqueo, en una consulta aparte, para ver las aprobaciones ya confirmadas
        const oferta = await repos.oferta.detalle(db, actual.id_oferta);
        const libres = oferta.cupos - oferta.aprobadas;
        if (libres <= 0) throw conflicto('SIN_CUPOS', 'La oferta ya no tiene cupos disponibles.');
        cierraOferta = libres === 1;
      }

      await repos.postulacion.actualizarDecision(db, idPostulacion, {
        estado: nuevoEstado,
        observacion,
        idUsuario: usuario.id_usuario,
      });
      if (cierraOferta) await repos.oferta.cambiarEstado(db, actual.id_oferta, 'cerrada');

      return {
        postulacion: { ...actual, estado_postulacion: nuevoEstado, observacion_decision: observacion },
        convenio,
        ofertaCerrada: cierraOferta,
      };
    });

    const { postulacion, convenio, ofertaCerrada } = resultado;
    await avisar(mensajeDecision(postulacion, postulacion.estado_postulacion, observacion), [
      postulacion.estudiante_correo,
      postulacion.empresa_correo,
    ]);
    return { ...postulacion, convenio, oferta_cerrada: ofertaCerrada };
  }

  return { postular, listarMias, listarDeOferta, obtenerHojaVida, decidirEmpresa, decidirCoordinacion };
}

module.exports = { crearPostulacionService };
