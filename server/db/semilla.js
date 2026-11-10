'use strict';

const { hashear } = require('../utils/hash');
const { hoyISO, sumarDias } = require('../utils/fechas');
const { crearPdfMinimo } = require('../utils/pdfMinimo');
const { conTransaccion } = require('./pool');

// Todas las cuentas de demostración usan la misma contraseña
const CLAVE_DEMO = 'Demo2026*';

const PROGRAMAS = [
  { clave: 'informatica', nombre: 'Ingeniería Informática', facultad: 'Facultad de Ingeniería' },
  { clave: 'industrial', nombre: 'Ingeniería Industrial', facultad: 'Facultad de Ingeniería' },
  { clave: 'administracion', nombre: 'Administración de Empresas', facultad: 'Facultad de Ciencias Económicas y Administrativas' },
  { clave: 'contaduria', nombre: 'Contaduría Pública', facultad: 'Facultad de Ciencias Económicas y Administrativas' },
  { clave: 'diseno', nombre: 'Diseño Gráfico', facultad: 'Facultad de Artes y Diseño' },
];

const ESTUDIANTES = [
  { clave: 'camila', correo: 'camila.restrepo@practicas.demo', nombre: 'Camila Restrepo Gómez', documento: '1000123401', programa: 'informatica', semestre: 9 },
  { clave: 'julian', correo: 'julian.ospina@practicas.demo', nombre: 'Julián Andrés Ospina Mejía', documento: '1000123402', programa: 'informatica', semestre: 10 },
  { clave: 'valentina', correo: 'valentina.cardona@practicas.demo', nombre: 'Valentina Cardona Ruiz', documento: '1000123403', programa: 'administracion', semestre: 8 },
  { clave: 'mateo', correo: 'mateo.herrera@practicas.demo', nombre: 'Mateo Herrera Londoño', documento: '1000123404', programa: 'industrial', semestre: 9 },
  { clave: 'laura', correo: 'laura.perez@practicas.demo', nombre: 'Laura Sofía Pérez Arango', documento: '1000123405', programa: 'diseno', semestre: 8 },
  { clave: 'sebastian', correo: 'sebastian.giraldo@practicas.demo', nombre: 'Sebastián Giraldo Arias', documento: '1000123406', programa: 'industrial', semestre: 9 },
];

// "convenio": días de inicio y de fin respecto a hoy; null = la empresa no tiene convenio registrado
const EMPRESAS = [
  { clave: 'nodo', correo: 'rrhh@nododigital.demo', nombre: 'Nodo Digital S.A.S.', nit: '900123456-1', sector: 'Tecnología', convenio: { desde: -200, hasta: 165 } },
  { clave: 'andina', correo: 'talento@logisticaandina.demo', nombre: 'Logística Andina Ltda.', nit: '900234567-2', sector: 'Logística y transporte', convenio: { desde: -347, hasta: 18 } },
  { clave: 'valle', correo: 'gestion@estudiovalle.demo', nombre: 'Estudio Creativo Valle S.A.S.', nit: '900345678-3', sector: 'Diseño y publicidad', convenio: { desde: -390, hasta: -25 } },
  { clave: 'horizonte', correo: 'personal@clinicahorizonte.demo', nombre: 'Clínica Horizonte S.A.', nit: '900456789-4', sector: 'Salud', convenio: null },
];

