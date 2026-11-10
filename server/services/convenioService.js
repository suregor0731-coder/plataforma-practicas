'use strict';

const { exigir, validarConvenio, validarEstadoConvenio } = require('../utils/validadores');
const { evaluarConvenio } = require('../utils/convenios');
const { hoyISO } = require('../utils/fechas');
const { noEncontrado, invalido } = require('../utils/errores');

function crearConvenioService({ pool, repos, reloj }) {
  const hoy = () => hoyISO(reloj());
  const conEvaluacion = (convenio, fecha) => ({ ...convenio, evaluacion: evaluarConvenio(convenio, fecha) });

  /** Coordinación ve todos los convenios; una empresa solo los suyos. */
  async function listar(usuario) {
    const fecha = hoy();
    const filas =
      usuario.rol === 'empresa'
        ? await repos.convenio.listarPorEmpresa(pool, usuario.id_empresa)
        : await repos.convenio.listarTodos(pool);
    return filas.map((convenio) => conEvaluacion(convenio, fecha));
  }

  async function registrar(cuerpo) {
    const datos = exigir(validarConvenio(cuerpo));
    if (!(await repos.convenio.existeEmpresa(pool, datos.id_empresa))) {
      throw invalido({ id_empresa: 'La empresa seleccionada no existe.' });
    }
    const { id_convenio: idConvenio } = await repos.convenio.insertar(pool, datos);
    return conEvaluacion(await repos.convenio.buscarPorId(pool, idConvenio), hoy());
  }

  async function cambiarEstado(idConvenio, cuerpo) {
    const { estado } = exigir(validarEstadoConvenio(cuerpo));
    if (!(await repos.convenio.buscarPorId(pool, idConvenio))) throw noEncontrado('El convenio no existe.');
    await repos.convenio.cambiarEstado(pool, idConvenio, estado);
    return conEvaluacion(await repos.convenio.buscarPorId(pool, idConvenio), hoy());
  }

  return { listar, registrar, cambiarEstado };
}

module.exports = { crearConvenioService };
