'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  exigir,
  validarRegistroEstudiante,
  validarRegistroEmpresa,
  validarOferta,
  validarPostulacion,
  validarDecision,
  validarConvenio,
  normalizarFiltrosOfertas,
} = require('../../server/utils/validadores');
const { crearPdfMinimo } = require('../../server/utils/pdfMinimo');

const estudianteValido = {
  nombre: '  Camila Restrepo Gómez ',
  documento: '1000123401',
  correo: 'Camila.Restrepo@Practicas.demo ',
  contrasena: 'Clave2026x',
  id_programa: '1',
  semestre: 9,
  acepta_datos: true,
};

const pdfBase64 = (lineas = ['Hoja de vida']) => crearPdfMinimo(lineas).toString('base64');

describe('Validación de cuentas', () => {
  test('PU-26 un registro de estudiante válido devuelve los datos limpios (correo en minúsculas, texto sin espacios)', () => {
    const datos = exigir(validarRegistroEstudiante(estudianteValido));
    assert.equal(datos.nombre, 'Camila Restrepo Gómez');
    assert.equal(datos.correo, 'camila.restrepo@practicas.demo');
    assert.equal(datos.id_programa, 1);
    assert.equal(datos.semestre, 9);
  });

  test('PU-27 se rechaza documento corto, semestre fuera de rango y falta de autorización de datos (Ley 1581)', () => {
    const { errores } = validarRegistroEstudiante({ ...estudianteValido, documento: '123', semestre: 15, acepta_datos: false });
    assert.deepEqual(Object.keys(errores).sort(), ['acepta_datos', 'documento', 'semestre']);
  });

  test('PU-28 la contraseña exige 8 caracteres o más, con letras y números', () => {
    const revisar = (contrasena) => validarRegistroEstudiante({ ...estudianteValido, contrasena }).errores.contrasena;
    assert.ok(revisar('corta1'));
    assert.ok(revisar('sololetrasaqui'));
    assert.ok(revisar('123456789012'));
    assert.equal(revisar('Clave2026x'), undefined);
  });

  test('PU-29 el NIT acepta dígito de verificación opcional y rechaza letras', () => {
    const base = { nombre: 'Nodo Digital S.A.S.', sector: 'Tecnología', correo: 'rrhh@nodo.demo', contrasena: 'Clave2026x', acepta_datos: true };
    assert.equal(validarRegistroEmpresa({ ...base, nit: '900123456-7' }).errores.nit, undefined);
    assert.equal(validarRegistroEmpresa({ ...base, nit: '900123456' }).errores.nit, undefined);
    assert.ok(validarRegistroEmpresa({ ...base, nit: 'ABC123456' }).errores.nit);
  });
});