const OFERTAS = [
  {
    empresa: 'nodo', programa: 'informatica', ciudad: 'Medellín', modalidad: 'hibrida', cupos: 2, publicada: -1, cierre: 30,
    titulo: 'Practicante de desarrollo web (React y Node.js)',
    descripcion: 'Participará en el desarrollo de una plataforma web para clientes del sector financiero: construcción de componentes en React, servicios REST en Node.js y pruebas automatizadas, con el acompañamiento de un ingeniero líder.',
    requisitos: 'Semestre 8 o superior.\nConocimientos de JavaScript, Git y bases de datos relacionales.\nDisponibilidad de 6 horas diarias.',
  },
  {
    empresa: 'nodo', programa: 'informatica', ciudad: 'Medellín', modalidad: 'remota', cupos: 1, publicada: -2, cierre: null,
    titulo: 'Practicante de pruebas de software (QA)',
    descripcion: 'Apoyará el diseño y la ejecución de casos de prueba funcionales y de regresión, el reporte de defectos y la automatización de pruebas de API.',
    requisitos: 'Conocimientos básicos de pruebas de software y SQL.\nSe valora experiencia con Postman o Playwright.',
  },
  {
    empresa: 'nodo', programa: 'informatica', ciudad: 'Bogotá', modalidad: 'remota', cupos: 1, publicada: -3, cierre: 45,
    titulo: 'Analista de datos junior',
    descripcion: 'Construirá tableros de seguimiento a partir de bases de datos operativas, depurará información y documentará los indicadores de cada proyecto.',
    requisitos: 'Manejo de SQL y hojas de cálculo.\nNociones de visualización de datos.',
  },
  {
    empresa: 'andina', programa: 'industrial', ciudad: 'Medellín', modalidad: 'presencial', cupos: 2, publicada: -4, cierre: 20,
    titulo: 'Practicante de planeación logística',
    descripcion: 'Apoyará la programación de rutas y la medición de indicadores de entrega (cumplimiento, tiempos de ciclo) en el centro de distribución de la empresa.',
    requisitos: 'Estudiante de Ingeniería Industrial o afines.\nExcel intermedio.',
  },
  {
    empresa: 'andina', programa: 'industrial', ciudad: 'Itagüí', modalidad: 'presencial', cupos: 1, publicada: -30, cierre: null, estado: 'cerrada',
    titulo: 'Auxiliar de mejoramiento de procesos',
    descripcion: 'Levantará los procesos de bodega, propondrá mejoras y hará seguimiento a los planes de acción junto con el equipo operativo.',
    requisitos: 'Conocimientos de mejoramiento continuo (5S, Lean).',
  },
  {
    empresa: 'valle', programa: 'diseno', ciudad: 'Cali', modalidad: 'hibrida', cupos: 1, publicada: -5, cierre: null,
    titulo: 'Practicante de diseño de interfaces',
    descripcion: 'Diseñará prototipos de interfaces para aplicaciones web y móviles siguiendo el sistema de diseño de la agencia y validándolos con los clientes.',
    requisitos: 'Portafolio con proyectos de interfaz.\nManejo de Figma.',
  },
  {
    empresa: 'horizonte', programa: 'administracion', ciudad: 'Medellín', modalidad: 'presencial', cupos: 1, publicada: -6, cierre: 40,
    titulo: 'Practicante de gestión administrativa en salud',
    descripcion: 'Apoyará la programación de citas, el archivo de historias clínicas y la atención a usuarios en el área administrativa de la clínica.',
    requisitos: 'Semestre 7 o superior.\nBuen manejo de herramientas ofimáticas.',
  },
  {
    empresa: 'horizonte', programa: 'contaduria', ciudad: 'Medellín', modalidad: 'presencial', cupos: 1, publicada: -40, cierre: null, estado: 'cerrada',
    titulo: 'Apoyo contable en facturación',
    descripcion: 'Revisará la facturación de servicios, conciliará cuentas con las aseguradoras y apoyará el cierre contable mensual.',
    requisitos: 'Conocimientos de contabilidad general.',
  },
];

// Postulaciones de ejemplo: "oferta" es la posición en OFERTAS; "hace" son días atrás
const POSTULACIONES = [
  { estudiante: 'camila', oferta: 0, estado: 'preseleccionada', hace: 4, carta: 'Me interesa aportar en el desarrollo del frontend y aprender del equipo de ingeniería.' },
  { estudiante: 'julian', oferta: 1, estado: 'enviada', hace: 2, carta: 'He trabajado en pruebas de API y quiero profundizar en la automatización.' },
  { estudiante: 'valentina', oferta: 6, estado: 'preseleccionada', hace: 6, carta: 'Tengo experiencia en atención al usuario y manejo de archivo.' },
  { estudiante: 'sebastian', oferta: 3, estado: 'preseleccionada', hace: 5, carta: 'Quiero aplicar lo aprendido en planeación de la producción a un caso real de distribución.' },
  { estudiante: 'laura', oferta: 5, estado: 'preseleccionada', hace: 7, carta: 'Adjunto mi portafolio de interfaces para aplicaciones móviles.' },
  { estudiante: 'camila', oferta: 2, estado: 'descartada', hace: 9, carta: '' },
  { estudiante: 'julian', oferta: 2, estado: 'rechazada', hace: 12, carta: '', decision: { hace: 10, observacion: 'El perfil no cumple los conocimientos de visualización de datos que pide la oferta.' } },
  { estudiante: 'mateo', oferta: 4, estado: 'aprobada', hace: 20, carta: 'Realicé un proyecto de distribución de planta y quiero aplicarlo en una operación logística.', decision: { hace: 15, observacion: 'Cumple los requisitos y la empresa tiene convenio vigente.' } },
];

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Carga datos de demostración (todos ficticios). Solo actúa sobre una base vacía: si ya hay
 * cuentas, no toca nada y lo informa.
 */
