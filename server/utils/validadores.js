'use strict';

const { invalido } = require('./errores');
const { esFechaISO } = require('./fechas');

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MODALIDADES = ['presencial', 'hibrida', 'remota'];
const ESTADOS_CONVENIO = ['vigente', 'suspendido', 'terminado'];

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

function entero(valor) {
  if (typeof valor === 'number' && Number.isInteger(valor)) return valor;
  if (typeof valor === 'string' && /^-?\d+$/.test(valor.trim())) return Number(valor.trim());
  return Number.NaN;
}

/**
 * Cada validador devuelve { errores, datos }: "errores" tiene un mensaje por campo inválido
 * y "datos" los valores ya limpios. "exigir" convierte los errores en una excepción 422.
 */
function exigir(resultado) {
  if (Object.keys(resultado.errores).length > 0) throw invalido(resultado.errores);
  return resultado.datos;
}

function revisarCorreo(valor, errores, campo = 'correo') {
  const correo = texto(valor).toLowerCase();
  if (!RE_CORREO.test(correo) || correo.length > 160) errores[campo] = 'Escriba un correo electrónico válido.';
  return correo;
}

function revisarContrasena(clave, errores, campo = 'contrasena') {
  if (typeof clave !== 'string' || clave.length < 8) {
    errores[campo] = 'La contraseña debe tener al menos 8 caracteres.';
  } else if (clave.length > 128) {
    errores[campo] = 'La contraseña es demasiado larga.';
  } else if (!/[A-Za-z]/.test(clave) || !/\d/.test(clave)) {
    errores[campo] = 'La contraseña debe combinar letras y números.';
  }
}

function validarRegistroEstudiante(c = {}) {
  const errores = {};
  const nombre = texto(c.nombre);
  if (nombre.length < 3 || nombre.length > 120) errores.nombre = 'Escriba su nombre completo (de 3 a 120 caracteres).';
  const documento = texto(c.documento);
  if (!/^\d{5,15}$/.test(documento)) errores.documento = 'El documento debe tener entre 5 y 15 dígitos.';
  const correo = revisarCorreo(c.correo, errores);
  revisarContrasena(c.contrasena, errores);
  const idPrograma = entero(c.id_programa);
  if (!(idPrograma > 0)) errores.id_programa = 'Seleccione su programa académico.';
  const semestre = entero(c.semestre);
  if (!(semestre >= 1 && semestre <= 12)) errores.semestre = 'El semestre debe estar entre 1 y 12.';
  if (c.acepta_datos !== true) errores.acepta_datos = 'Debe autorizar el tratamiento de sus datos personales.';
  return { errores, datos: { nombre, documento, correo, contrasena: c.contrasena, id_programa: idPrograma, semestre } };
}

function validarRegistroEmpresa(c = {}) {
  const errores = {};
  const nombre = texto(c.nombre);
  if (nombre.length < 3 || nombre.length > 160) errores.nombre = 'Escriba la razón social (de 3 a 160 caracteres).';
  const nit = texto(c.nit);
  if (!/^\d{6,12}(-\d)?$/.test(nit)) errores.nit = 'El NIT debe tener de 6 a 12 dígitos, con dígito de verificación opcional (900123456-7).';
  const sector = texto(c.sector);
  if (sector.length < 3 || sector.length > 80) errores.sector = 'Indique el sector de la empresa.';
  const correo = revisarCorreo(c.correo, errores);
  revisarContrasena(c.contrasena, errores);
  if (c.acepta_datos !== true) errores.acepta_datos = 'Debe autorizar el tratamiento de los datos de contacto.';
  return { errores, datos: { nombre, nit, sector, correo, contrasena: c.contrasena } };
}

function validarLogin(c = {}) {
  const errores = {};
  const correo = texto(c.correo).toLowerCase();
  if (!correo) errores.correo = 'Escriba su correo.';
  if (typeof c.contrasena !== 'string' || c.contrasena.length === 0) errores.contrasena = 'Escriba su contraseña.';
  return { errores, datos: { correo, contrasena: c.contrasena } };
}

function validarOferta(c = {}, { hoy } = {}) {
  const errores = {};
  const titulo = texto(c.titulo);
  if (titulo.length < 5 || titulo.length > 160) errores.titulo = 'El título debe tener entre 5 y 160 caracteres.';
  const descripcion = texto(c.descripcion);
  if (descripcion.length < 20 || descripcion.length > 4000) errores.descripcion = 'La descripción debe tener entre 20 y 4000 caracteres.';
  const requisitos = texto(c.requisitos);
  if (requisitos.length > 2000) errores.requisitos = 'Los requisitos no pueden superar 2000 caracteres.';
  const cupos = entero(c.cupos);
  if (!(cupos >= 1 && cupos <= 50)) errores.cupos = 'Los cupos deben estar entre 1 y 50.';
  const ciudad = texto(c.ciudad);
  if (ciudad.length < 2 || ciudad.length > 80) errores.ciudad = 'Indique la ciudad.';
  const modalidad = texto(c.modalidad);
  if (!MODALIDADES.includes(modalidad)) errores.modalidad = 'Elija presencial, híbrida o remota.';
  let idPrograma = null;
  if (c.id_programa !== undefined && c.id_programa !== null && c.id_programa !== '') {
    idPrograma = entero(c.id_programa);
    if (!(idPrograma > 0)) errores.id_programa = 'El programa seleccionado no es válido.';
  }
  let fechaCierre = null;
  if (c.fecha_cierre !== undefined && c.fecha_cierre !== null && c.fecha_cierre !== '') {
    if (!esFechaISO(c.fecha_cierre)) errores.fecha_cierre = 'Use una fecha válida (AAAA-MM-DD).';
    else if (hoy && c.fecha_cierre < hoy) errores.fecha_cierre = 'La fecha de cierre no puede ser anterior a hoy.';
    else fechaCierre = c.fecha_cierre;
  }
  return {
    errores,
    datos: { titulo, descripcion, requisitos, cupos, ciudad, modalidad, id_programa: idPrograma, fecha_cierre: fechaCierre },
  };
}

