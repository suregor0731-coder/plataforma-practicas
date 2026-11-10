'use strict';

const { exigir, validarOferta, normalizarFiltrosOfertas } = require('../utils/validadores');
const { evaluarOferta } = require('../utils/ofertas');
const { evaluarMejorConvenio } = require('../utils/convenios');
const { hoyISO } = require('../utils/fechas');
const { noEncontrado, prohibido, invalido, conflicto } = require('../utils/errores');
const { quitarTotal } = require('./presentadores');

function crearOfertaService({ pool, repos, reloj }) {
  const hoy = () => hoyISO(reloj());

  async function listarPublicas(consulta) {
    const filtros = normalizarFiltrosOfertas(consulta);
    const { filas, total } = await repos.oferta.listarPublicas(pool, filtros, hoy());
    return {
      datos: filas.map(quitarTotal),
      paginacion: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        paginas: Math.max(1, Math.ceil(total / filtros.limite)),
      },
    };
  }

  /** Detalle de una oferta; para un estudiante incluye si ya se postuló y si todavía puede hacerlo. */
  async function obtenerDetalle(usuario, idOferta) {
    const oferta = await repos.oferta.detalle(pool, idOferta);
    if (!oferta) throw noEncontrado('La oferta no existe.');
    const convenios = await repos.convenio.listarPorEmpresa(pool, oferta.id_empresa);
    const respuesta = {
      ...oferta,
      disponibilidad: evaluarOferta(oferta, hoy()),
      convenio: evaluarMejorConvenio(convenios, hoy()),
    };
    if (usuario.id_estudiante) {
      const previa = await repos.postulacion.buscarPorEstudianteYOferta(pool, usuario.id_estudiante, idOferta);
      respuesta.mi_postulacion = previa || null;
    }
    return respuesta;
  }

  async function publicar(usuario, cuerpo) {
    if (!usuario.id_empresa) throw prohibido('Solo las empresas pueden publicar ofertas.');
    const fecha = hoy();
    const datos = exigir(validarOferta(cuerpo, { hoy: fecha }));
    if (datos.id_programa && !(await repos.catalogo.existePrograma(pool, datos.id_programa))) {
      throw invalido({ id_programa: 'El programa seleccionado no existe.' });
    }
    const { id_oferta: idOferta } = await repos.oferta.insertar(pool, {
      ...datos,
      id_empresa: usuario.id_empresa,
      fecha_publicacion: fecha,
    });
    return repos.oferta.detalle(pool, idOferta);
  }

  function listarDeEmpresa(usuario) {
    return repos.oferta.listarDeEmpresa(pool, usuario.id_empresa);
  }

  /** La empresa propietaria cierra su oferta o la vuelve a abrir (si aún tiene cupos y no venció). */
  async function cambiarEstado(usuario, idOferta, cuerpo = {}) {
    const oferta = await repos.oferta.detalle(pool, idOferta);
    if (!oferta) throw noEncontrado('La oferta no existe.');
    if (oferta.id_empresa !== usuario.id_empresa) throw prohibido('La oferta pertenece a otra empresa.');
    const estado = cuerpo.estado;
    if (estado !== 'abierta' && estado !== 'cerrada') {
      throw invalido({ estado: 'El estado debe ser "abierta" o "cerrada".' });
    }
    if (estado === 'abierta') {
      const revision = evaluarOferta({ ...oferta, estado: 'abierta' }, hoy());
      if (!revision.disponible) throw conflicto(revision.codigo, `No se puede reabrir la oferta: ${revision.mensaje}`);
    }
    await repos.oferta.cambiarEstado(pool, idOferta, estado);
    return repos.oferta.detalle(pool, idOferta);
  }

  return { listarPublicas, obtenerDetalle, publicar, listarDeEmpresa, cambiarEstado };
}

module.exports = { crearOfertaService };