async function sembrar(pool, { hoy = hoyISO(), ahora = new Date() } = {}) {
  const existentes = await pool.query('SELECT COUNT(*)::int AS n FROM usuario');
  if (existentes.rows[0].n > 0) return { omitido: true };

  const cuentas = [
    { correo: 'coordinacion@practicas.demo', rol: 'coordinacion', nombre: 'Coordinación de prácticas' },
    { correo: 'docente@practicas.demo', rol: 'docente', nombre: 'Marcela Torres Villa' },
    ...ESTUDIANTES.map((e) => ({ correo: e.correo, rol: 'estudiante', nombre: e.nombre })),
    ...EMPRESAS.map((e) => ({ correo: e.correo, rol: 'empresa', nombre: e.nombre })),
  ];
  const hashes = await Promise.all(cuentas.map(() => hashear(CLAVE_DEMO)));
  const hashDe = new Map(cuentas.map((cuenta, i) => [cuenta.correo, hashes[i]]));

  await conTransaccion(pool, async (db) => {
    const insertarUsuario = async (correo, rol) => {
      const { rows } = await db.query(
        `INSERT INTO usuario (correo_institucional, hash_contrasena, rol, consentimiento_datos, fecha_consentimiento)
         VALUES ($1, $2, $3, TRUE, now()) RETURNING id_usuario`,
        [correo, hashDe.get(correo), rol]
      );
      return rows[0].id_usuario;
    };

    const programas = {};
    for (const p of PROGRAMAS) {
      const { rows } = await db.query(
        'INSERT INTO programa_academico (nombre, facultad) VALUES ($1, $2) RETURNING id_programa',
        [p.nombre, p.facultad]
      );
      programas[p.clave] = rows[0].id_programa;
    }

    const idCoordinacion = await insertarUsuario('coordinacion@practicas.demo', 'coordinacion');

    const idUsuarioDocente = await insertarUsuario('docente@practicas.demo', 'docente');
    await db.query(
      'INSERT INTO docente (id_usuario, id_programa, nombre, correo) VALUES ($1, $2, $3, $4)',
      [idUsuarioDocente, programas.informatica, 'Marcela Torres Villa', 'docente@practicas.demo']
    );

    const estudiantes = {};
    for (const e of ESTUDIANTES) {
      const idUsuario = await insertarUsuario(e.correo, 'estudiante');
      const { rows } = await db.query(
        `INSERT INTO estudiante (id_usuario, id_programa, nombre, documento, semestre)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_estudiante`,
        [idUsuario, programas[e.programa], e.nombre, e.documento, e.semestre]
      );
      estudiantes[e.clave] = { id: rows[0].id_estudiante, ...e };
    }

    const empresas = {};
    for (const e of EMPRESAS) {
      const idUsuario = await insertarUsuario(e.correo, 'empresa');
      const { rows } = await db.query(
        `INSERT INTO empresa (id_usuario, nombre, nit, sector, correo_contacto)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_empresa`,
        [idUsuario, e.nombre, e.nit, e.sector, e.correo]
      );
      empresas[e.clave] = rows[0].id_empresa;
      if (e.convenio) {
        await db.query('INSERT INTO convenio (id_empresa, fecha_inicio, fecha_fin) VALUES ($1, $2, $3)', [
          rows[0].id_empresa,
          sumarDias(hoy, e.convenio.desde),
          sumarDias(hoy, e.convenio.hasta),
        ]);
      }
    }

    const ofertas = [];
    for (const o of OFERTAS) {
      const { rows } = await db.query(
        `INSERT INTO oferta_practica
           (id_empresa, titulo, descripcion, requisitos, cupos, ciudad, modalidad, id_programa,
            fecha_publicacion, fecha_cierre, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id_oferta`,
        [
          empresas[o.empresa], o.titulo, o.descripcion, o.requisitos, o.cupos, o.ciudad, o.modalidad,
          programas[o.programa], sumarDias(hoy, o.publicada), o.cierre === null ? null : sumarDias(hoy, o.cierre),
          o.estado || 'abierta',
        ]
      );
      ofertas.push(rows[0].id_oferta);
    }

    for (const p of POSTULACIONES) {
      const estudiante = estudiantes[p.estudiante];
      const programa = PROGRAMAS.find((x) => x.clave === estudiante.programa).nombre;
      const hoja = crearPdfMinimo([
        'Hoja de vida (datos de demostración)',
        estudiante.nombre,
        `${programa} - semestre ${estudiante.semestre}`,
        estudiante.correo,
      ]);
      await db.query(
        `INSERT INTO postulacion
           (id_estudiante, id_oferta, estado_postulacion, carta_presentacion, hoja_vida, hoja_vida_nombre,
            fecha_postulacion, fecha_decision, observacion_decision, id_usuario_decision)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          estudiante.id,
          ofertas[p.oferta],
          p.estado,
          p.carta,
          hoja,
          `HV_${estudiante.nombre.split(' ')[0]}.pdf`,
          new Date(ahora.getTime() - p.hace * DIA_MS),
          p.decision ? new Date(ahora.getTime() - p.decision.hace * DIA_MS) : null,
          p.decision ? p.decision.observacion : null,
          p.decision ? idCoordinacion : null,
        ]
      );
    }
  });

  return {
    omitido: false,
    clave: CLAVE_DEMO,
    cuentas: cuentas.map(({ correo, rol, nombre }) => ({ correo, rol, nombre })),
    totales: {
      programas: PROGRAMAS.length,
      estudiantes: ESTUDIANTES.length,
      empresas: EMPRESAS.length,
      ofertas: OFERTAS.length,
      postulaciones: POSTULACIONES.length,
    },
  };
}

module.exports = { sembrar, CLAVE_DEMO };