/** Revisa el PDF enviado en base64: extensión, tamaño y encabezado "%PDF-". */
function revisarHojaDeVida(hoja, maxBytes, errores) {
  if (!hoja || typeof hoja !== 'object' || typeof hoja.nombre !== 'string' || typeof hoja.contenido_base64 !== 'string') {
    errores.hoja_vida = 'Adjunte su hoja de vida en formato PDF.';
    return null;
  }
  const nombre = hoja.nombre.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 160);
  if (!/\.pdf$/i.test(nombre)) {
    errores.hoja_vida = 'El archivo debe tener extensión .pdf.';
    return null;
  }
  const base64 = hoja.contenido_base64.replace(/\s+/g, '');
  if (base64.length === 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    errores.hoja_vida = 'No se pudo leer el archivo adjunto.';
    return null;
  }
  const limiteMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
  if (Math.floor((base64.length * 3) / 4) > maxBytes + 3) {
    errores.hoja_vida = `La hoja de vida no puede superar ${limiteMb} MB.`;
    return null;
  }
  const contenido = Buffer.from(base64, 'base64');
  if (contenido.length > maxBytes) {
    errores.hoja_vida = `La hoja de vida no puede superar ${limiteMb} MB.`;
    return null;
  }
  if (contenido.subarray(0, 5).toString('latin1') !== '%PDF-') {
    errores.hoja_vida = 'El archivo no es un PDF válido.';
    return null;
  }
  return { nombre, contenido };
}

function validarPostulacion(c = {}, { maxBytes }) {
  const errores = {};
  const carta = texto(c.carta_presentacion);
  if (carta.length > 1500) errores.carta_presentacion = 'La carta no puede superar 1500 caracteres.';
  if (c.acepta_datos !== true) errores.acepta_datos = 'Debe autorizar el tratamiento de sus datos personales.';
  const hoja = revisarHojaDeVida(c.hoja_vida, maxBytes, errores);
  return { errores, datos: { carta_presentacion: carta, hoja_vida: hoja } };
}

/** El motivo es obligatorio cuando Coordinación rechaza o devuelve una postulación. */
function validarDecision(c = {}, accion) {
  const errores = {};
  const observacion = texto(c.observacion);
  if ((accion === 'rechazar' || accion === 'devolver') && observacion.length < 5) {
    errores.observacion = 'Escriba el motivo (mínimo 5 caracteres).';
  }
  if (observacion.length > 500) errores.observacion = 'El texto no puede superar 500 caracteres.';
  return { errores, datos: { observacion: observacion || null } };
}

function validarConvenio(c = {}) {
  const errores = {};
  const idEmpresa = entero(c.id_empresa);
  if (!(idEmpresa > 0)) errores.id_empresa = 'Seleccione la empresa.';
  if (!esFechaISO(c.fecha_inicio)) errores.fecha_inicio = 'Indique una fecha de inicio válida.';
  if (!esFechaISO(c.fecha_fin)) errores.fecha_fin = 'Indique una fecha de fin válida.';
  if (!errores.fecha_inicio && !errores.fecha_fin && c.fecha_fin <= c.fecha_inicio) {
    errores.fecha_fin = 'La fecha de fin debe ser posterior a la de inicio.';
  }
  return { errores, datos: { id_empresa: idEmpresa, fecha_inicio: c.fecha_inicio, fecha_fin: c.fecha_fin } };
}

function validarEstadoConvenio(c = {}) {
  const errores = {};
  const estado = texto(c.estado);
  if (!ESTADOS_CONVENIO.includes(estado)) errores.estado = 'El estado debe ser vigente, suspendido o terminado.';
  return { errores, datos: { estado } };
}

/** Los filtros del listado no deben fallar: lo que no se entiende simplemente se ignora. */
function normalizarFiltrosOfertas(q = {}) {
  const filtros = {
    texto: texto(q.texto).slice(0, 80),
    ciudad: texto(q.ciudad).slice(0, 80),
    modalidad: MODALIDADES.includes(texto(q.modalidad)) ? texto(q.modalidad) : '',
    id_programa: entero(q.id_programa) > 0 ? entero(q.id_programa) : null,
    pagina: entero(q.pagina) >= 1 ? entero(q.pagina) : 1,
    limite: entero(q.limite) >= 1 ? Math.min(entero(q.limite), 20) : 4,
  };
  return filtros;
}

module.exports = {
  MODALIDADES,
  ESTADOS_CONVENIO,
  exigir,
  validarRegistroEstudiante,
  validarRegistroEmpresa,
  validarLogin,
  validarOferta,
  validarPostulacion,
  validarDecision,
  validarConvenio,
  validarEstadoConvenio,
  normalizarFiltrosOfertas,
};
