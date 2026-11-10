'use strict';

const { evaluarMejorConvenio } = require('../utils/convenios');
const { accionesPermitidas } = require('../utils/estados');
const { hoyISO } = require('../utils/fechas');

const ESTADOS = ['enviada', 'preseleccionada', 'descartada', 'aprobada', 'rechazada', 'devuelta'];
// Lo que espera una decisión de Coordinación
const PENDIENTES = ['preseleccionada', 'devuelta'];

function leerEstados(valor) {
  const pedidos = String(valor || '')
    .split(',')
    .map((estado) => estado.trim())
    .filter((estado) => ESTADOS.includes(estado));
  return pedidos.length > 0 ? [...new Set(pedidos)] : PENDIENTES;
}

function enteroPositivo(valor, defecto, maximo) {
  const numero = Number.parseInt(valor, 10);
  if (!Number.isInteger(numero) || numero < 1) return defecto;
  return Math.min(numero, maximo);
}

function agruparPorEmpresa(convenios) {
  const mapa = new Map();
  for (const convenio of convenios) {
    if (!mapa.has(convenio.id_empresa)) mapa.set(convenio.id_empresa, []);
    mapa.get(convenio.id_empresa).push(convenio);
  }
  return mapa;
}

function crearCoordinacionService({ pool, repos, reloj }) {
  /**
   * Panel de Coordinación: contadores generales, estado de los convenios y la lista paginada de
   * postulaciones, cada una con el convenio de su empresa evaluado y las acciones que se pueden ejecutar.
   */
  async function panel(consulta = {}) {
    const hoy = hoyISO(reloj());
    const estados = leerEstados(consulta.estado);
    const pagina = enteroPositivo(consulta.pagina, 1, 100000);
    const limite = enteroPositivo(consulta.limite, 10, 50);

    const filas = await repos.postulacion.listarPorEstados(pool, estados, {
      limite,
      desplazamiento: (pagina - 1) * limite,
    });
    const conteos = await repos.postulacion.contarPorEstado(pool);
    const conveniosPorEmpresa = agruparPorEmpresa(await repos.convenio.listarTodos(pool));
    const empresas = await repos.usuario.listarEmpresas(pool);

    const resumenConvenios = { vigentes: 0, por_vencer: 0, sin_vigencia: 0 };
    for (const empresa of empresas) {
      const evaluacion = evaluarMejorConvenio(conveniosPorEmpresa.get(empresa.id_empresa) || [], hoy);
      if (evaluacion.estado === 'vigente') resumenConvenios.vigentes += 1;
      else if (evaluacion.estado === 'por_vencer') resumenConvenios.por_vencer += 1;
      else resumenConvenios.sin_vigencia += 1;
    }

    const cuantas = (lista) => lista.reduce((suma, estado) => suma + (conteos[estado] || 0), 0);
    const total = filas.length > 0 ? filas[0].total : 0;

    return {
      resumen: {
        pendientes: cuantas(PENDIENTES),
        aprobadas: cuantas(['aprobada']),
        rechazadas: cuantas(['rechazada']),
        convenios: resumenConvenios,
      },
      filtro: { estados },
      datos: filas.map((fila) => {
        const { total: _total, ...postulacion } = fila; // eslint-disable-line no-unused-vars
        const convenio = evaluarMejorConvenio(conveniosPorEmpresa.get(fila.id_empresa) || [], hoy);
        return { ...postulacion, convenio, acciones: accionesPermitidas(fila.estado_postulacion, convenio) };
      }),
      paginacion: { pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)) },
    };
  }

  return { panel };
}

module.exports = { crearCoordinacionService, ESTADOS, PENDIENTES };