describe('Validación de ofertas y postulaciones', () => {
  const ofertaValida = {
    titulo: 'Practicante de desarrollo web',
    descripcion: 'Participará en el desarrollo de una plataforma web con React y Node.js.',
    requisitos: 'Semestre 8 o superior',
    cupos: '2',
    ciudad: 'Medellín',
    modalidad: 'hibrida',
  };

  test('PU-30 una oferta no admite fecha de cierre anterior a hoy', () => {
    const { errores } = validarOferta({ ...ofertaValida, fecha_cierre: '2026-11-01' }, { hoy: '2026-11-09' });
    assert.ok(errores.fecha_cierre);
    assert.equal(validarOferta({ ...ofertaValida, fecha_cierre: '2026-11-09' }, { hoy: '2026-11-09' }).errores.fecha_cierre, undefined);
  });

  test('PU-31 una oferta exige entre 1 y 50 cupos y una modalidad válida', () => {
    const { errores } = validarOferta({ ...ofertaValida, cupos: 0, modalidad: 'nocturna' }, { hoy: '2026-11-09' });
    assert.deepEqual(Object.keys(errores).sort(), ['cupos', 'modalidad']);
    assert.equal(exigir(validarOferta(ofertaValida, { hoy: '2026-11-09' })).cupos, 2);
  });

  test('PU-32 la hoja de vida debe ser un PDF: se rechaza otra extensión y un contenido que no es PDF', () => {
    const opciones = { maxBytes: 2 * 1024 * 1024 };
    const base = { acepta_datos: true };
    const buena = validarPostulacion({ ...base, hoja_vida: { nombre: 'cv camila.pdf', contenido_base64: pdfBase64() } }, opciones);
    assert.deepEqual(buena.errores, {});
    assert.equal(buena.datos.hoja_vida.contenido.subarray(0, 5).toString('latin1'), '%PDF-');

    const extension = validarPostulacion({ ...base, hoja_vida: { nombre: 'cv.docx', contenido_base64: pdfBase64() } }, opciones);
    assert.match(extension.errores.hoja_vida, /\.pdf/);

    const falso = Buffer.from('esto no es un pdf').toString('base64');
    const contenido = validarPostulacion({ ...base, hoja_vida: { nombre: 'cv.pdf', contenido_base64: falso } }, opciones);
    assert.match(contenido.errores.hoja_vida, /PDF válido/);
  });

  test('PU-33 la hoja de vida no puede superar el tamaño máximo configurado', () => {
    const grande = pdfBase64(['x'.repeat(3000)]);
    const { errores } = validarPostulacion({ acepta_datos: true, hoja_vida: { nombre: 'cv.pdf', contenido_base64: grande } }, { maxBytes: 1000 });
    assert.match(errores.hoja_vida, /no puede superar/);
  });

  test('PU-34 para postularse hay que autorizar el tratamiento de datos y la carta tiene un máximo de 1500 caracteres', () => {
    const { errores } = validarPostulacion(
      { carta_presentacion: 'a'.repeat(1501), hoja_vida: { nombre: 'cv.pdf', contenido_base64: pdfBase64() } },
      { maxBytes: 2 * 1024 * 1024 }
    );
    assert.deepEqual(Object.keys(errores).sort(), ['acepta_datos', 'carta_presentacion']);
  });

  test('PU-35 rechazar o devolver exige un motivo de al menos 5 caracteres; aprobar no', () => {
    assert.ok(validarDecision({ observacion: 'no' }, 'rechazar').errores.observacion);
    assert.ok(validarDecision({}, 'devolver').errores.observacion);
    assert.deepEqual(validarDecision({}, 'aprobar').errores, {});
    assert.equal(validarDecision({ observacion: 'Convenio en renovación' }, 'devolver').datos.observacion, 'Convenio en renovación');
  });

  test('PU-36 el convenio exige fechas reales y que la de fin sea posterior a la de inicio', () => {
    assert.ok(validarConvenio({ id_empresa: 1, fecha_inicio: '2026-11-01', fecha_fin: '2026-11-01' }).errores.fecha_fin);
    assert.ok(validarConvenio({ id_empresa: 1, fecha_inicio: '2026-02-31', fecha_fin: '2027-01-01' }).errores.fecha_inicio);
    assert.deepEqual(validarConvenio({ id_empresa: '4', fecha_inicio: '2026-11-01', fecha_fin: '2027-11-01' }).errores, {});
  });
});

describe('Filtros del listado de ofertas', () => {
  test('PU-37 los filtros inválidos se ignoran y el tamaño de página se limita a 20', () => {
    const filtros = normalizarFiltrosOfertas({ modalidad: 'nocturna', id_programa: 'abc', pagina: '-3', limite: '500', texto: '  react  ' });
    assert.equal(filtros.modalidad, '');
    assert.equal(filtros.id_programa, null);
    assert.equal(filtros.pagina, 1);
    assert.equal(filtros.limite, 20);
    assert.equal(filtros.texto, 'react');
    assert.equal(normalizarFiltrosOfertas({}).limite, 4);
  });
});
